import moment from 'moment-timezone'
import OpenAI from 'openai'
import { nanoid } from 'nanoid'
import { ManualAgentRequest, ManualAgentResponse, ManualAgentToolDefinition } from './types'
import { ensureQuintasSeed } from './quintasData'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'
import { createHold } from './quintasOps'
import { getManualAgentModel, getManualAgentOpenAIKey } from './config'

type CatalogMeta = {
    catalogLink?: string
    catalogSummary?: string
    address?: string
    contact?: { email?: string }
    generalAmenities?: string[]
    policies?: Record<string, any>
    paymentSummary?: Record<string, any>
    discountPolicy?: Record<string, any>
    visitPolicy?: Record<string, any>
}

type CatalogProperty = {
    propertyId: string
    name?: string
    location?: string
    capacity?: number
    basePricePerNight?: number
    currency?: string
    minNights?: number
    amenities?: string[]
    restrictions?: Record<string, any>
}

type RestrictionsDoc = {
    general?: {
        music?: { day?: string; night?: string }
        rainInsurance?: boolean
        airConditioning?: boolean
        mitigation?: string[]
    }
    blockedDatesText?: string
    payment?: {
        holdHours?: number
        depositPct?: number
        depositDeadlineHours?: number
        fullPaymentDaysBefore?: number
        acceptedMethods?: string[]
        bankTransfer?: {
            accountName?: string
            bank?: string
            cbu?: string
            alias?: string
            concept?: string
        }
    }
    discounts?: {
        enabled?: boolean
        habitualPct?: number
        requiresFlag?: boolean
    }
    visits?: {
        availableSlots?: Array<{ day: string; slots: string[] }>
        requirements?: string[]
    }
    checkInOut?: {
        checkInTime?: string
        checkOutTime?: string
        notes?: string
    }
    minStayRules?: Array<{ start: string; end: string; minNights: number; reason?: string }>
}

type CalendarDoc = {
    propertyId: string
    propertyName?: string
    year?: number
    events?: Array<{ start: string; end: string; status: string; holdExpires?: Date }>
    blockedDates?: string[]
    globalBlackoutDates?: Array<{ start: string; end: string; reason?: string }>
}

type LeadInput = {
    id?: string
    name?: string
    phone?: string
    channel?: string
    dateRequested?: string
    propertyId?: string
    people?: number
    interest?: string
    status?: string
    habitual?: boolean
    notes?: string
}

const collectionNames = getManualAgentsCollections()

export const QUINTAS_ALLOWED_COLLECTIONS = [
    collectionNames.manualAgentSessions,
    collectionNames.manualAgentShareTokens,
    collectionNames.manualAgentMetrics,
    collectionNames.manualAgentCalendarLogs,
    collectionNames.manualAgentOutboundRuns,
    collectionNames.manualAgentChatLogs,
    collectionNames.quintasCalendar,
    collectionNames.quintasCatalog,
    collectionNames.quintasRestrictions,
    collectionNames.quintasCompetitors,
    collectionNames.quintasLeads
]

export const QUINTAS_ALLOWED_OPS: Array<'read' | 'write'> = ['read', 'write']

const ensureToolAccess = (op: 'read' | 'write', collections: string[]) => {
    if (!QUINTAS_ALLOWED_OPS.includes(op)) {
        throw new Error(`Operation not allowed: ${op}`)
    }
    const missing = collections.filter((collection) => !QUINTAS_ALLOWED_COLLECTIONS.includes(collection))
    if (missing.length) {
        throw new Error(`Collection access not allowed: ${missing.join(', ')}`)
    }
}

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

const detectLocaleFromMessage = (message: string) => {
    const lower = normalizeText(message || '')
    const englishHints = [
        'hello',
        'hi',
        'thanks',
        'thank',
        'please',
        'available',
        'availability',
        'book',
        'booking',
        'reserve',
        'reservation',
        'price',
        'cost',
        'night',
        'nights',
        'people',
        'from',
        'to',
        'date',
        'dates',
        'deposit',
        'payment',
        'bank',
        'transfer'
    ]
    const spanishHints = [
        'hola',
        'gracias',
        'por favor',
        'disponible',
        'disponibilidad',
        'reserv',
        'precio',
        'costo',
        'noche',
        'noches',
        'personas',
        'desde',
        'hasta',
        'fecha',
        'fechas',
        'deposito',
        'anticipo',
        'pago',
        'banco',
        'transferencia'
    ]
    const enScore = englishHints.reduce((acc, hint) => (lower.includes(hint) ? acc + 1 : acc), 0)
    const esScore = spanishHints.reduce((acc, hint) => (lower.includes(hint) ? acc + 1 : acc), 0)
    return enScore > esScore ? 'en-US' : 'es-AR'
}

const responseForLocale = (locale: string, esText: string, enText: string) => {
    return locale === 'en-US' ? enText : esText
}

const isLikelyEnglish = (text: string) => {
    return detectLocaleFromMessage(text) === 'en-US'
}

const extractNamesFromSummary = (summary: string) => {
    if (!summary) return [] as string[]
    const names: string[] = []
    for (const line of summary.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('- ')) continue
        const withoutDash = trimmed.slice(2)
        const cutAt = Math.min(
            ...[' - ', ' ('].map((token) => {
                const idx = withoutDash.indexOf(token)
                return idx === -1 ? Number.POSITIVE_INFINITY : idx
            })
        )
        const name = (cutAt === Number.POSITIVE_INFINITY ? withoutDash : withoutDash.slice(0, cutAt)).trim()
        if (name) names.push(name)
    }
    return names
}

const summaryAlreadyCovered = (summary: string, answer: string) => {
    if (!summary || !answer) return false
    const names = extractNamesFromSummary(summary)
    const lowerAnswer = normalizeText(answer)
    const genericCovered = [
        'no hay disponibilidad',
        'no tenemos disponibilidad',
        'sin disponibilidad',
        'todas ocupadas',
        'todas estan ocupadas',
        'todas estan reservadas',
        'ninguna disponible',
        'fully booked',
        'no availability'
    ].some((phrase) => lowerAnswer.includes(normalizeText(phrase)))
    if (genericCovered) return true
    if (!names.length) return false
    let matches = 0
    for (const name of names) {
        if (lowerAnswer.includes(normalizeText(name))) {
            matches += 1
        }
        if (matches >= 2) return true
    }
    return false
}

const isGreetingOnly = (message: string) => {
    const lower = normalizeText(message || '').trim()
    if (!lower) return false
    const greetings = [
        'hola',
        'buenas',
        'buen dia',
        'buenas tardes',
        'buenas noches',
        'hello',
        'hi'
    ]
    const hasGreeting = greetings.some((greet) => lower === greet || lower.startsWith(`${greet} `))
    if (!hasGreeting) return false
    const hasDates = extractDates(message).length > 0
    const hasKeywords = [
        'dispon',
        'precio',
        'reserv',
        'pago',
        'deposito',
        'anticipo',
        'visita',
        'catalogo'
    ].some((keyword) => lower.includes(keyword))
    return !hasDates && !hasKeywords
}

const extractDates = (message: string): moment.Moment[] => {
    const matches: string[] = []
    const isoMatches = message.match(/\d{4}-\d{2}-\d{2}/g) || []
    const slashMatches = message.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || []
    matches.push(...isoMatches, ...slashMatches)

    return matches
        .map((raw) => {
            if (raw.includes('-')) {
                return moment(raw, 'YYYY-MM-DD', true)
            }
            const parts = raw.split('/')
            if (parts.length === 2) {
                const year = moment().year()
                return moment(`${parts[0]}/${parts[1]}/${year}`, 'DD/MM/YYYY', true)
            }
            return moment(raw, 'DD/MM/YYYY', true)
        })
        .filter((parsed) => parsed.isValid())
}

const detectProperty = (message: string, properties: CatalogProperty[]) => {
    const lower = normalizeText(message)
    return properties.find((property) => {
        if (!property.propertyId) return false
        if (lower.includes(normalizeText(property.propertyId))) return true
        if (property.name && lower.includes(normalizeText(property.name))) return true
        return false
    })
}

const rangesOverlap = (start: moment.Moment, end: moment.Moment, rangeStart: moment.Moment, rangeEnd: moment.Moment) => {
    return start.isSameOrBefore(rangeEnd, 'day') && end.isSameOrAfter(rangeStart, 'day')
}

const isRangeBlocked = (start: moment.Moment, end: moment.Moment, calendar: CalendarDoc) => {
    if (calendar.blockedDates?.length) {
        const blocked = calendar.blockedDates.some((dateStr) => {
            const date = moment(dateStr, 'YYYY-MM-DD', true)
            if (!date.isValid()) return false
            return date.isSameOrAfter(start, 'day') && date.isSameOrBefore(end, 'day')
        })
        if (blocked) return true
    }

    if (calendar.globalBlackoutDates?.length) {
        return calendar.globalBlackoutDates.some((block) => {
            const blockStart = moment(block.start, 'YYYY-MM-DD', true)
            const blockEnd = moment(block.end, 'YYYY-MM-DD', true)
            if (!blockStart.isValid() || !blockEnd.isValid()) return false
            return rangesOverlap(start, end, blockStart, blockEnd)
        })
    }

    return false
}

const hasRangeConflict = (start: moment.Moment, end: moment.Moment, calendar: CalendarDoc) => {
    const now = moment()
    return (calendar.events || []).some((event) => {
        if (!['booked', 'hold'].includes(event.status)) return false
        if (event.status === 'hold' && event.holdExpires) {
            const expiresAt = moment(event.holdExpires)
            if (expiresAt.isValid() && expiresAt.isSameOrBefore(now)) {
                return false
            }
        }
        const eventStart = moment(event.start, 'YYYY-MM-DD')
        const eventEnd = moment(event.end, 'YYYY-MM-DD')
        return rangesOverlap(start, end, eventStart, eventEnd)
    })
}

const getAvailabilityYears = (start: moment.Moment, end: moment.Moment) => {
    const years = new Set<number>([start.year(), end.year(), start.clone().subtract(1, 'year').year()])
    return Array.from(years)
}

const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'Consultar'
    return `${price.toFixed(0)} ${currency || 'USD'}`
}

const formatAvailabilitySections = (available: Array<Record<string, any>>, unavailable: Array<Record<string, any>>, locale = 'es-AR') => {
    const availableLabel = locale === 'en-US' ? 'Available' : 'Disponibles'
    const unavailableLabel = locale === 'en-US' ? 'Unavailable' : 'No disponibles'
    const noneLabel = locale === 'en-US' ? 'None.' : 'Ninguna.'
    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const minNightsLabel = (minNights?: number) =>
        locale === 'en-US' ? (minNights ? `min ${minNights} nights` : 'minimum nights') : `minimo ${minNights} noches`
    const blockedLabel = locale === 'en-US' ? 'occupied' : 'ocupada'
    const bookedLabel = locale === 'en-US' ? 'booked' : 'reservada'
    const unavailableDefault = locale === 'en-US' ? 'unavailable' : 'no disponible'

    const availableLines = available.map((item) => {
        const name = item.name || item.propertyId || 'Quinta'
        const location = item.location ? ` (${item.location})` : ''
        const price = item.basePricePerNight ? `${formatPrice(item.basePricePerNight, item.currency)} ${perNightLabel}` : ''
        const minNights = item.minNights ? minNightsLabel(item.minNights) : ''
        const details = [price, minNights].filter(Boolean).join(', ')
        return `- ${name}${location}${details ? ` - ${details}` : ''}`
    })

    const unavailableLines = unavailable.map((item) => {
        const name = item.name || item.propertyId || 'Quinta'
        let reason = unavailableDefault
        if (item.reason === 'blocked') reason = blockedLabel
        if (item.reason === 'booked') reason = bookedLabel
        if (item.reason === 'min_nights') {
            reason = minNightsLabel(item.minNights)
        }
        return `- ${name} - ${reason}`
    })

    const availableSection = `${availableLabel}:\n${availableLines.length ? availableLines.join('\n\n') : noneLabel}`
    const unavailableSection = `${unavailableLabel}:\n${unavailableLines.length ? unavailableLines.join('\n\n') : noneLabel}`

    return `${availableSection}\n\n${unavailableSection}`
}

const buildAvailabilityOverview = async (daysWindow = 30, locale = 'es-AR') => {
    const properties = await getCatalogProperties()
    if (!properties.length) {
        return responseForLocale(
            locale,
            'No tengo quintas cargadas para mostrar disponibilidad.',
            'No properties loaded to show availability.'
        )
    }

    const timezone = 'America/Argentina/Buenos_Aires'
    const startDate = moment.tz(timezone).startOf('day')
    const endDate = startDate.clone().add(daysWindow, 'days')
    const years = getAvailabilityYears(startDate, endDate)

    const calendarsByProperty = new Map<string, CalendarDoc[]>()
    for (const prop of properties) {
        const docs = await getCalendarDocs(prop.propertyId, years)
        calendarsByProperty.set(prop.propertyId, docs || [])
    }

    const availableDates: string[] = []
    const fullDates: string[] = []

    for (let day = startDate.clone(); day.isBefore(endDate); day.add(1, 'day')) {
        let availableCount = 0
        for (const prop of properties) {
            const calendars = calendarsByProperty.get(prop.propertyId) || []
            let blocked = false
            let conflict = false
            for (const calendar of calendars) {
                if (isRangeBlocked(day, day, calendar)) {
                    blocked = true
                    break
                }
                if (hasRangeConflict(day, day, calendar)) {
                    conflict = true
                    break
                }
            }
            if (!blocked && !conflict) {
                availableCount += 1
            }
        }
        const dateLabel = day.format('YYYY-MM-DD')
        if (availableCount === 0) {
            fullDates.push(dateLabel)
        } else {
            availableDates.push(dateLabel)
        }
    }

    const availablePreview = availableDates.slice(0, 6).join(', ') || (locale === 'en-US' ? 'None' : 'Ninguna')
    const fullPreview = fullDates.slice(0, 6).join(', ') || (locale === 'en-US' ? 'None' : 'Ninguna')

    return responseForLocale(
        locale,
        `Resumen de disponibilidad (${daysWindow} dias):\nDisponibles: ${availablePreview}\nCompletas: ${fullPreview}`,
        `Availability overview (${daysWindow} days):\nAvailable: ${availablePreview}\nFully booked: ${fullPreview}`
    )
}

const getCatalogMeta = async (): Promise<CatalogMeta> => {
    const db = await getManualAgentsDb()
    const { quintasCatalog } = collectionNames
    ensureToolAccess('read', [quintasCatalog])
    const meta = await db.collection<CatalogMeta>(quintasCatalog).findOne({ type: 'meta' })
    return meta || {}
}

const getCatalogProperties = async (): Promise<CatalogProperty[]> => {
    const db = await getManualAgentsDb()
    const { quintasCatalog } = collectionNames
    ensureToolAccess('read', [quintasCatalog])
    const list = await db.collection<CatalogProperty>(quintasCatalog).find({ type: 'property' }).toArray()
    return list || []
}

const getRestrictions = async (): Promise<RestrictionsDoc> => {
    const db = await getManualAgentsDb()
    const { quintasRestrictions } = collectionNames
    ensureToolAccess('read', [quintasRestrictions])
    const doc = await db.collection<RestrictionsDoc>(quintasRestrictions).findOne({})
    return doc || {}
}

const getCalendarDocs = async (propertyId: string, years: number[]): Promise<CalendarDoc[]> => {
    const db = await getManualAgentsDb()
    const { quintasCalendar } = collectionNames
    ensureToolAccess('read', [quintasCalendar])
    return await db
        .collection<CalendarDoc>(quintasCalendar)
        .find({ propertyId, year: { $in: years } })
        .toArray()
}

const getLeadDoc = async () => {
    const db = await getManualAgentsDb()
    const { quintasLeads } = collectionNames
    ensureToolAccess('read', [quintasLeads])
    return db.collection<{ leads?: LeadInput[] }>(quintasLeads).findOne({ type: 'seed' })
}

const upsertLead = async (input: LeadInput) => {
    const db = await getManualAgentsDb()
    const { quintasLeads } = collectionNames
    ensureToolAccess('write', [quintasLeads])
    const leadsCollection = db.collection(quintasLeads)

    const leadDoc = await leadsCollection.findOne({ type: 'seed' })
    const leads = (leadDoc?.leads || []) as LeadInput[]
    const leadId = input.id || input.phone || nanoid(8)
    const existingIndex = leads.findIndex((lead) => lead.id === leadId || (input.phone && lead.phone === input.phone))

    const payload = {
        id: leadId,
        name: input.name,
        phone: input.phone,
        channel: input.channel,
        dateRequested: input.dateRequested,
        property: input.propertyId,
        people: input.people,
        interest: input.interest,
        status: input.status || 'open',
        habitual: input.habitual ?? false,
        notes: input.notes
    }

    if (existingIndex >= 0) {
        leads[existingIndex] = { ...leads[existingIndex], ...payload }
    } else {
        leads.push(payload)
    }

    await leadsCollection.updateOne({ type: 'seed' }, { $set: { type: 'seed', leads, updatedAt: new Date() } }, { upsert: true })

    return payload
}

const getLead = async (input: { id?: string; phone?: string }) => {
    const doc = await getLeadDoc()
    const leads = (doc?.leads || []) as LeadInput[]
    return leads.find((lead) => (input.id && lead.id === input.id) || (input.phone && lead.phone === input.phone)) || null
}

const checkAvailability = async (input: { start: string; end?: string; propertyId?: string; locale?: string }) => {
    const startDate = moment(input.start, 'YYYY-MM-DD', true)
    const endDate = moment(input.end || input.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || !endDate.isValid()) {
        return { ok: false, reason: 'invalid_date' }
    }
    const locale = input.locale || 'es-AR'

    const properties = await getCatalogProperties()
    const filtered = input.propertyId ? properties.filter((p) => p.propertyId === input.propertyId) : properties
    const years = getAvailabilityYears(startDate, endDate)

    const available: Array<Record<string, any>> = []
    const unavailable: Array<Record<string, any>> = []

    for (const prop of filtered) {
        const calendars = await getCalendarDocs(prop.propertyId, years)
        const minNights = prop.minNights || 1
        const length = endDate.diff(startDate, 'days') + 1
        const minNightsOk = length >= minNights

        let blocked = false
        let conflict = false
        for (const calendar of calendars) {
            if (isRangeBlocked(startDate, endDate, calendar)) {
                blocked = true
                break
            }
            if (hasRangeConflict(startDate, endDate, calendar)) {
                conflict = true
                break
            }
        }

        if (!blocked && !conflict && minNightsOk) {
            available.push({
                propertyId: prop.propertyId,
                name: prop.name,
                location: prop.location,
                basePricePerNight: prop.basePricePerNight,
                currency: prop.currency,
                minNights
            })
        } else {
            unavailable.push({
                propertyId: prop.propertyId,
                name: prop.name,
                reason: blocked ? 'blocked' : conflict ? 'booked' : 'min_nights',
                minNights
            })
        }
    }

    return { ok: true, available, unavailable, summary: formatAvailabilitySections(available, unavailable, locale) }
}

const buildAvailabilityReply = async (startStr: string, endStr: string, property?: CatalogProperty, locale = 'es-AR') => {
    const rangeLabel = startStr === endStr ? startStr : `${startStr} al ${endStr}`
    const result = await checkAvailability({
        start: startStr,
        end: endStr,
        propertyId: property?.propertyId,
        locale
    })

    if (!result.ok) {
        return {
            answer: responseForLocale(
                locale,
                'No pude validar disponibilidad con esas fechas. Podrias confirmarlas en formato YYYY-MM-DD?',
                "I couldn't validate availability for those dates. Could you confirm them in YYYY-MM-DD format?"
            )
        }
    }

    return {
        answer: responseForLocale(
            locale,
            `Disponibilidad para ${rangeLabel}:\n\n${result.summary}`,
            `Availability for ${rangeLabel}:\n\n${result.summary}`
        )
    }
}

const buildRulesReply = (restrictions: RestrictionsDoc, locale = 'es-AR') => {
    const musicDay = restrictions.general?.music?.day || 'musica moderada de dia'
    const musicNight = restrictions.general?.music?.night || 'sin musica amplificada despues de las 22:00'
    return responseForLocale(
        locale,
        `Reglas de musica: ${musicDay}. De noche: ${musicNight}.`,
        `Music rules: ${musicDay}. At night: ${musicNight}.`
    )
}

const buildPaymentReply = (restrictions: RestrictionsDoc, locale = 'es-AR') => {
    const payment = restrictions.payment || {}
    const depositPct = payment.depositPct ?? 0
    const deadlineHours = payment.depositDeadlineHours ?? 0
    const fullPaymentDays = payment.fullPaymentDaysBefore ?? 0
    const methods = payment.acceptedMethods?.join(', ') || 'transferencia'
    const transfer = payment.bankTransfer || {}
    const transferParts = [
        transfer.accountName ? `${locale === 'en-US' ? 'Account name' : 'Titular'}: ${transfer.accountName}` : '',
        transfer.bank ? `${locale === 'en-US' ? 'Bank' : 'Banco'}: ${transfer.bank}` : '',
        transfer.cbu ? `CBU: ${transfer.cbu}` : '',
        transfer.alias ? `${locale === 'en-US' ? 'Alias' : 'Alias'}: ${transfer.alias}` : '',
        transfer.concept ? `${locale === 'en-US' ? 'Concept' : 'Concepto'}: ${transfer.concept}` : ''
    ].filter(Boolean)
    const transferText = transferParts.length
        ? responseForLocale(
              locale,
              ` Datos para la transferencia bancaria: ${transferParts.map((part) => `- ${part}`).join(' ')}`,
              ` Bank transfer details: ${transferParts.map((part) => `- ${part}`).join(' ')}`
          )
        : ''

    return responseForLocale(
        locale,
        `El deposito/anticipo es del ${depositPct}% y debe acreditarse dentro de ${deadlineHours} horas. El pago total es ${fullPaymentDays} dias antes. Medios: ${methods}.${transferText}`,
        `The deposit is ${depositPct}% and must be paid within ${deadlineHours} hours. Full payment is due ${fullPaymentDays} days before check-in. Methods: ${methods}.${transferText}`
    )
}

const buildVisitReply = (restrictions: RestrictionsDoc, catalogMeta: CatalogMeta, locale = 'es-AR') => {
    const slots = restrictions.visits?.availableSlots || catalogMeta.visitPolicy?.availableSlots || []
    if (!slots.length) {
        return responseForLocale(
            locale,
            'Las visitas se coordinan con el administrador. Decime tu disponibilidad y lo vemos.',
            'Visits are coordinated with the administrator. Share your availability and we will confirm.'
        )
    }
    const formatted = slots.map((slot: { day: string; slots: string[] }) => `${slot.day}: ${slot.slots.join(', ')}`).join(' | ')
    return responseForLocale(
        locale,
        `Podes visitar en estos horarios: ${formatted}. Decime que dia/horario te queda mejor.`,
        `You can visit at these times: ${formatted}. Tell me which day/time works best for you.`
    )
}

const buildSystemPrompt = (catalogMeta: CatalogMeta, restrictions: RestrictionsDoc) => {
    const musicDay = restrictions.general?.music?.day || 'musica moderada de dia'
    const musicNight = restrictions.general?.music?.night || 'sin musica amplificada despues de las 22:00'
    const depositPct = restrictions.payment?.depositPct ?? 0
    const deadlineHours = restrictions.payment?.depositDeadlineHours ?? 0
    const fullPaymentDays = restrictions.payment?.fullPaymentDaysBefore ?? 0
    const catalogLink = catalogMeta.catalogLink || ''
    const timezone = 'America/Argentina/Buenos_Aires'
    const today = moment.tz(timezone).format('YYYY-MM-DD')
    const contactEmail = catalogMeta.contact?.email || ''
    const blockedDatesText = restrictions.blockedDatesText || ''

    return [
        'Sos el encargado de reservas de "Quintas El Rincon de Mi Mundo". Respondes en el idioma del cliente: espanol (Argentina) o ingles (US). Mantene tono amable, cercano y humano.',
        'Presentate de forma breve como parte del equipo si el usuario saluda o si es el primer mensaje.',
        `Fecha actual (${timezone}): ${today}. Si el usuario da fechas sin ano, asumi la proxima ocurrencia futura (si ya paso este ano, usa el ano siguiente).`,
        'Reglas fijas:',
        '- No hay seguro de lluvia.',
        '- Informar aire acondicionado segun cada quinta (algunas si, otras no).',
        `- Musica: ${musicDay}. De noche: ${musicNight}.`,
        '- Descuentos solo para clientes habituales (verificar con get_lead).',
        `- Pagos: deposito/anticipo ${depositPct}% en ${deadlineHours} horas. Pago total ${fullPaymentDays} dias antes.`,
        '- Visitas solo con disponibilidad y coordinacion con admin.',
        '- Nunca uses el telefono del cliente como contacto del negocio.',
        '- No inventes datos bancarios (CBU, alias, cuenta). Si no estan en catalogo/restricciones, indica que un humano enviara los datos y pregunta canal preferido.',
        '- Si piden datos de transferencia, usa restrictions.payment.bankTransfer.',
        '- Usa record_lead cuando el cliente comparte nombre/telefono/email.',
        '- Solo crea una reserva con deposito/anticipo cuando el cliente confirma reserva y ya tenemos sus datos; idealmente en el mismo mensaje donde envias instrucciones de pago.',
        '- Antes de afirmar disponibilidad, llama check_availability y usa sus resultados.',
        '- No contradigas disponibilidad ya informada en la misma conversacion, salvo que check_availability lo indique y lo aclares.',
        '- Cuando respondas disponibilidad, usa secciones "Disponibles" y "No disponibles". Si check_availability trae summary, copialo.',
        '- Cuando uses check_availability, pasa locale segun el idioma del cliente (es-AR o en-US).',
        '- Evita decir "blocked"; usa "ocupada" o "reservada" segun corresponda.',
        '- Si listas opciones (numeradas o con guiones), separa cada opcion con una linea en blanco para que se lean como parrafos.',
        '- No respondas temas fuera de quintas (ej: deportes, medicina). Si preguntan algo fuera de tema, redirigi amablemente a disponibilidad, precios, reservas, pagos o visitas.',
        blockedDatesText
            ? `- Si es el primer mensaje o faltan fechas, menciona fechas con minimo de noches/temporada alta: ${blockedDatesText}`
            : '',
        '- Si no hay fechas, usa get_availability_overview para dar un resumen de disponibilidad y fechas completas.',
        'Si faltan datos, pregunta solo lo necesario. Si no hay disponibilidad, ofrece alternativas.',
        catalogLink ? `Catalogo: ${catalogLink}` : '',
        contactEmail ? `Contacto oficial: ${contactEmail}.` : '',
        'Usa las herramientas para disponibilidad, reglas, catalogo, leads y reservas con deposito/anticipo. No inventes datos.'
    ]
        .filter(Boolean)
        .join('\n')
}

const runLlmFlow = async (
    message: string,
    sessionId: string,
    catalogMeta: CatalogMeta,
    restrictions: RestrictionsDoc,
    locale: string
): Promise<ManualAgentResponse> => {
    const apiKey = getManualAgentOpenAIKey()
    if (!apiKey) {
        throw new Error('OpenAI key missing')
    }

    const openai = new OpenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(catalogMeta, restrictions)

    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('read', [collections.manualAgentSessions])
    const session = await db
        .collection<{ messages?: Array<{ role: string; content: string }> }>(collections.manualAgentSessions)
        .findOne({ sessionId, agentId: 'quintas' })
    const history = (session?.messages || [])
        .slice(-8)
        .filter((msg: any) => msg?.role === 'user' || msg?.role === 'assistant')
        .map((msg: any) => ({ role: msg.role, content: msg.content }))

    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `Idioma del cliente: ${locale}. Responde en ese idioma.` },
        ...history,
        { role: 'user', content: message }
    ]

    const tools = QUINTAS_TOOL_SPECS.map((tool) => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    })) as OpenAI.ChatCompletionTool[]

    let metadata: Record<string, unknown> | undefined
    let availabilitySummary: string | null = null
    let availabilityRange: { start?: string; end?: string } | null = null

    for (let i = 0; i < 3; i += 1) {
        const completion = await openai.chat.completions.create({
            model: getManualAgentModel(),
            messages,
            tools,
            tool_choice: 'auto'
        })

        const assistant = completion.choices[0]?.message
        if (!assistant) {
            break
        }

        const toolCalls = (assistant.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>) || []

        if (!toolCalls.length) {
            let answer =
                (assistant.content || '').trim() ||
                responseForLocale(locale, 'No pude procesar tu consulta.', 'I could not process your request.')
            if (locale === 'es-AR' && isLikelyEnglish(answer)) {
                if (availabilitySummary) {
                    const rangeLabel =
                        availabilityRange?.start && availabilityRange?.end && availabilityRange.start !== availabilityRange.end
                            ? `${availabilityRange.start} al ${availabilityRange.end}`
                            : availabilityRange?.start || ''
                    const intro = rangeLabel ? `Disponibilidad para ${rangeLabel}:\n\n` : ''
                    answer = `${intro}${availabilitySummary}\n\nSi queres, te paso alternativas o mas detalles.`
                } else {
                    answer =
                        responseForLocale(
                            locale,
                            'Perdon, podrias repetir la consulta con la fecha exacta?',
                            'Sorry, could you repeat the request with the exact dates?'
                        ) || answer
                }
            }
            if (
                availabilitySummary &&
                !answer.includes(availabilitySummary) &&
                !answer.includes('Disponibles:') &&
                !answer.includes('Available:') &&
                !summaryAlreadyCovered(availabilitySummary, answer)
            ) {
                answer = `${answer}\n\n${availabilitySummary}`
            }
            return { answer, metadata }
        }

        messages.push({ role: 'assistant', content: assistant.content || '', tool_calls: toolCalls })

        for (const toolCall of toolCalls) {
            const name = toolCall.function?.name || ''
            let args: any = {}
            try {
                args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {}
            } catch (_error) {
                args = {}
            }
            const toolResult = await executeQuintasTool(name, args, restrictions)
            if (toolResult.metadata) {
                metadata = toolResult.metadata
            }
            if (name === 'check_availability') {
                const summary = (toolResult.output as { summary?: string } | undefined)?.summary
                if (typeof summary === 'string' && summary.trim()) {
                    availabilitySummary = summary.trim()
                }
                availabilityRange = {
                    start: typeof args.start === 'string' ? args.start : undefined,
                    end: typeof args.end === 'string' ? args.end : args.start
                }
            }
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.output || {})
            })
        }
    }

    return { answer: 'No pude procesar tu consulta.', metadata }
}

const executeQuintasTool = async (name: string, args: Record<string, any>, restrictions: RestrictionsDoc) => {
    const collections = collectionNames
    try {
        switch (name) {
            case 'get_catalog': {
                const meta = await getCatalogMeta()
                return { output: meta }
            }
            case 'list_properties': {
                const properties = await getCatalogProperties()
                const location = args.location ? normalizeText(String(args.location)) : ''
                const filtered = location ? properties.filter((prop) => normalizeText(prop.location || '').includes(location)) : properties
                return {
                    output: filtered.map((prop) => ({
                        propertyId: prop.propertyId,
                        name: prop.name,
                        location: prop.location,
                        capacity: prop.capacity,
                        basePricePerNight: prop.basePricePerNight,
                        currency: prop.currency,
                        minNights: prop.minNights,
                        amenities: prop.amenities,
                        airConditioning: prop.restrictions?.airConditioning ?? restrictions.general?.airConditioning ?? false
                    }))
                }
            }
            case 'check_availability': {
                const result = await checkAvailability({
                    start: args.start,
                    end: args.end,
                    propertyId: args.propertyId,
                    locale: args.locale
                })
                return { output: result }
            }
            case 'create_hold': {
                ensureToolAccess('write', [collections.quintasCalendar])
                const properties = await getCatalogProperties()
                const property = properties.find((item) => item.propertyId === args.propertyId)
                const startDate = moment(args.start, 'YYYY-MM-DD', true)
                const endDate = moment(args.end, 'YYYY-MM-DD', true)
                const nights = startDate.isValid() && endDate.isValid() ? Math.max(endDate.diff(startDate, 'days'), 1) : 1
                const pricePerNight = property?.basePricePerNight
                const currency = property?.currency || 'USD'
                const totalAmount =
                    typeof pricePerNight === 'number' && Number.isFinite(pricePerNight)
                        ? Number((pricePerNight * nights).toFixed(2))
                        : undefined
                const depositPct = restrictions.payment?.depositPct ?? 0
                const depositAmount = typeof totalAmount === 'number' ? Number(((totalAmount * depositPct) / 100).toFixed(2)) : undefined
                const hold = await createHold({
                    propertyId: args.propertyId,
                    start: args.start,
                    end: args.end,
                    leadId: args.leadId,
                    holdHours: args.holdHours || restrictions.payment?.holdHours,
                    notes: args.notes
                })
                if (!hold.ok) {
                    return { output: { ok: false, reason: hold.reason } }
                }
                const holdPayload = {
                    propertyId: args.propertyId,
                    start: args.start,
                    end: args.end,
                    holdExpires: hold.holdExpires?.toISOString(),
                    leadId: args.leadId,
                    nights,
                    pricePerNight,
                    currency,
                    totalAmount,
                    depositPct,
                    depositAmount
                }
                return {
                    output: { ok: true, hold: holdPayload },
                    metadata: { type: 'holdCard', hold: holdPayload }
                }
            }
            case 'get_rules': {
                const rules = await getRestrictions()
                return { output: rules }
            }
            case 'get_availability_overview': {
                const daysWindow = Number.isFinite(Number(args.days)) ? Number(args.days) : 30
                const locale = typeof args.locale === 'string' ? args.locale : 'es-AR'
                const summary = await buildAvailabilityOverview(daysWindow, locale)
                return { output: { summary } }
            }
            case 'record_lead': {
                const lead = await upsertLead({
                    id: args.id || args.leadId,
                    name: args.name,
                    phone: args.phone,
                    channel: args.channel,
                    dateRequested: args.dateRequested,
                    propertyId: args.propertyId,
                    people: args.people,
                    interest: args.interest,
                    status: args.status,
                    habitual: args.habitual,
                    notes: args.notes
                })
                return { output: { ok: true, lead } }
            }
            case 'get_lead': {
                const lead = await getLead({ id: args.id || args.leadId, phone: args.phone })
                return { output: { ok: true, lead } }
            }
            default:
                return { output: { ok: false, error: 'unknown_tool' } }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[manual-agents] tool error', name, message)
        return { output: { ok: false, error: 'tool_error', message } }
    }
}

export const QUINTAS_TOOL_SPECS: ManualAgentToolDefinition[] = [
    {
        name: 'get_catalog',
        description: 'Devuelve link y resumen del catalogo.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'list_properties',
        description: 'Lista quintas con precios, capacidad, ubicacion y amenidades.',
        parameters: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'Filtrar por zona o ubicacion' }
            }
        }
    },
    {
        name: 'check_availability',
        description: 'Verifica disponibilidad para fechas y quinta especifica.',
        parameters: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                end: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                propertyId: { type: 'string', description: 'ID de la quinta' },
                locale: { type: 'string', description: 'Idioma de respuesta: es-AR o en-US' }
            },
            required: ['start']
        }
    },
    {
        name: 'create_hold',
        description:
            'Crea una reserva con deposito/anticipo temporal solo cuando el cliente confirma reserva y ya compartio sus datos; idealmente al mismo tiempo que envias instrucciones de pago.',
        parameters: {
            type: 'object',
            properties: {
                propertyId: { type: 'string' },
                start: { type: 'string' },
                end: { type: 'string' },
                leadId: { type: 'string' },
                holdHours: { type: 'number' },
                notes: { type: 'string' }
            },
            required: ['propertyId', 'start', 'end']
        }
    },
    {
        name: 'get_rules',
        description: 'Devuelve reglas, pagos, visitas, descuentos y restricciones.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_availability_overview',
        description: 'Devuelve resumen de fechas con disponibilidad y fechas completas.',
        parameters: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Cantidad de dias a revisar' },
                locale: { type: 'string', description: 'Idioma de respuesta: es-AR o en-US' }
            }
        }
    },
    {
        name: 'record_lead',
        description: 'Guarda o actualiza un lead en la base.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                phone: { type: 'string' },
                channel: { type: 'string' },
                dateRequested: { type: 'string' },
                propertyId: { type: 'string' },
                people: { type: 'number' },
                interest: { type: 'string' },
                status: { type: 'string' },
                habitual: { type: 'boolean' },
                notes: { type: 'string' }
            }
        }
    },
    {
        name: 'get_lead',
        description: 'Busca un lead por ID o telefono.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                phone: { type: 'string' }
            }
        }
    }
]

const handleQuintasFallback = async (input: ManualAgentRequest, forcedLocale?: string): Promise<ManualAgentResponse> => {
    const message = input.message || ''
    const lower = normalizeText(message)
    const locale = forcedLocale || detectLocaleFromMessage(message)

    const [catalogMeta, catalogProperties, restrictions] = await Promise.all([getCatalogMeta(), getCatalogProperties(), getRestrictions()])

    const relevantKeywords = [
        'quinta',
        'quintas',
        'alquiler',
        'reserv',
        'deposito',
        'anticipo',
        'pago',
        'precio',
        'tarifa',
        'disponibilidad',
        'fecha',
        'noches',
        'personas',
        'capacidad',
        'visita',
        'catalogo',
        'ubicacion',
        'direccion',
        'amenities',
        'servicios',
        'pileta',
        'parrilla',
        'quincho',
        'musica',
        'mascota',
        'descuento',
        'transferencia',
        'cbu',
        'alias',
        'banco',
        'reserva con deposito',
        'reserva con anticipo'
    ]
    const offTopicKeywords = [
        'futbol',
        'football',
        'basket',
        'basquet',
        'medicina',
        'medicamento',
        'doctor',
        'doctora',
        'medico',
        'hospital',
        'receta',
        'sintoma',
        'enfermedad',
        'clinica',
        'farmacia'
    ]
    const isRelevant = relevantKeywords.some((keyword) => lower.includes(keyword))
    const isOffTopic = offTopicKeywords.some((keyword) => lower.includes(keyword))

    if (isOffTopic && !isRelevant) {
        return {
            answer: responseForLocale(
                locale,
                'Solo puedo ayudarte con consultas de quintas (disponibilidad, precios, reservas, pagos o visitas). Decime fechas y cantidad de personas y te asesoro.',
                'I can only help with quintas (availability, prices, reservations, payments or visits). Share your dates and number of guests and I will help.'
            )
        }
    }

    if (lower.includes('seguro') || lower.includes('lluvia')) {
        return {
            answer: responseForLocale(
                locale,
                'No contamos con seguro de lluvia. Podemos ofrecer carpa opcional y ventiladores.',
                'We do not offer rain insurance. We can offer an optional tent and fans.'
            )
        }
    }

    if (lower.includes('aire') && lower.includes('acond')) {
        const property = detectProperty(message, catalogProperties)
        if (property) {
            const hasAc = property.restrictions?.airConditioning ?? restrictions.general?.airConditioning ?? false
            return {
                answer: responseForLocale(
                    locale,
                    hasAc
                        ? `${property.name || property.propertyId} si tiene aire acondicionado.`
                        : `${property.name || property.propertyId} no tiene aire acondicionado.`,
                    hasAc
                        ? `${property.name || property.propertyId} has air conditioning.`
                        : `${property.name || property.propertyId} does not have air conditioning.`
                )
            }
        }
        return {
            answer: responseForLocale(
                locale,
                'El aire acondicionado depende de la quinta. Decime cual te interesa y te confirmo.',
                'Air conditioning depends on the specific quinta. Tell me which one and I will confirm.'
            )
        }
    }

    if (lower.includes('musica')) {
        return { answer: buildRulesReply(restrictions, locale) }
    }

    if (lower.includes('visita') || lower.includes('ver la quinta')) {
        return { answer: buildVisitReply(restrictions, catalogMeta, locale) }
    }

    if (lower.includes('pago') || lower.includes('deposit') || lower.includes('anticip')) {
        return { answer: buildPaymentReply(restrictions, locale) }
    }

    if (lower.includes('descuento') || lower.includes('regate')) {
        return {
            answer: responseForLocale(
                locale,
                'Los descuentos son solo para clientes habituales. Si ya alquilaste antes, decime y lo reviso.',
                'Discounts are only for returning customers. If you have rented with us before, tell me and I will check.'
            )
        }
    }

    if (lower.includes('catalogo')) {
        return {
            answer: responseForLocale(
                locale,
                `Te comparto el catalogo: ${catalogMeta.catalogLink || ''}`.trim(),
                `Here is the catalog: ${catalogMeta.catalogLink || ''}`.trim()
            )
        }
    }

    const dates = extractDates(message)
    if (dates.length) {
        const dateStr = dates[0].format('YYYY-MM-DD')
        const endStr = dates[1]?.format('YYYY-MM-DD') || dateStr
        const property = detectProperty(message, catalogProperties)

        if (lower.includes('reserv') || lower.includes('deposit') || lower.includes('anticip')) {
            if (property) {
                const minNights = property.minNights || 1
                const endDate = dates[1]?.format('YYYY-MM-DD') || dates[0].clone().add(minNights, 'days').format('YYYY-MM-DD')
                ensureToolAccess('write', [collectionNames.quintasCalendar])
                const hold = await createHold({
                    propertyId: property.propertyId,
                    start: dateStr,
                    end: endDate,
                    holdHours: restrictions.payment?.holdHours as number | undefined,
                    notes: 'reserva con deposito/anticipo desde chat'
                })

                if (!hold.ok) {
                    return {
                        answer: responseForLocale(
                            locale,
                            'Esas fechas ya no estan disponibles. Te puedo ofrecer alternativas.',
                            'Those dates are no longer available. I can offer alternatives.'
                        )
                    }
                }

                return {
                    answer: responseForLocale(
                        locale,
                        'Listo, genero una reserva con deposito/anticipo por 24 horas. Avisame cuando envies el deposito/anticipo.',
                        'Done, I created a deposit-backed reservation for 24 hours. Let me know once you send the deposit.'
                    ),
                    metadata: {
                        type: 'holdCard',
                        hold: {
                            propertyId: property.propertyId,
                            start: dateStr,
                            end: endDate,
                            holdExpires: hold.holdExpires?.toISOString()
                        }
                    }
                }
            }

            return {
                answer: responseForLocale(
                    locale,
                    'Para reservar necesito la fecha exacta y cual quinta te interesa.',
                    'To reserve I need the exact date and which quinta you want.'
                )
            }
        }

        return buildAvailabilityReply(dateStr, endStr, property, locale)
    }

    if (lower.includes('precio') || lower.includes('tarifa') || lower.includes('costo')) {
        const list = catalogProperties
            .slice(0, 3)
            .map((prop) => `${prop.name || prop.propertyId}: ${formatPrice(prop.basePricePerNight, prop.currency)}`)
        return {
            answer: responseForLocale(locale, `Precios base por noche:\n${list.join('\n\n')}`, `Base nightly prices:\n${list.join('\n\n')}`)
        }
    }

    const summary = catalogMeta.catalogSummary || 'Alquiler de quintas para eventos familiares en Francisco Alvarez.'
    const blockedDatesText = restrictions.blockedDatesText ? ` ${restrictions.blockedDatesText}` : ''
    const availabilityOverview = await buildAvailabilityOverview(30, locale)
    return {
        answer: responseForLocale(
            locale,
            `Hola! Soy el encargado de las ${summary}${blockedDatesText}\n\n${availabilityOverview}\n\nContame fecha, cantidad de personas y si tenes alguna quinta en mente.`,
            `Hi! I'm the manager for ${summary}.${blockedDatesText}\n\n${availabilityOverview}\n\nShare your dates, number of guests, and preferred quinta.`
        )
    }
}

export const handleQuintasChat = async (input: ManualAgentRequest): Promise<ManualAgentResponse> => {
    await ensureQuintasSeed()

    const catalogMeta = await getCatalogMeta()
    const restrictions = await getRestrictions()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const sessionId = input.sessionId || ''
    let lockedLocale = ''

    if (sessionId) {
        const session = await db
            .collection<{ locale?: string }>(collections.manualAgentSessions)
            .findOne({ sessionId, agentId: 'quintas' })
        lockedLocale = session?.locale || ''
    }

    if (!lockedLocale) {
        lockedLocale = detectLocaleFromMessage(input.message || '')
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { locale: lockedLocale, updatedAt: new Date() } }
            )
        }
    }

    if (isGreetingOnly(input.message || '')) {
        const blockedDatesText = restrictions.blockedDatesText ? ` ${restrictions.blockedDatesText}` : ''
        const availabilityOverview = await buildAvailabilityOverview(30, lockedLocale)
        const summary = catalogMeta.catalogSummary || 'Alquiler de quintas para eventos familiares en Francisco Alvarez.'
        return {
            answer: responseForLocale(
                lockedLocale,
                `Hola! Soy el encargado de las ${summary}\n\n${availabilityOverview}\n\n${blockedDatesText ? `${blockedDatesText}\n\n` : ''}Contame fecha, cantidad de personas y si tenes alguna quinta en mente.`,
                `Hi! I'm the manager for ${summary}.\n\n${availabilityOverview}\n\n${blockedDatesText ? `${blockedDatesText}\n\n` : ''}Share your dates, number of guests, and preferred quinta.`
            )
        }
    }

    try {
        return await runLlmFlow(input.message || '', input.sessionId, catalogMeta, restrictions, lockedLocale)
    } catch (_error) {
        return handleQuintasFallback(input, lockedLocale)
    }
}

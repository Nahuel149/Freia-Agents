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

const QUINTAS_FRICTION_THRESHOLD = 2

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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const formatGuestName = (name: string) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/g)
        .filter(Boolean)
    if (!parts.length) return ''
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const getNextWeekday = (base: moment.Moment, targetDay: number, includeToday: boolean) => {
    const currentDay = base.day()
    let delta = (targetDay - currentDay + 7) % 7
    if (delta === 0 && !includeToday) delta = 7
    return base.clone().add(delta, 'day')
}

const parseRelativeDateRange = (message: string) => {
    const text = normalizeText(message || '')
    if (!text) return null
    const timezone = 'America/Argentina/Buenos_Aires'
    const today = moment.tz(timezone).startOf('day')
    const wantsNext = text.includes('proximo') || text.includes('proxima') || text.includes('next')
    const includeToday = !wantsNext
    const isWeekend = text.includes('fin de semana') || text.includes('finde') || text.includes('weekend')
    const isEndOfMonth = text.includes('fin de mes') || text.includes('end of month')
    const hasSaturday = text.includes('sabado') || text.includes('saturday')
    const hasSunday = text.includes('domingo') || text.includes('sunday')

    if (isEndOfMonth) {
        const lastDay = today.clone().endOf('month').startOf('day')
        const start = lastDay.clone().subtract(1, 'day')
        const end = lastDay.clone()
        return { start, end, kind: 'end_of_month' }
    }

    if (isWeekend) {
        let saturday = getNextWeekday(today, 6, includeToday)
        if (today.day() === 0 && includeToday) {
            saturday = getNextWeekday(today.clone().add(1, 'day'), 6, true)
        }
        const start = saturday
        const end = saturday.clone().add(1, 'day')
        return { start, end, kind: 'weekend' }
    }

    if (hasSaturday || hasSunday) {
        const targetDay = hasSaturday ? 6 : 0
        const start = getNextWeekday(today, targetDay, includeToday)
        const end = start.clone()
        return { start, end, kind: hasSaturday ? 'saturday' : 'sunday' }
    }

    return null
}

const appendEscalationPrompt = (answer: string, locale: string) => {
    const prompt =
        locale === 'en-US' ? 'Want me to connect you with a human?' : 'Queres que te pase con un humano?'
    return `${answer}\n\n${prompt}`
}

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

const MONTHS: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
}

const parseShortDate = (day: number, month: number) => {
    const year = moment().year()
    return moment(`${day}/${month}/${year}`, 'DD/MM/YYYY', true)
}

const parseMonthRange = (message: string) => {
    const lower = normalizeText(message || '')
    const monthMatch = Object.keys(MONTHS).find((month) => lower.includes(month))
    if (!monthMatch) return null

    const rangeRegex = new RegExp(
        `(\\d{1,2})\\s*(?:al|to|-)\\s*(\\d{1,2})\\s*(?:de\\s*)?${monthMatch}`
    )
    const singleRegex = new RegExp(`(\\d{1,2})\\s*(?:de\\s*)?${monthMatch}`)

    const range = lower.match(rangeRegex)
    const single = lower.match(singleRegex)
    const startDay = range ? Number(range[1]) : single ? Number(single[1]) : null
    const endDay = range ? Number(range[2]) : startDay
    if (!startDay || !endDay) return null

    const timezone = 'America/Argentina/Buenos_Aires'
    const now = moment.tz(timezone)
    const monthIndex = MONTHS[monthMatch]
    let year = now.year()
    if (monthIndex < now.month() || (monthIndex === now.month() && startDay < now.date())) {
        year += 1
    }

    const start = moment.tz({ year, month: monthIndex, day: startDay }, timezone).format('YYYY-MM-DD')
    const end = moment.tz({ year, month: monthIndex, day: endDay }, timezone).format('YYYY-MM-DD')
    return { start, end }
}

const mentionsMonthWithoutDay = (message: string) => {
    const lower = normalizeText(message || '')
    const monthMatch = Object.keys(MONTHS).find((month) => lower.includes(month))
    if (!monthMatch) return false
    const dayMention = new RegExp(`\\d{1,2}\\s*(?:de\\s*)?${monthMatch}`).test(lower)
    return !dayMention
}

const mentionsDayRangeWithoutMonth = (message: string) => {
    const lower = normalizeText(message || '')
    const hasMonth = Object.keys(MONTHS).some((month) => lower.includes(month))
    if (hasMonth) return false
    if (extractDates(message).length) return false
    return /\b\d{1,2}\s*(?:al|to|-)\s*\d{1,2}\b/.test(lower)
}

const parseDayRange = (message: string) => {
    const lower = normalizeText(message || '')
    const match =
        lower.match(/\b(\d{1,2})\s*(?:al|to)\s*(\d{1,2})\b/) || lower.match(/\b(\d{1,2})\s+-\s+(\d{1,2})\b/)
    if (!match) return null
    const startDay = Number(match[1])
    const endDay = Number(match[2])
    if (!startDay || !endDay) return null
    return { startDay, endDay }
}

const detectMonthInMessage = (message: string) => {
    const lower = normalizeText(message || '')
    for (const month of Object.keys(MONTHS)) {
        const regex = new RegExp(`\\b${month}\\b`)
        if (regex.test(lower)) {
            return { monthIndex: MONTHS[month], month }
        }
    }
    return null
}

const extractEmail = (message: string) => {
    const match = String(message || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return match ? match[0] : ''
}

const extractPhone = (message: string) => {
    const match = String(message || '').match(/(\+?\d[\d\s\-().]{6,}\d)/)
    return match ? match[0].replace(/\s+/g, '') : ''
}

const extractName = (message: string) => {
    const lower = normalizeText(message || '')
    const match = lower.match(/(?:mi nombre es|soy|my name is)\s+([a-z\s]+)(?:,|$)/i)
    if (!match) return ''
    return match[1].trim().replace(/\s+/g, ' ')
}

const findRecentSessionByIdentity = async (params: { sessionId?: string; name?: string; email?: string; phone?: string }) => {
    if (!params.name && !params.email && !params.phone) return null
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('read', [collections.manualAgentSessions])
    const filters: Record<string, unknown>[] = []
    if (params.email) {
        filters.push({ lastEmail: { $regex: `^${escapeRegex(params.email)}$`, $options: 'i' } })
    }
    if (params.phone) {
        filters.push({ lastPhone: params.phone })
    }
    if (params.name) {
        filters.push({ lastName: params.name })
        filters.push({
            messages: {
                $elemMatch: { role: 'user', content: { $regex: new RegExp(`\\b${escapeRegex(params.name)}\\b`, 'i') } }
            }
        })
    }
    if (!filters.length) return null
    const session = await db
        .collection<{
            locale?: string
            lastMonthIndex?: number
            lastYear?: number
            lastRangeStart?: string
            lastRangeEnd?: string
            lastPropertyId?: string
            lastGuests?: number
            lastIntent?: string
            lastVisitDate?: string
            lastVisitPropertyId?: string
            lastVisitTime?: string
            lastVisitPending?: boolean
            lastName?: string
            lastEmail?: string
            lastPhone?: string
            messages?: Array<{ role: string; content: string }>
        }>(collections.manualAgentSessions)
        .find({ agentId: 'quintas', sessionId: { $ne: params.sessionId }, $or: filters })
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray()
    return session[0] || null
}

const hasLeadInfo = (message: string) => {
    return Boolean(extractEmail(message) || extractPhone(message) || extractName(message))
}

const hasReservationIntent = (message: string) => {
    const lower = normalizeText(message || '')
    return ['quiero', 'reserv', 'reserva', 'me interesa', 'me gustaria', 'confirmar', 'avanzar', 'elegi'].some((keyword) =>
        lower.includes(keyword)
    )
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

const isNoAvailabilitySummary = (summary: string) => {
    const normalized = normalizeText(summary || '')
    return (
        normalized.includes('no hay disponibilidad') ||
        normalized.includes('no tenemos disponibilidad') ||
        normalized.includes('sin disponibilidad') ||
        normalized.includes('no availability')
    )
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

const isThanksOnly = (message: string) => {
    const lower = normalizeText(message || '').trim()
    if (!lower) return false
    const thanks = [
        'gracias',
        'muchas gracias',
        'mil gracias',
        'gracias!',
        'thanks',
        'thank you',
        'thx'
    ]
    const hasThanks = thanks.some((word) => lower === word || lower.startsWith(`${word} `))
    if (!hasThanks) return false
    const hasDates = extractDates(message).length > 0
    const hasKeywords = ['dispon', 'precio', 'reserv', 'pago', 'deposito', 'anticipo', 'visita', 'catalogo'].some(
        (keyword) => lower.includes(keyword)
    )
    return !hasDates && !hasKeywords
}

const isDeclineOnly = (message: string) => {
    const lower = normalizeText(message || '').trim()
    if (!lower) return false
    const declinePhrases = [
        'no gracias',
        'no, gracias',
        'no por ahora',
        'no quiero',
        'no quiero reservar',
        'no quiero alquilar',
        'no quiero nada',
        'no me interesa',
        'no estoy interesado',
        'no estoy interesada',
        'no deseo',
        'no voy a reservar',
        'no voy a alquilar',
        'no, esta bien',
        'esta bien, no',
        'esta bien gracias',
        'todo bien, no',
        'no, todo bien',
        'prefiero no',
        'no necesito',
        'no busco'
    ]
    const hasDecline = declinePhrases.some((phrase) => lower.includes(normalizeText(phrase)))
    if (!hasDecline) return false
    const hasDates = extractDates(message).length > 0
    const hasDateSignals = hasDates || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message))
    const hasKeywords = ['dispon', 'precio', 'reserv', 'pago', 'deposito', 'anticipo', 'visita', 'catalogo', 'foto'].some(
        (keyword) => lower.includes(keyword)
    )
    return !hasDateSignals && !hasKeywords
}

const extractDates = (message: string): moment.Moment[] => {
    const tokens: Array<{ raw: string; index: number; kind: 'iso' | 'slash' | 'hyphen' }> = []
    for (const match of message.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
        if (match.index === undefined) continue
        tokens.push({ raw: match[0], index: match.index, kind: 'iso' })
    }
    for (const match of message.matchAll(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g)) {
        if (match.index === undefined) continue
        tokens.push({ raw: match[0], index: match.index, kind: 'slash' })
    }
    for (const match of message.matchAll(/\b\d{1,2}-\d{1,2}\b/g)) {
        if (match.index === undefined) continue
        const index = match.index
        const raw = match[0]
        if (index >= 5 && /\d{4}-/.test(message.slice(index - 5, index))) continue
        const afterIndex = index + raw.length
        if (afterIndex < message.length && message[afterIndex] === '-') continue
        tokens.push({ raw, index, kind: 'hyphen' })
    }
    return tokens
        .sort((a, b) => a.index - b.index)
        .map((token) => {
            if (token.kind === 'iso') {
                return moment(token.raw, 'YYYY-MM-DD', true)
            }
            if (token.kind === 'slash') {
                const parts = token.raw.split('/')
                if (parts.length === 2) {
                    return parseShortDate(Number(parts[0]), Number(parts[1]))
                }
                return moment(token.raw, 'DD/MM/YYYY', true)
            }
            const [day, month] = token.raw.split('-').map((value) => Number(value))
            if (!Number.isFinite(day) || !Number.isFinite(month)) {
                return moment.invalid()
            }
            return parseShortDate(day, month)
        })
        .filter((parsed) => parsed.isValid())
}

const detectProperty = (message: string, properties: CatalogProperty[]) => {
    const lower = normalizeText(message).replace(/\([^)]*\)/g, ' ')
    return properties.find((property) => {
        if (!property.propertyId) return false
        if (lower.includes(normalizeText(property.propertyId))) return true
        if (property.name) {
            const normalizedName = normalizeText(property.name)
            const normalizedSimple = normalizedName.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
            if (lower.includes(normalizedName)) return true
            if (normalizedSimple && lower.includes(normalizedSimple)) return true
        }
        return false
    })
}

const extractGuests = (message: string) => {
    const match = String(message || '').match(/(\d{1,2})\s*(personas|huespedes|hu[ée]spedes|adultos|people|guests)/i)
    if (!match) return undefined
    const value = Number(match[1])
    return Number.isFinite(value) ? value : undefined
}

const extractStayLength = (message: string) => {
    const normalized = normalizeText(message || '')
    const match = normalized.match(/\b(\d{1,2})\s*(dias|noches|days|nights)\b/)
    if (!match) return undefined
    const value = Number(match[1])
    return Number.isFinite(value) ? value : undefined
}

const extractVisitTime = (message: string) => {
    const text = normalizeText(message || '')
    const withPrefix =
        text.match(/(?:a las|a la)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ||
        text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|hs|h)\b/)
    if (!withPrefix) return ''
    const hourRaw = Number(withPrefix[1])
    const minuteRaw = withPrefix[2] ? Number(withPrefix[2]) : 0
    if (!Number.isFinite(hourRaw) || hourRaw > 23 || minuteRaw > 59) return ''
    let hour = hourRaw
    const suffix = withPrefix[3]
    if (suffix === 'pm' && hour < 12) hour += 12
    if (suffix === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${String(minuteRaw).padStart(2, '0')}`
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

const formatBulletList = (items: string[]) => items.join('\n\n')

const formatCatalogOptions = (properties: CatalogProperty[], locale = 'es-AR', limit = 3) => {
    if (!properties.length) return ''
    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const capacityLabel = locale === 'en-US' ? 'capacity' : 'capacidad'
    const lines = properties.slice(0, limit).map((prop) => {
        const name = prop.name || prop.propertyId || 'Quinta'
        const capacity = prop.capacity ? `${capacityLabel} ${prop.capacity}` : ''
        const price = prop.basePricePerNight ? `${formatPrice(prop.basePricePerNight, prop.currency)} ${perNightLabel}` : ''
        const details = [capacity, price].filter(Boolean).join(' - ')
        return `- ${name}${details ? ` - ${details}` : ''}`
    })
    return formatBulletList(lines)
}

const formatAvailabilitySections = (
    available: Array<Record<string, any>>,
    _unavailable: Array<Record<string, any>>,
    locale = 'es-AR',
    includeHeader = true
) => {
    if (!available.length) {
        return responseForLocale(locale, 'No hay disponibilidad para esas fechas.', 'No availability for those dates.')
    }
    const availableLabel = locale === 'en-US' ? 'Available' : 'Disponibles'
    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const minNightsLabel = (minNights?: number) =>
        locale === 'en-US' ? (minNights ? `min ${minNights} nights` : 'minimum nights') : `minimo ${minNights} noches`

    const availableLines = available.map((item) => {
        const name = item.name || item.propertyId || 'Quinta'
        const location = item.location ? ` (${item.location})` : ''
        const price = item.basePricePerNight ? `${formatPrice(item.basePricePerNight, item.currency)} ${perNightLabel}` : ''
        const minNights = item.minNights ? minNightsLabel(item.minNights) : ''
        const details = [price, minNights].filter(Boolean).join(', ')
        return `- ${name}${location}${details ? ` - ${details}` : ''}`
    })

    return includeHeader ? `${availableLabel}:\n${formatBulletList(availableLines)}` : formatBulletList(availableLines)
}

const formatRangeLabel = (start: moment.Moment, end: moment.Moment, locale = 'es-AR') => {
    if (start.isSame(end, 'day')) {
        return start.format('YYYY-MM-DD')
    }
    if (start.isSame(end, 'month')) {
        const monthName = start.locale(locale === 'en-US' ? 'en' : 'es').format('MMMM')
        return locale === 'en-US'
            ? `from ${start.format('D')} to ${end.format('D')} ${monthName}`
            : `del ${start.format('D')} al ${end.format('D')} de ${monthName}`
    }
    return locale === 'en-US'
        ? `from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`
        : `del ${start.format('YYYY-MM-DD')} al ${end.format('YYYY-MM-DD')}`
}

const formatRangeWithYear = (start: moment.Moment, end: moment.Moment, locale = 'es-AR') => {
    const base = formatRangeLabel(start, end, locale)
    const year = start.format('YYYY')
    if (base.includes(year)) return base
    return locale === 'en-US' ? `${base}, ${year}` : `${base} de ${year}`
}

const getMonthWindowFromMessage = (message: string, monthIndex: number, year: number, locale = 'es-AR') => {
    const lower = normalizeText(message || '')
    const timezone = 'America/Argentina/Buenos_Aires'
    const monthStart = moment.tz({ year, month: monthIndex, day: 1 }, timezone).startOf('day')
    const daysInMonth = monthStart.daysInMonth()
    let startDay = 1
    let endDay = daysInMonth
    let label: string | null = null

    if (lower.includes('primera quincena') || lower.includes('primer quincena')) {
        startDay = 1
        endDay = Math.min(15, daysInMonth)
        label = locale === 'en-US' ? 'first half' : 'primera quincena'
    } else if (lower.includes('segunda quincena')) {
        startDay = Math.min(16, daysInMonth)
        endDay = daysInMonth
        label = locale === 'en-US' ? 'second half' : 'segunda quincena'
    } else if (lower.includes('primera semana') || lower.includes('primer semana')) {
        startDay = 1
        endDay = Math.min(7, daysInMonth)
        label = locale === 'en-US' ? 'first week' : 'primera semana'
    } else if (lower.includes('segunda semana')) {
        startDay = Math.min(8, daysInMonth)
        endDay = Math.min(14, daysInMonth)
        label = locale === 'en-US' ? 'second week' : 'segunda semana'
    } else if (lower.includes('tercera semana')) {
        startDay = Math.min(15, daysInMonth)
        endDay = Math.min(21, daysInMonth)
        label = locale === 'en-US' ? 'third week' : 'tercera semana'
    } else if (lower.includes('cuarta semana')) {
        startDay = Math.min(22, daysInMonth)
        endDay = Math.min(28, daysInMonth)
        label = locale === 'en-US' ? 'fourth week' : 'cuarta semana'
    } else if (lower.includes('ultima semana') || lower.includes('ultima')) {
        startDay = Math.max(1, daysInMonth - 6)
        endDay = daysInMonth
        label = locale === 'en-US' ? 'last week' : 'ultima semana'
    } else if (lower.includes('mediados') || lower.includes('mitad')) {
        startDay = Math.min(10, daysInMonth)
        endDay = Math.min(20, daysInMonth)
        label = locale === 'en-US' ? 'mid month' : 'mediados'
    } else if (lower.includes('principio') || lower.includes('inicio') || lower.includes('primeros dias')) {
        startDay = 1
        endDay = Math.min(10, daysInMonth)
        label = locale === 'en-US' ? 'early month' : 'principios'
    } else if (lower.includes('fin de mes') || lower.includes('fines') || lower.includes('finales')) {
        startDay = Math.max(1, daysInMonth - 9)
        endDay = daysInMonth
        label = locale === 'en-US' ? 'end of month' : 'fines'
    }

    const start = monthStart.clone().date(startDay)
    const end = monthStart.clone().date(endDay)
    const monthName = monthStart.locale(locale === 'en-US' ? 'en' : 'es').format('MMMM')
    const rangeLabel = formatRangeLabel(start, end, locale)
    const windowLabel =
        label && locale !== 'en-US'
            ? `${label} de ${monthName}`
            : label && locale === 'en-US'
            ? `${label} of ${monthName}`
            : rangeLabel

    return {
        start,
        end,
        monthStart,
        monthEnd: monthStart.clone().endOf('month'),
        monthName,
        rangeLabel,
        windowLabel,
        isFullMonth: startDay === 1 && endDay === daysInMonth
    }
}

const buildAvailabilitySuggestions = async (
    start: moment.Moment,
    end: moment.Moment,
    locale = 'es-AR',
    maxOptions = 4
) => {
    const properties = await getCatalogProperties()
    if (!properties.length) return [] as string[]
    const years = getAvailabilityYears(start, end)
    const calendarsByProperty = new Map<string, CalendarDoc[]>()

    for (const prop of properties) {
        const docs = await getCalendarDocs(prop.propertyId, years)
        calendarsByProperty.set(prop.propertyId, docs || [])
    }

    const suggestions: Array<{
        property: CatalogProperty
        start: moment.Moment
        end: moment.Moment
        minNights: number
    }> = []

    for (const prop of properties) {
        const calendars = calendarsByProperty.get(prop.propertyId) || []
        const minNights = prop.minNights || 1
        const lastStart = end.clone().subtract(minNights - 1, 'day')
        if (lastStart.isBefore(start, 'day')) continue
        for (let cursor = start.clone(); cursor.isSameOrBefore(lastStart, 'day'); cursor.add(1, 'day')) {
            const candidateEnd = cursor.clone().add(minNights - 1, 'day')
            let blocked = false
            for (const calendar of calendars) {
                if (isRangeBlocked(cursor, candidateEnd, calendar) || hasRangeConflict(cursor, candidateEnd, calendar)) {
                    blocked = true
                    break
                }
            }
            if (!blocked) {
                suggestions.push({ property: prop, start: cursor.clone(), end: candidateEnd, minNights })
                break
            }
        }
    }

    suggestions.sort((a, b) => a.start.valueOf() - b.start.valueOf())
    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const minNightsLabel = (minNights: number) =>
        locale === 'en-US' ? `min ${minNights} nights` : `minimo ${minNights} noches`

    return suggestions.slice(0, maxOptions).map((item) => {
        const name = item.property.name || item.property.propertyId || 'Quinta'
        const location = item.property.location ? ` (${item.property.location})` : ''
        const rangeLabel = formatRangeLabel(item.start, item.end, locale)
        const price = item.property.basePricePerNight
            ? `${formatPrice(item.property.basePricePerNight, item.property.currency)} ${perNightLabel}`
            : ''
        const details = [rangeLabel, price, minNightsLabel(item.minNights)].filter(Boolean).join(' - ')
        return `- ${name}${location} - ${details}`
    })
}

const buildMonthAvailabilitySummary = async (input: {
    message: string
    monthIndex: number
    year: number
    locale: string
}) => {
    const window = getMonthWindowFromMessage(input.message, input.monthIndex, input.year, input.locale)
    const suggestions = await buildAvailabilitySuggestions(window.start, window.end, input.locale, 4)
    if (suggestions.length) {
        return responseForLocale(
            input.locale,
            `Para ${window.windowLabel} tengo:\n${formatBulletList(suggestions)}\n\nSi queres, pasame fechas exactas.`,
            `For ${window.windowLabel} I have:\n${formatBulletList(suggestions)}\n\nShare exact dates if you want.`
        )
    }

    if (!window.isFullMonth) {
        const monthSuggestions = await buildAvailabilitySuggestions(window.monthStart, window.monthEnd, input.locale, 4)
        if (monthSuggestions.length) {
            return responseForLocale(
                input.locale,
                `No tengo disponibilidad en ${window.windowLabel}. En ${window.monthName} tengo:\n${formatBulletList(
                    monthSuggestions
                )}\n\nSi queres, pasame fechas exactas.`,
                `No availability in ${window.windowLabel}. In ${window.monthName} I have:\n${formatBulletList(
                    monthSuggestions
                )}\n\nShare exact dates if you want.`
            )
        }
    }

    const fallbackStart = window.monthEnd.clone().add(1, 'day')
    const fallbackEnd = fallbackStart.clone().add(30, 'days')
    const fallbackSuggestions = await buildAvailabilitySuggestions(fallbackStart, fallbackEnd, input.locale, 3)
    if (fallbackSuggestions.length) {
        return responseForLocale(
            input.locale,
            `En ${window.monthName} no tengo fechas disponibles. Lo mas cercano es:\n${formatBulletList(
                fallbackSuggestions
            )}\n\nSi queres, decime fechas exactas.`,
            `In ${window.monthName} there is no availability. The closest options are:\n${formatBulletList(
                fallbackSuggestions
            )}\n\nShare exact dates if you want.`
        )
    }

    return responseForLocale(
        input.locale,
        `En ${window.monthName} no tengo fechas disponibles. Busco otro mes?`,
        `No availability in ${window.monthName}. Want me to check another month?`
    )
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
        if (availableCount > 0) {
            availableDates.push(dateLabel)
        }
    }

    const availablePreview = availableDates.slice(0, 6)
    if (!availablePreview.length) {
        return responseForLocale(
            locale,
            `No hay disponibilidad para los proximos ${daysWindow} dias.`,
            `No availability for the next ${daysWindow} days.`
        )
    }

    const availableList = formatBulletList(availablePreview.map((date) => `- ${date}`))
    return responseForLocale(
        locale,
        `Disponibles (${daysWindow} dias):\n${availableList}`,
        `Available (${daysWindow} days):\n${availableList}`
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

const findNearbyAvailabilityForLength = async (params: { start: string; days: number; propertyId?: string; maxOffsetDays?: number }) => {
    const startDate = moment(params.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || params.days < 1) return null

    const properties = await getCatalogProperties()
    const filtered = params.propertyId ? properties.filter((prop) => prop.propertyId === params.propertyId) : properties
    if (!filtered.length) return null

    const maxOffset = params.maxOffsetDays ?? 10
    const searchStart = startDate.clone().subtract(maxOffset, 'day')
    const searchEnd = startDate.clone().add(maxOffset + params.days - 1, 'day')
    const years = getAvailabilityYears(searchStart, searchEnd)
    const calendarsByProperty = new Map<string, CalendarDoc[]>()
    for (const prop of filtered) {
        const docs = await getCalendarDocs(prop.propertyId, years)
        calendarsByProperty.set(prop.propertyId, docs || [])
    }

    const today = moment().startOf('day')
    for (let offset = 1; offset <= maxOffset; offset += 1) {
        const candidates = [startDate.clone().subtract(offset, 'day'), startDate.clone().add(offset, 'day')]
        for (const candidateStart of candidates) {
            if (candidateStart.isBefore(today, 'day')) continue
            const candidateEnd = candidateStart.clone().add(params.days - 1, 'day')
            for (const prop of filtered) {
                const minNights = prop.minNights || 1
                if (params.days < minNights) continue
                const calendars = calendarsByProperty.get(prop.propertyId) || []
                let blocked = false
                for (const calendar of calendars) {
                    if (isRangeBlocked(candidateStart, candidateEnd, calendar) || hasRangeConflict(candidateStart, candidateEnd, calendar)) {
                        blocked = true
                        break
                    }
                }
                if (!blocked) {
                    return { start: candidateStart, end: candidateEnd, property: prop }
                }
            }
        }
    }
    return null
}

const buildNearbyAvailabilityMessage = async (params: { start: string; days?: number; propertyId?: string; locale: string }) => {
    if (!params.days) return null
    const suggestion = await findNearbyAvailabilityForLength({
        start: params.start,
        days: params.days,
        propertyId: params.propertyId
    })
    if (!suggestion) return null

    const rangeText = formatRangeWithYear(suggestion.start, suggestion.end, params.locale)
    const propertyName = suggestion.property.name || suggestion.property.propertyId
    const propertyText = params.propertyId ? '' : params.locale === 'en-US' ? ` at ${propertyName}` : ` en ${propertyName}`
    return responseForLocale(
        params.locale,
        `Para ${params.days} dias, tengo disponibilidad ${rangeText}${propertyText}. Te interesa?`,
        `For ${params.days} days, I have availability ${rangeText}${propertyText}. Interested?`
    )
}

const buildMinNightsReply = (params: { start: string; minNights: number; locale: string }) => {
    const startDate = moment(params.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || params.minNights < 1) return ''
    const endDate = startDate.clone().add(params.minNights - 1, 'day')
    const rangeLabel = formatRangeLabel(startDate, endDate, params.locale)
    return responseForLocale(
        params.locale,
        `Para esas fechas el minimo es ${params.minNights} noches. Si queres, puedo revisar ${rangeLabel}. Te sirve?`,
        `The minimum stay is ${params.minNights} nights. I can check ${rangeLabel}. Interested?`
    )
}

const buildAvailabilityReply = async (
    startStr: string,
    endStr: string,
    property?: CatalogProperty,
    locale = 'es-AR',
    requestedDays?: number,
    options?: { includeHeader?: boolean }
) => {
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

    const available = (result as { available?: Array<Record<string, any>> }).available || []
    const unavailable = (result as { unavailable?: Array<Record<string, any>> }).unavailable || []
    if (!available.length) {
        const minNightsBlocked = unavailable.filter((item) => item.reason === 'min_nights')
        if (minNightsBlocked.length && minNightsBlocked.length === unavailable.length) {
            const minNights = Math.max(...minNightsBlocked.map((item) => Number(item.minNights || 0)))
            const minNightsReply = minNights ? buildMinNightsReply({ start: startStr, minNights, locale }) : ''
            if (minNightsReply) {
                return { answer: minNightsReply }
            }
        }
        const suggestion = await buildNearbyAvailabilityMessage({
            start: startStr,
            days: requestedDays,
            propertyId: property?.propertyId,
            locale
        })
        if (suggestion) {
            return { answer: suggestion }
        }
        return { answer: responseForLocale(locale, 'No hay disponibilidad para esas fechas.', 'No availability for those dates.') }
    }

    const includeHeader = options?.includeHeader !== false
    const summary = formatAvailabilitySections(available, unavailable, locale, includeHeader)
    return {
        answer: responseForLocale(
            locale,
            `Para ${rangeLabel} tengo:\n\n${summary}`,
            `For ${rangeLabel}, I have:\n\n${summary}`
        )
    }
}

const buildPropertyInfoAnswer = async (params: {
    property: CatalogProperty
    locale: string
    catalogMeta: CatalogMeta
    start?: string
    end?: string
    requestedDays?: number
}) => {
    const locale = params.locale || 'es-AR'
    const property = params.property
    const name = property.name || property.propertyId || responseForLocale(locale, 'Quinta', 'Property')
    const location = property.location ? ` (${property.location})` : ''
    const capacityLabel = locale === 'en-US' ? 'capacity' : 'capacidad'
    const capacityText = property.capacity ? `${capacityLabel} ${property.capacity}` : ''
    const headerBase = `${name}${location}${capacityText ? ` - ${capacityText}` : ''}`.trim()
    const header = responseForLocale(locale, `Aca va ${headerBase}`, `Here is ${headerBase}`)

    let availabilityLine = responseForLocale(
        locale,
        'Pasame fechas y lo reviso.',
        'Share dates and I will check availability.'
    )
    if (params.start) {
        const startDate = moment(params.start, 'YYYY-MM-DD', true)
        const endDate = moment(params.end || params.start, 'YYYY-MM-DD', true)
        if (!startDate.isValid() || !endDate.isValid()) {
            availabilityLine = responseForLocale(
                locale,
                'No pude validar esas fechas. Pasame el rango exacto.',
                'I could not validate those dates. Share the exact range.'
            )
        } else {
            const availability = await checkAvailability({
                start: params.start,
                end: params.end || params.start,
                propertyId: property.propertyId,
                locale
            })
            if (!availability.ok) {
                availabilityLine = responseForLocale(
                    locale,
                    'No pude validar esas fechas. Pasame el rango exacto.',
                    'I could not validate those dates. Share the exact range.'
                )
            } else {
                const available = (availability as { available?: Array<Record<string, any>> }).available || []
                if (available.length) {
                    const rangeLabel = formatRangeLabel(startDate, endDate, locale)
                    availabilityLine = responseForLocale(
                        locale,
                        `Hay disponibilidad para ${rangeLabel}.`,
                        `There is availability for ${rangeLabel}.`
                    )
                } else {
                    const noAvailability = responseForLocale(
                        locale,
                        'No hay disponibilidad para esas fechas.',
                        'No availability for those dates.'
                    )
                    const suggestion = await buildNearbyAvailabilityMessage({
                        start: params.start,
                        days: params.requestedDays,
                        propertyId: property.propertyId,
                        locale
                    })
                    availabilityLine = suggestion ? `${noAvailability} ${suggestion}` : noAvailability
                }
            }
        }
    }

    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const priceText = property.basePricePerNight
        ? responseForLocale(
              locale,
              `Costo base: ${formatPrice(property.basePricePerNight, property.currency)} ${perNightLabel}. El total depende de fechas y noches.`,
              `Base cost: ${formatPrice(property.basePricePerNight, property.currency)} ${perNightLabel}. Total depends on dates and nights.`
          )
        : responseForLocale(
              locale,
              'Costo: a confirmar. Pasame fechas para cotizar.',
              'Cost: to be confirmed. Share dates for a quote.'
          )

    const amenitiesSource =
        (property.amenities && property.amenities.length ? property.amenities : params.catalogMeta.generalAmenities) || []
    const amenities = amenitiesSource.slice(0, 6).map((amenity) => String(amenity || '').replace(/^-\\s*/, '').trim()).filter(Boolean)
    const hasMoreAmenities = amenitiesSource.length > amenities.length

    const bulletLines: string[] = [`- ${availabilityLine}`, `- ${priceText}`]
    if (typeof property.restrictions?.airConditioning === 'boolean') {
        bulletLines.push(
            `- ${locale === 'en-US' ? 'Air conditioning' : 'Aire acondicionado'}: ${
                property.restrictions.airConditioning ? (locale === 'en-US' ? 'yes' : 'si') : locale === 'en-US' ? 'no' : 'no'
            }`
        )
    }
    if (amenities.length) {
        bulletLines.push(`- ${locale === 'en-US' ? 'Amenities:' : 'Comodidades:'}`)
        bulletLines.push(...amenities.map((amenity) => `- ${amenity}`))
        if (hasMoreAmenities) {
            bulletLines.push(`- ${locale === 'en-US' ? 'and more' : 'y mas'}`)
        }
    } else {
        bulletLines.push(`- ${locale === 'en-US' ? 'Amenities: to be confirmed.' : 'Comodidades: a confirmar.'}`)
    }

    return `${header}\n\n${formatBulletList(bulletLines)}`
}

const buildQuintasInfoSummary = (params: {
    catalogMeta: CatalogMeta
    properties: CatalogProperty[]
    locale: string
    availabilityText?: string
}) => {
    const locale = params.locale || 'es-AR'
    const availabilityLine =
        params.availabilityText ||
        responseForLocale(
            locale,
            'Pasame fechas y lo reviso.',
            'Share dates and I will check availability.'
        )
    const options = params.availabilityText ? '' : formatCatalogOptions(params.properties, locale, 3)
    const optionsBlock = options
        ? responseForLocale(locale, `Quintas:\n${options}`, `Properties:\n${options}`)
        : params.availabilityText
        ? ''
        : responseForLocale(locale, 'No tengo quintas cargadas.', 'No properties loaded.')

    const amenitiesSource = params.catalogMeta.generalAmenities || []
    const amenitiesBlock = amenitiesSource.length
        ? responseForLocale(
              locale,
              `Comodidades comunes:\n${formatBulletList(amenitiesSource.slice(0, 6).map((amenity) => `- ${amenity}`))}`,
              `Common amenities:\n${formatBulletList(amenitiesSource.slice(0, 6).map((amenity) => `- ${amenity}`))}`
          )
        : responseForLocale(locale, 'Comodidades: a confirmar.', 'Amenities: to be confirmed.')

    const pricingLine = responseForLocale(
        locale,
        'Costos: los precios base estan arriba. El total depende de fechas y noches.',
        'Costs: base prices are above. The total depends on dates and nights.'
    )
    const promptLine = responseForLocale(
        locale,
        'Decime cual te interesa y lo vemos.',
        'Tell me which property you want and I will confirm.'
    )

    return [availabilityLine, optionsBlock, amenitiesBlock, pricingLine, promptLine].filter(Boolean).join('\n\n')
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
    const transferText = buildTransferText(transferParts, locale)

    return responseForLocale(
        locale,
        `El deposito/anticipo es del ${depositPct}% y debe acreditarse dentro de ${deadlineHours} horas. El pago total es ${fullPaymentDays} dias antes. Medios: ${methods}.${transferText}`,
        `The deposit is ${depositPct}% and must be paid within ${deadlineHours} hours. Full payment is due ${fullPaymentDays} days before check-in. Methods: ${methods}.${transferText}`
    )
}

const buildTransferText = (transferParts: string[], locale = 'es-AR') => {
    if (!transferParts.length) return ''
    return responseForLocale(
        locale,
        `\n\nDatos para la transferencia bancaria:\n${formatBulletList(transferParts.map((part) => `- ${part}`))}`,
        `\n\nBank transfer details:\n${formatBulletList(transferParts.map((part) => `- ${part}`))}`
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
        '- Al confirmar una reserva, informa total, deposito, vencimiento y usa los datos de transferencia si estan disponibles.',
        '- Antes de afirmar disponibilidad, llama check_availability y usa sus resultados.',
        '- No contradigas disponibilidad ya informada en la misma conversacion, salvo que check_availability lo indique y lo aclares.',
        '- Cuando respondas disponibilidad, si no hay cupo deci "No hay disponibilidad para esas fechas". Si hay disponibilidad, lista solo las opciones disponibles.',
        '- Si consultan por quintas, comodidades o costos, inclui disponibilidad (o pedi fechas), comodidades y costo base o como cotizar.',
        '- Para catalogo o listas de quintas, usa vinetas y separa cada opcion con una linea en blanco.',
        '- Tono: cercano, natural y humano. Responde en 1-3 frases cortas salvo cuando listes opciones.',
        '- Usa confirmaciones cortas tipo "dale" u "ok" cuando aplique.',
        '- Si piden X dias/noches y no hay disponibilidad exacta, ofrece un rango cercano con esa duracion.',
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
    locale: string,
    sessionMessages?: Array<{ role: string; content: string }>
): Promise<ManualAgentResponse> => {
    const apiKey = getManualAgentOpenAIKey()
    if (!apiKey) {
        throw new Error('OpenAI key missing')
    }

    const openai = new OpenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(catalogMeta, restrictions)
    const fallbackAnswer = responseForLocale(
        locale,
        'Perdon, no pude procesar eso.',
        'Sorry, I could not process that.'
    )

    let historySource = sessionMessages
    if (!historySource) {
        const db = await getManualAgentsDb()
        const collections = collectionNames
        ensureToolAccess('read', [collections.manualAgentSessions])
        const session = await db
            .collection<{ messages?: Array<{ role: string; content: string }> }>(collections.manualAgentSessions)
            .findOne({ sessionId, agentId: 'quintas' })
        historySource = session?.messages || []
    }

    const history = (historySource || [])
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
            let answer = (assistant.content || '').trim() || fallbackAnswer
            if (locale === 'es-AR' && isLikelyEnglish(answer)) {
                if (availabilitySummary) {
                    const rangeLabel =
                        availabilityRange?.start && availabilityRange?.end && availabilityRange.start !== availabilityRange.end
                            ? `${availabilityRange.start} al ${availabilityRange.end}`
                            : availabilityRange?.start || ''
                    if (isNoAvailabilitySummary(availabilitySummary)) {
                        answer = availabilitySummary
                    } else {
                        const intro = rangeLabel ? `Disponibilidad para ${rangeLabel}:\n\n` : ''
                        answer = `${intro}${availabilitySummary}\n\nSi queres, te paso mas opciones.`
                    }
                } else {
                    answer =
                        responseForLocale(
                            locale,
                            'Perdon, me repetis la consulta con la fecha exacta?',
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

    return { answer: fallbackAnswer, metadata }
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
    const requestedDays = extractStayLength(message)

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
                'Perdon, solo puedo ayudar con quintas (disponibilidad, precios, reservas, pagos o visitas). Decime fechas y cantidad de personas y te ayudo.',
                'Sorry, I can only help with quintas (availability, prices, reservations, payments or visits). Share your dates and number of guests and I will help.'
            )
        }
    }

    const propertyInfoKeywords = [
        'comod',
        'amenit',
        'servicio',
        'precio',
        'tarifa',
        'costo',
        'costos',
        'capacidad',
        'ubicacion',
        'direccion',
        'detalle',
        'info',
        'incluye',
        'pileta',
        'parrilla',
        'quincho'
    ]
    const mentionsAirConditioning = lower.includes('aire') && lower.includes('acond')
    const otherIntentKeywords = [
        'pago',
        'deposito',
        'anticipo',
        'visita',
        'musica',
        'seguro',
        'lluvia',
        'descuento',
        'transferencia',
        'cbu',
        'alias',
        'banco'
    ]
    const hasOtherIntent = otherIntentKeywords.some((keyword) => lower.includes(keyword))
    const generalQuintasQuery = (lower.includes('quinta') || lower.includes('quintas')) && !hasOtherIntent
    const wantsPropertyInfo =
        propertyInfoKeywords.some((keyword) => lower.includes(keyword)) ||
        mentionsAirConditioning ||
        generalQuintasQuery
    if (wantsPropertyInfo) {
        const property = detectProperty(message, catalogProperties)
        const dates = extractDates(message)
        const monthRange = parseMonthRange(message)
        const start =
            dates[0]?.format('YYYY-MM-DD') ||
            (monthRange?.start ? String(monthRange.start) : undefined)
        const end =
            dates[1]?.format('YYYY-MM-DD') ||
            (dates[0] && requestedDays ? dates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : start) ||
            (monthRange?.end ? String(monthRange.end) : undefined)
        if (property) {
            return {
                answer: await buildPropertyInfoAnswer({
                    property,
                    locale,
                    catalogMeta,
                    start,
                    end,
                    requestedDays
                })
            }
        }
        return {
            answer: buildQuintasInfoSummary({
                catalogMeta,
                properties: catalogProperties,
                locale,
                availabilityText:
                    start && end ? (await buildAvailabilityReply(start, end, undefined, locale, requestedDays)).answer : undefined
            })
        }
    }

    if (lower.includes('seguro') || lower.includes('lluvia')) {
        return {
            answer: responseForLocale(
                locale,
                'No tenemos seguro de lluvia. Si queres, ofrecemos carpa opcional y ventiladores.',
                'We do not offer rain insurance. If you want, we can offer an optional tent and fans.'
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
                'Los descuentos son para clientes habituales. Si ya alquilaste antes, avisame y lo reviso.',
                'Discounts are for returning customers. If you have rented with us before, tell me and I will check.'
            )
        }
    }

    if (lower.includes('catalogo')) {
        const catalogOptions = formatCatalogOptions(catalogProperties, locale, 3)
        const optionsText = catalogOptions
            ? responseForLocale(locale, `\n\nOpciones:\n${catalogOptions}`, `\n\nOptions:\n${catalogOptions}`)
            : ''
        return {
            answer: responseForLocale(
                locale,
                `Aca tenes el catalogo: ${catalogMeta.catalogLink || ''}`.trim() + optionsText,
                `Here is the catalog: ${catalogMeta.catalogLink || ''}`.trim() + optionsText
            )
        }
    }

    const dates = extractDates(message)
    if (dates.length) {
        const dateStr = dates[0].format('YYYY-MM-DD')
        const endStr = dates[1]?.format('YYYY-MM-DD') || (requestedDays ? dates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : dateStr)
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
                    const suggestion = await buildNearbyAvailabilityMessage({
                        start: dateStr,
                        days: requestedDays,
                        propertyId: property.propertyId,
                        locale
                    })
                    if (suggestion) {
                        return { answer: suggestion }
                    }
                    return {
                        answer: responseForLocale(
                            locale,
                            'Esas fechas ya no estan disponibles. Te puedo ofrecer alternativas.',
                            'Those dates are no longer available. I can offer alternatives.'
                        )
                    }
                }

                const nights = Math.max(moment(endDate).diff(moment(dateStr), 'days'), 1)
                const pricePerNight = property.basePricePerNight
                const currency = property.currency || 'USD'
                const totalAmount =
                    typeof pricePerNight === 'number' && Number.isFinite(pricePerNight)
                        ? Number((pricePerNight * nights).toFixed(2))
                        : undefined
                const depositPct = restrictions.payment?.depositPct ?? 0
                const depositAmount = typeof totalAmount === 'number' ? Number(((totalAmount * depositPct) / 100).toFixed(2)) : undefined
                const deadlineHours = restrictions.payment?.depositDeadlineHours ?? 0
                const fullPaymentDays = restrictions.payment?.fullPaymentDaysBefore ?? 0
                const transfer = restrictions.payment?.bankTransfer || {}
                const transferParts = [
                    transfer.accountName ? `${locale === 'en-US' ? 'Account name' : 'Titular'}: ${transfer.accountName}` : '',
                    transfer.bank ? `${locale === 'en-US' ? 'Bank' : 'Banco'}: ${transfer.bank}` : '',
                    transfer.cbu ? `CBU: ${transfer.cbu}` : '',
                    transfer.alias ? `${locale === 'en-US' ? 'Alias' : 'Alias'}: ${transfer.alias}` : '',
                    transfer.concept ? `${locale === 'en-US' ? 'Concept' : 'Concepto'}: ${transfer.concept}` : ''
                ].filter(Boolean)
                const transferText = transferParts.length
                    ? buildTransferText(transferParts, locale)
                    : responseForLocale(
                          locale,
                          '\n\nPara realizar la transferencia bancaria, un humano te enviara los datos oficiales.',
                          '\n\nFor bank transfer details, a human will send the official information.'
                      )

                return {
                    answer: responseForLocale(
                        locale,
                        `Listo, te reservo por 24h.\n` +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'a confirmar'}.\n` +
                            `Deposito (${depositPct}%): ${
                                typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'a confirmar'
                            } (vence en ${deadlineHours}h).\n` +
                            `Pago total ${fullPaymentDays} dias antes.${transferText}\n\n` +
                            'Cuando tengas el comprobante, adjuntalo por aca y confirmo la reserva.',
                        `Done, I reserved it for 24h.\n` +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'to be confirmed'}.\n` +
                            `Deposit (${depositPct}%): ${
                                typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'to be confirmed'
                            } (due in ${deadlineHours}h).\n` +
                            `Full payment is due ${fullPaymentDays} days before arrival.${transferText}\n\n` +
                            'Once you have the deposit proof, attach it here and I will confirm the reservation.'
                    ),
                    metadata: {
                        type: 'holdCard',
                        hold: {
                            propertyId: property.propertyId,
                            start: dateStr,
                            end: endDate,
                            holdExpires: hold.holdExpires?.toISOString(),
                            nights,
                            pricePerNight,
                            currency,
                            totalAmount,
                            depositPct,
                            depositAmount
                        }
                    }
                }
            }

            return {
                answer: responseForLocale(
                    locale,
                    'Dale, para reservar necesito la fecha exacta y la quinta que te interesa.',
                    'To reserve I need the exact date and which quinta you want.'
                )
            }
        }

        return buildAvailabilityReply(dateStr, endStr, property, locale, requestedDays)
    }

    if (lower.includes('precio') || lower.includes('tarifa') || lower.includes('costo')) {
        const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
        const list = catalogProperties.slice(0, 3).map((prop) => {
            const name = prop.name || prop.propertyId || 'Quinta'
            const price = `${formatPrice(prop.basePricePerNight, prop.currency)} ${perNightLabel}`
            return `- ${name}: ${price}`
        })
        return {
            answer: responseForLocale(
                locale,
                `Aca tenes precios base por noche:\n${formatBulletList(list)}`,
                `Base nightly prices:\n${formatBulletList(list)}`
            )
        }
    }

    const summary = catalogMeta.catalogSummary || 'Alquiler de quintas para eventos familiares en Francisco Alvarez.'
    const blockedDatesText = restrictions.blockedDatesText ? `Nota: ${restrictions.blockedDatesText}` : ''
    return {
        answer: responseForLocale(
            locale,
            `Hola! Soy el encargado de ${summary}.\n${blockedDatesText ? `${blockedDatesText}\n` : ''}Contame fechas, cantidad de personas y la quinta que te interesa.`,
            `Hi! I'm the manager for ${summary}.\n${blockedDatesText ? `${blockedDatesText}\n` : ''}Share your dates, number of guests, and the quinta you want.`
        )
    }
}

export const handleQuintasChat = async (input: ManualAgentRequest): Promise<ManualAgentResponse> => {
    await ensureQuintasSeed()

    const catalogMeta = await getCatalogMeta()
    const restrictions = await getRestrictions()
    const catalogProperties = await getCatalogProperties()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const sessionId = input.sessionId || ''
    let lockedLocale = ''
    let lastMonthIndex: number | undefined
    let lastYear: number | undefined
    let lastRangeStart: string | undefined
    let lastRangeEnd: string | undefined
    let lastPropertyId: string | undefined
    let lastGuests: number | undefined
    let lastIntent: string | undefined
    let lastName: string | undefined
    let nameUseCount: number | undefined
    let frictionCount: number | undefined
    let lastReplyKind: string | undefined
    let lastIntentSummary: string | undefined
    let pendingDateConfirm: boolean | undefined
    let lastVisitDate: string | undefined
    let lastVisitPropertyId: string | undefined
    let lastVisitTime: string | undefined
    let lastVisitPending: boolean | undefined
    let sessionMessages: Array<{ role: string; content: string }> = []

    if (sessionId) {
        const session = await db
            .collection<{
                locale?: string
                lastMonthIndex?: number
                lastYear?: number
                lastRangeStart?: string
                lastRangeEnd?: string
                lastPropertyId?: string
                lastGuests?: number
                lastIntent?: string
                lastName?: string
                nameUseCount?: number
                frictionCount?: number
                lastReplyKind?: string
                lastIntentSummary?: string
                pendingDateConfirm?: boolean
                lastVisitDate?: string
                lastVisitPropertyId?: string
                lastVisitTime?: string
                lastVisitPending?: boolean
                messages?: Array<{ role: string; content: string }>
            }>(collections.manualAgentSessions)
            .findOne({ sessionId, agentId: 'quintas' })
        lockedLocale = session?.locale || ''
        lastMonthIndex = session?.lastMonthIndex
        lastYear = session?.lastYear
        lastRangeStart = session?.lastRangeStart
        lastRangeEnd = session?.lastRangeEnd
        lastPropertyId = session?.lastPropertyId
        lastGuests = session?.lastGuests
        lastIntent = session?.lastIntent
        lastName = session?.lastName
        nameUseCount = session?.nameUseCount
        frictionCount = session?.frictionCount
        lastReplyKind = session?.lastReplyKind
        lastIntentSummary = session?.lastIntentSummary
        pendingDateConfirm = session?.pendingDateConfirm
        lastVisitDate = session?.lastVisitDate
        lastVisitPropertyId = session?.lastVisitPropertyId
        lastVisitTime = session?.lastVisitTime
        lastVisitPending = session?.lastVisitPending
        sessionMessages = session?.messages || []
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

    const message = input.message || ''
    const detectedName = extractName(message)
    const detectedEmail = extractEmail(message)
    const detectedPhone = extractPhone(message)
    if (sessionId && (detectedName || detectedEmail || detectedPhone)) {
        const identityUpdate: Record<string, any> = { updatedAt: new Date() }
        if (detectedName) identityUpdate.lastName = detectedName
        if (detectedEmail) identityUpdate.lastEmail = detectedEmail.toLowerCase()
        if (detectedPhone) identityUpdate.lastPhone = detectedPhone
        await db.collection(collections.manualAgentSessions).updateOne(
            { sessionId, agentId: 'quintas' },
            { $set: identityUpdate }
        )
    }
    if (detectedName) {
        lastName = detectedName
    }

    const detectedProperty = detectProperty(input.message || '', catalogProperties)
    if (detectedProperty) {
        lastPropertyId = detectedProperty.propertyId
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastPropertyId, updatedAt: new Date() } }
            )
        }
    }

    const detectedGuests = extractGuests(input.message || '')
    if (typeof detectedGuests === 'number') {
        lastGuests = detectedGuests
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastGuests, updatedAt: new Date() } }
            )
        }
    }

    const respondWith = async (
        response: ManualAgentResponse,
        options?: { replyKind?: string; intentSummary?: string; frictionAction?: 'increase' | 'reset'; pendingDateConfirm?: boolean }
    ) => {
        let answer = response.answer || ''
        const updates: Record<string, any> = {}

        const name = lastName || ''
        if (name) {
            const formatted = formatGuestName(name)
            const currentCount = Number(nameUseCount || 0)
            const nextCount = currentCount + 1
            nameUseCount = nextCount
            updates.nameUseCount = nextCount
            const shouldUse = nextCount % 3 === 1
            if (formatted && shouldUse && !normalizeText(answer).startsWith(normalizeText(formatted))) {
                answer = `${formatted}, ${answer}`
            }
        }

        if (options?.replyKind) {
            lastReplyKind = options.replyKind
            updates.lastReplyKind = lastReplyKind
        }
        if (options?.intentSummary) {
            lastIntentSummary = options.intentSummary
            updates.lastIntentSummary = lastIntentSummary
        }
        if (options?.pendingDateConfirm !== undefined) {
            pendingDateConfirm = options.pendingDateConfirm
            updates.pendingDateConfirm = pendingDateConfirm
        }

        if (options?.frictionAction) {
            const currentCount = Number(frictionCount || 0)
            const nextCount = options.frictionAction === 'reset' ? 0 : currentCount + 1
            frictionCount = nextCount
            updates.frictionCount = nextCount
            if (options.frictionAction === 'increase' && nextCount >= QUINTAS_FRICTION_THRESHOLD) {
                answer = appendEscalationPrompt(answer, lockedLocale)
            }
        }

        if (sessionId && Object.keys(updates).length) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { ...updates, updatedAt: new Date() } }
            )
        }

        return { ...response, answer }
    }

    const respond = async (
        answer: string,
        metadata?: ManualAgentResponse['metadata'],
        options?: { replyKind?: string; intentSummary?: string; frictionAction?: 'increase' | 'reset'; pendingDateConfirm?: boolean }
    ) => {
        return respondWith({ answer, metadata }, options)
    }

    const lower = normalizeText(message)
    const requestedDays = extractStayLength(message)
    const hasVisitKeyword = ['visita', 'ver la quinta', 'ver antes', 'conocer', 'recorrer', 'visitar'].some((keyword) =>
        lower.includes(normalizeText(keyword))
    )
    const rentIntent = ['alquilar', 'alquiler', 'reserv', 'disponibilidad', 'precio', 'tarifa'].some((keyword) => lower.includes(keyword))
    const detectedVisitTime = extractVisitTime(input.message || '')
    const hasVisitTime = Boolean(detectedVisitTime)
    const explicitDates = extractDates(input.message || '')
    const hasDates = explicitDates.length > 0
    const monthRange = parseMonthRange(input.message || '')
    const dayRange = parseDayRange(input.message || '')
    const relativeRange = !hasDates && !monthRange && !dayRange ? parseRelativeDateRange(input.message || '') : null
    const hasDateSignals = hasDates || Boolean(monthRange) || Boolean(dayRange) || Boolean(relativeRange)
    const hadVisitContext = Boolean(lastVisitPending || lastIntent === 'visit')
    const shortAckPhrases = ['ok', 'dale', 'si', 'por favor', 'ok por favor', 'okey', 'okey dale', 'ok dale']
    const shortNoPhrases = ['no', 'no gracias', 'no, gracias', 'no por ahora', 'no, por ahora']
    const isShortAck = shortAckPhrases.includes(lower)
    const isShortNo = shortNoPhrases.includes(lower)

    if (pendingDateConfirm && hasDates) {
        pendingDateConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingDateConfirm: false, updatedAt: new Date() } }
            )
        }
    }

    const buildAckReply = (intentSummary?: string) => {
        if (!intentSummary) return ''
        if (intentSummary === 'awaiting_dates') {
            return responseForLocale(lockedLocale, 'Pasame las fechas exactas.', 'Share the exact dates you want.')
        }
        if (intentSummary === 'awaiting_property') {
            return responseForLocale(lockedLocale, 'Decime que quinta te interesa.', 'Which property interests you?')
        }
        if (intentSummary === 'availability_options') {
            return responseForLocale(lockedLocale, 'Decime cual queres reservar.', 'Which option do you want to book?')
        }
        if (intentSummary === 'awaiting_contact') {
            return responseForLocale(
                lockedLocale,
                'Pasame tu nombre y un telefono o email.',
                'Share your name and a phone or email.'
            )
        }
        if (intentSummary === 'awaiting_visit') {
            return responseForLocale(lockedLocale, 'Decime dia y horario para la visita.', 'Share day and time for the visit.')
        }
        return ''
    }

    const shortAckReply = isShortAck ? buildAckReply(lastIntentSummary) : ''

    if (pendingDateConfirm && isShortNo && !hasDates) {
        pendingDateConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingDateConfirm: false, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(lockedLocale, 'Dale, pasame las fechas exactas.', 'Ok, share the exact dates you want.'),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'increase', pendingDateConfirm: false }
        )
    }

    if (pendingDateConfirm && isShortAck && !hasDates && lastRangeStart && lastRangeEnd) {
        pendingDateConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingDateConfirm: false, updatedAt: new Date() } }
            )
        }
        const property = lastPropertyId ? catalogProperties.find((item) => item.propertyId === lastPropertyId) : undefined
        const reply = await buildAvailabilityReply(lastRangeStart, lastRangeEnd, property, lockedLocale, requestedDays, {
            includeHeader: lastReplyKind !== 'availability'
        })
        const negativeAvailability =
            isNoAvailabilitySummary(reply.answer || '') ||
            normalizeText(reply.answer || '').includes('minimo es') ||
            normalizeText(reply.answer || '').includes('minimum stay')
        return respondWith(reply, {
            replyKind: 'availability',
            intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
            frictionAction: 'reset',
            pendingDateConfirm: false
        })
    }

    if (relativeRange && !hasDates && !monthRange && !dayRange) {
        const start = relativeRange.start.format('YYYY-MM-DD')
        const end = relativeRange.end.format('YYYY-MM-DD')
        lastRangeStart = start
        lastRangeEnd = end
        pendingDateConfirm = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastRangeStart: start, lastRangeEnd: end, pendingDateConfirm: true, updatedAt: new Date() } }
            )
        }
        const rangeLabel = formatRangeWithYear(relativeRange.start, relativeRange.end, lockedLocale)
        const answer = responseForLocale(lockedLocale, `Te referis a ${rangeLabel}?`, `Did you mean ${rangeLabel}?`)
        return respond(answer, undefined, { intentSummary: 'confirm_dates', frictionAction: 'increase', pendingDateConfirm: true })
    }

    if (
        shortAckReply &&
        !hasDateSignals &&
        !detectedProperty &&
        !hasVisitKeyword &&
        !hasVisitTime &&
        !detectedName &&
        !detectedEmail &&
        !detectedPhone
    ) {
        return respond(shortAckReply)
    }

    let restoredMessages: Array<{ role: string; content: string }> | null = null
    if (!hasDates && (detectedName || detectedEmail || detectedPhone) && (!lastRangeStart || !lastRangeEnd)) {
        const restoredSession = await findRecentSessionByIdentity({
            sessionId,
            name: detectedName || undefined,
            email: detectedEmail || undefined,
            phone: detectedPhone || undefined
        })
        if (restoredSession) {
            const restorePayload: Record<string, any> = {}
            if (!lastRangeStart && restoredSession.lastRangeStart) {
                lastRangeStart = restoredSession.lastRangeStart
                restorePayload.lastRangeStart = lastRangeStart
            }
            if (!lastRangeEnd && restoredSession.lastRangeEnd) {
                lastRangeEnd = restoredSession.lastRangeEnd
                restorePayload.lastRangeEnd = lastRangeEnd
            }
            if (typeof lastMonthIndex !== 'number' && typeof restoredSession.lastMonthIndex === 'number') {
                lastMonthIndex = restoredSession.lastMonthIndex
                restorePayload.lastMonthIndex = lastMonthIndex
            }
            if (!lastYear && restoredSession.lastYear) {
                lastYear = restoredSession.lastYear
                restorePayload.lastYear = lastYear
            }
            if (!lastPropertyId && restoredSession.lastPropertyId) {
                lastPropertyId = restoredSession.lastPropertyId
                restorePayload.lastPropertyId = lastPropertyId
            }
            if (typeof lastGuests !== 'number' && typeof restoredSession.lastGuests === 'number') {
                lastGuests = restoredSession.lastGuests
                restorePayload.lastGuests = lastGuests
            }
            if (!lastName && restoredSession.lastName) {
                lastName = restoredSession.lastName
                restorePayload.lastName = lastName
            }
            if (Object.keys(restorePayload).length && sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { ...restorePayload, updatedAt: new Date() } }
                )
            }
            if (restoredSession.messages?.length) {
                restoredMessages = restoredSession.messages
            }
        }
    }

    if (restoredMessages?.length) {
        sessionMessages = [...restoredMessages, ...sessionMessages]
    }

    const shouldStoreVisitTime = Boolean(detectedVisitTime && (hadVisitContext || hasVisitKeyword))
    if (shouldStoreVisitTime) {
        lastVisitTime = detectedVisitTime
        lastVisitPending = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitTime: detectedVisitTime, lastVisitPending: true, updatedAt: new Date() } }
            )
        }
    }
    if (hasVisitKeyword) {
        lastVisitPending = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPending: true, updatedAt: new Date() } }
            )
        }
    }

    if (rentIntent) {
        lastVisitPending = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPending: false, updatedAt: new Date() } }
            )
        }
    }

    const visitContext = Boolean(lastVisitPending || lastIntent === 'visit')
    const visitIntent = hasVisitKeyword || (hasVisitTime && visitContext) || (visitContext && !rentIntent && hasDateSignals)
    const visitOnly = visitIntent && !rentIntent
    if (sessionId && (visitIntent || rentIntent)) {
        const nextIntent = hasVisitKeyword && !rentIntent ? 'visit' : rentIntent ? 'rent' : lastIntent
        if (nextIntent && nextIntent !== lastIntent) {
            lastIntent = nextIntent
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastIntent, updatedAt: new Date() } }
            )
        }
    }

    const detectedMonth = detectMonthInMessage(input.message || '')
    if (detectedMonth && sessionId) {
        const timezone = 'America/Argentina/Buenos_Aires'
        const now = moment.tz(timezone)
        let year = now.year()
        if (detectedMonth.monthIndex < now.month()) {
            year += 1
        }
        lastMonthIndex = detectedMonth.monthIndex
        lastYear = year
        await db.collection(collections.manualAgentSessions).updateOne(
            { sessionId, agentId: 'quintas' },
            { $set: { lastMonthIndex, lastYear, updatedAt: new Date() } }
        )
    }

    if (isThanksOnly(input.message || '')) {
        return respond(
            responseForLocale(lockedLocale, 'De nada, cualquier cosa avisame.', "You're welcome. If you need anything else, I'm here."),
            undefined,
            { frictionAction: 'reset' }
        )
    }

    if (isDeclineOnly(input.message || '')) {
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastIntent: 'none', lastVisitPending: false, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                'Todo bien, gracias. Si queres retomar despues, estoy aca.',
                "All good, thanks. If you want to resume later, I'm here."
            ),
            undefined,
            { frictionAction: 'reset' }
        )
    }

    if (isGreetingOnly(input.message || '')) {
        const blockedDatesText = restrictions.blockedDatesText ? `Nota: ${restrictions.blockedDatesText}` : ''
        const summary = catalogMeta.catalogSummary || 'Alquiler de quintas para eventos familiares en Francisco Alvarez.'
        return respond(
            responseForLocale(
                lockedLocale,
                `Hola! Soy el encargado de ${summary}.\n${blockedDatesText ? `${blockedDatesText}\n` : ''}Contame fechas, cantidad de personas y la quinta que te interesa.`,
                `Hi! I'm the manager for ${summary}.\n${blockedDatesText ? `${blockedDatesText}\n` : ''}Share your dates, number of guests, and the quinta you want.`
            ),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'reset' }
        )
    }

    if (monthRange) {
        const property = detectProperty(input.message || '', catalogProperties)
        if (visitOnly) {
            const visitProperty = property || catalogProperties.find((item) => item.propertyId === lastVisitPropertyId)
            const visitPropertyName = visitProperty?.name || visitProperty?.propertyId
            const visitTime = detectedVisitTime || lastVisitTime
            lastVisitDate = monthRange.start
            if (visitProperty?.propertyId) {
                lastVisitPropertyId = visitProperty.propertyId
            }
            if (sessionId) {
                const visitSet: Record<string, any> = {
                    lastVisitDate: monthRange.start,
                    lastVisitPending: true,
                    updatedAt: new Date()
                }
                if (visitProperty?.propertyId) {
                    visitSet.lastVisitPropertyId = visitProperty.propertyId
                }
                await db.collection(collections.manualAgentSessions).updateOne({ sessionId, agentId: 'quintas' }, { $set: visitSet })
            }
            if (visitTime && visitPropertyName) {
                if (sessionId) {
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: { lastVisitPending: false, updatedAt: new Date() } }
                    )
                }
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Queda agendada la visita para el ${monthRange.start} a las ${visitTime} en ${visitPropertyName}.\n\nPara coordinarte ese dia, pasame tu nombre y telefono de contacto.`,
                        `Your visit is scheduled for ${monthRange.start} at ${visitTime} in ${visitPropertyName}.\n\nPlease share your name and phone number to coordinate the visit.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
                )
            }
            if (visitTime && !visitPropertyName) {
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Podemos coordinar una visita el ${monthRange.start} a las ${visitTime}. Decime que quinta queres ver.`,
                        `We can arrange a visit on ${monthRange.start} at ${visitTime}. Tell me which quinta you want to visit.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_property', frictionAction: 'reset' }
                )
            }
            if (!visitTime && visitPropertyName) {
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Perfecto, coordinemos la visita a ${visitPropertyName} el ${monthRange.start}. Decime que horario te queda mejor.`,
                        `Great, let's schedule a visit to ${visitPropertyName} on ${monthRange.start}. Tell me what time works best.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
                )
            }
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Podemos coordinar una visita el ${monthRange.start}. Decime que horario te queda mejor y cual quinta queres ver.`,
                    `We can arrange a visit on ${monthRange.start}. Tell me what time works best and which quinta you want to visit.`
                ),
                undefined,
                { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
            )
        }
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastRangeStart: monthRange.start, lastRangeEnd: monthRange.end, updatedAt: new Date() } }
            )
        }
        const reply = await buildAvailabilityReply(monthRange.start, monthRange.end, property || undefined, lockedLocale, requestedDays, {
            includeHeader: lastReplyKind !== 'availability'
        })
        const negativeAvailability =
            isNoAvailabilitySummary(reply.answer || '') ||
            normalizeText(reply.answer || '').includes('minimo es') ||
            normalizeText(reply.answer || '').includes('minimum stay')
        if (hasVisitKeyword && rentIntent) {
            return respond(
                reply.answer +
                    responseForLocale(
                        lockedLocale,
                        '\n\nSi queres visitar una quinta, decime dia y horario y lo coordinamos.',
                        '\n\nIf you want to visit a quinta, tell me the day and time and we will coordinate.'
                    ),
                undefined,
                { intentSummary: 'awaiting_visit', replyKind: 'availability', frictionAction: 'reset' }
            )
        }
        return respondWith(reply, {
            replyKind: 'availability',
            intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
            frictionAction: 'reset'
        })
    }

    if (dayRange && typeof lastMonthIndex === 'number' && lastYear) {
        const timezone = 'America/Argentina/Buenos_Aires'
        const start = moment
            .tz({ year: lastYear, month: lastMonthIndex, day: dayRange.startDay }, timezone)
            .format('YYYY-MM-DD')
        const end = moment
            .tz({ year: lastYear, month: lastMonthIndex, day: dayRange.endDay }, timezone)
            .format('YYYY-MM-DD')
        const property = detectProperty(input.message || '', catalogProperties)
        if (visitOnly) {
            const visitProperty = property || catalogProperties.find((item) => item.propertyId === lastVisitPropertyId)
            const visitPropertyName = visitProperty?.name || visitProperty?.propertyId
            const visitTime = detectedVisitTime || lastVisitTime
            lastVisitDate = start
            if (visitProperty?.propertyId) {
                lastVisitPropertyId = visitProperty.propertyId
            }
            if (sessionId) {
                const visitSet: Record<string, any> = {
                    lastVisitDate: start,
                    lastVisitPending: true,
                    updatedAt: new Date()
                }
                if (visitProperty?.propertyId) {
                    visitSet.lastVisitPropertyId = visitProperty.propertyId
                }
                await db.collection(collections.manualAgentSessions).updateOne({ sessionId, agentId: 'quintas' }, { $set: visitSet })
            }
            if (visitTime && visitPropertyName) {
                if (sessionId) {
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: { lastVisitPending: false, updatedAt: new Date() } }
                    )
                }
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Queda agendada la visita para el ${start} a las ${visitTime} en ${visitPropertyName}.\n\nPara coordinarte ese dia, pasame tu nombre y telefono de contacto.`,
                        `Your visit is scheduled for ${start} at ${visitTime} in ${visitPropertyName}.\n\nPlease share your name and phone number to coordinate the visit.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
                )
            }
            if (visitTime && !visitPropertyName) {
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Podemos coordinar una visita el ${start} a las ${visitTime}. Decime que quinta queres ver.`,
                        `We can arrange a visit on ${start} at ${visitTime}. Tell me which quinta you want to visit.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_property', frictionAction: 'reset' }
                )
            }
            if (!visitTime && visitPropertyName) {
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `Perfecto, coordinemos la visita a ${visitPropertyName} el ${start}. Decime que horario te queda mejor.`,
                        `Great, let's schedule a visit to ${visitPropertyName} on ${start}. Tell me what time works best.`
                    ),
                    undefined,
                    { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
                )
            }
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Podemos coordinar una visita el ${start}. Decime que horario te queda mejor y cual quinta queres ver.`,
                    `We can arrange a visit on ${start}. Tell me what time works best and which quinta you want to visit.`
                ),
                undefined,
                { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
            )
        }
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastRangeStart: start, lastRangeEnd: end, updatedAt: new Date() } }
            )
        }
        const reply = await buildAvailabilityReply(start, end, property || undefined, lockedLocale, requestedDays, {
            includeHeader: lastReplyKind !== 'availability'
        })
        const negativeAvailability =
            isNoAvailabilitySummary(reply.answer || '') ||
            normalizeText(reply.answer || '').includes('minimo es') ||
            normalizeText(reply.answer || '').includes('minimum stay')
        if (hasVisitKeyword && rentIntent) {
            return respond(
                reply.answer +
                    responseForLocale(
                        lockedLocale,
                        '\n\nSi queres visitar una quinta, decime dia y horario y lo coordinamos.',
                        '\n\nIf you want to visit a quinta, tell me the day and time and we will coordinate.'
                    ),
                undefined,
                { intentSummary: 'awaiting_visit', replyKind: 'availability', frictionAction: 'reset' }
            )
        }
        return respondWith(reply, {
            replyKind: 'availability',
            intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
            frictionAction: 'reset'
        })
    }

    if (mentionsDayRangeWithoutMonth(input.message || '')) {
        if (dayRange && typeof lastMonthIndex === 'number' && typeof lastYear === 'number') {
            const timezone = 'America/Argentina/Buenos_Aires'
            const start = moment.tz({ year: lastYear, month: lastMonthIndex, day: dayRange.startDay }, timezone)
            const end = moment.tz({ year: lastYear, month: lastMonthIndex, day: dayRange.endDay }, timezone)
            if (start.isValid() && end.isValid()) {
                const startStr = start.format('YYYY-MM-DD')
                const endStr = end.format('YYYY-MM-DD')
                lastRangeStart = startStr
                lastRangeEnd = endStr
                if (sessionId) {
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: { lastRangeStart, lastRangeEnd, updatedAt: new Date() } }
                    )
                }
                const rangeProperty =
                    detectedProperty || (lastPropertyId ? catalogProperties.find((item) => item.propertyId === lastPropertyId) : undefined)
                const reply = await buildAvailabilityReply(startStr, endStr, rangeProperty || undefined, lockedLocale, requestedDays, {
                    includeHeader: lastReplyKind !== 'availability'
                })
                const negativeAvailability =
                    isNoAvailabilitySummary(reply.answer || '') ||
                    normalizeText(reply.answer || '').includes('minimo es') ||
                    normalizeText(reply.answer || '').includes('minimum stay')
                return respondWith(reply, {
                    replyKind: 'availability',
                    intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
                    frictionAction: 'reset'
                })
            }
        }
        return respond(
            responseForLocale(
                lockedLocale,
                'Tengo el rango de dias, pero necesito el mes. Decime por ejemplo "del 5 al 10 de febrero" y te confirmo.',
                'I have the day range, but need the month. For example: "from Feb 5 to Feb 10".'
            ),
            undefined,
            { intentSummary: 'awaiting_month', frictionAction: 'increase' }
        )
    }

    if (mentionsMonthWithoutDay(input.message || '')) {
        const monthMatch = detectMonthInMessage(input.message || '')
        const timezone = 'America/Argentina/Buenos_Aires'
        const now = moment.tz(timezone)
        const monthIndex = typeof monthMatch?.monthIndex === 'number' ? monthMatch.monthIndex : lastMonthIndex
        let year = lastYear
        if (typeof monthIndex === 'number' && !year) {
            year = monthIndex < now.month() ? now.year() + 1 : now.year()
        }
        if (typeof monthIndex !== 'number' || !year) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Decime el mes que tenes en mente y te paso opciones.',
                    'Tell me which month you have in mind and I will share options.'
                ),
                undefined,
                { intentSummary: 'awaiting_month', frictionAction: 'increase' }
            )
        }
        return respond(
            await buildMonthAvailabilitySummary({
                message: input.message || '',
                monthIndex,
                year,
                locale: lockedLocale
            }),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'reset' }
        )
    }

    const wantsAlternatives = ['otra', 'otras', 'otras opciones', 'opciones', 'disponibles'].some((keyword) => lower.includes(keyword))
    if (wantsAlternatives && lastRangeStart && lastRangeEnd && !hasDates && !mentionsMonthWithoutDay(input.message || '')) {
        const reply = await buildAvailabilityReply(lastRangeStart, lastRangeEnd, undefined, lockedLocale, requestedDays, {
            includeHeader: lastReplyKind !== 'availability'
        })
        const negativeAvailability =
            isNoAvailabilitySummary(reply.answer || '') ||
            normalizeText(reply.answer || '').includes('minimo es') ||
            normalizeText(reply.answer || '').includes('minimum stay')
        return respondWith(reply, {
            replyKind: 'availability',
            intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
            frictionAction: 'reset'
        })
    }

    if (visitContext && (lower.includes('que fechas') || lower.includes('cuando') || lower.includes('disponible'))) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Para coordinar una visita, decime 2 o 3 fechas y horarios que te queden bien y la quinta que queres ver.',
                'To coordinate a visit, share 2 or 3 date/time options and which quinta you want to visit.'
            ),
            undefined,
            { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
        )
    }

    if (visitContext && hasVisitTime && lastVisitDate && !lastVisitPropertyId && !hasDates && !hasLeadInfo(input.message || '')) {
        return respond(
            responseForLocale(
                lockedLocale,
                `Podemos coordinar una visita el ${lastVisitDate} a las ${lastVisitTime || detectedVisitTime}. Decime que quinta queres ver.`,
                `We can arrange a visit on ${lastVisitDate} at ${lastVisitTime || detectedVisitTime}. Tell me which quinta you want to visit.`
            ),
            undefined,
            { intentSummary: 'awaiting_property', frictionAction: 'reset' }
        )
    }

    if (visitContext && hasVisitTime && lastVisitDate && lastVisitPropertyId && !hasDates && !hasLeadInfo(input.message || '')) {
        const visitProperty = catalogProperties.find((item) => item.propertyId === lastVisitPropertyId)
        const visitPropertyName = visitProperty?.name || lastVisitPropertyId
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPending: false, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Queda agendada la visita para el ${lastVisitDate} a las ${lastVisitTime || detectedVisitTime} en ${visitPropertyName}.

Para coordinarte ese dia, pasame tu nombre y telefono de contacto.`,
                `Your visit is scheduled for ${lastVisitDate} at ${lastVisitTime || detectedVisitTime} in ${visitPropertyName}.

Please share your name and phone number to coordinate the visit.`
            ),
            undefined,
            { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
        )
    }

    if (visitContext && detectedProperty && lastVisitDate && !hasDates && !hasLeadInfo(input.message || '')) {
        const visitTime = detectedVisitTime || lastVisitTime
        lastVisitPropertyId = detectedProperty.propertyId
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPropertyId: detectedProperty.propertyId, lastVisitPending: true, updatedAt: new Date() } }
            )
        }
        if (visitTime) {
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastVisitPending: false, updatedAt: new Date() } }
                )
            }
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Queda agendada la visita para el ${lastVisitDate} a las ${visitTime} en ${detectedProperty.name || detectedProperty.propertyId}.

Para coordinarte ese dia, pasame tu nombre y telefono de contacto.`,
                    `Your visit is scheduled for ${lastVisitDate} at ${visitTime} in ${detectedProperty.name || detectedProperty.propertyId}.

Please share your name and phone number to coordinate the visit.`
                ),
                undefined,
                { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Perfecto, coordinemos la visita a ${detectedProperty.name || detectedProperty.propertyId} el ${lastVisitDate}. Decime que horario te queda mejor.`,
                `Great, let's schedule a visit to ${detectedProperty.name || detectedProperty.propertyId} on ${lastVisitDate}. Tell me what time works best.`
            ),
            undefined,
            { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
        )
    }

    if (
        detectedProperty &&
        lastRangeStart &&
        lastRangeEnd &&
        !hasLeadInfo(input.message || '') &&
        !hasDates &&
        !mentionsMonthWithoutDay(input.message || '') &&
        !hasVisitKeyword &&
        !hasVisitTime
    ) {
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastPropertyId: detectedProperty.propertyId, updatedAt: new Date() } }
            )
        }
        const availability = await checkAvailability({
            start: lastRangeStart,
            end: lastRangeEnd,
            propertyId: detectedProperty.propertyId,
            locale: lockedLocale
        })
        if (!availability.ok || !(availability as { available?: Array<Record<string, any>> }).available?.length) {
            const suggestion = await buildNearbyAvailabilityMessage({
                start: lastRangeStart,
                days: requestedDays,
                propertyId: detectedProperty.propertyId,
                locale: lockedLocale
            })
            if (suggestion) {
                return respond(suggestion, undefined, { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' })
            }
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Esas fechas ya no estan disponibles. Te puedo ofrecer alternativas.',
                    'Those dates are no longer available. I can offer alternatives.'
                ),
                undefined,
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Perfecto, ${detectedProperty.name || detectedProperty.propertyId} esta disponible para esas fechas. Para continuar, compartime tu nombre completo y un email o telefono de contacto.`,
                `Great, ${detectedProperty.name || detectedProperty.propertyId} is available for those dates. Please share your full name and an email or phone number to continue.`
            ),
            undefined,
            { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
        )
    }

    if (visitContext && detectedProperty && lastRangeStart && !hasDates && !hasLeadInfo(input.message || '')) {
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPropertyId: detectedProperty.propertyId, lastVisitPending: true, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Podemos coordinar una visita a ${detectedProperty.name || detectedProperty.propertyId}. Decime que dia y horario te queda mejor.`,
                `We can arrange a visit to ${detectedProperty.name || detectedProperty.propertyId}. Tell me the day and time that works best.`
            ),
            undefined,
            { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
        )
    }

    const hasReservationIntent = ['reserv', 'deposito', 'anticipo'].some((keyword) => lower.includes(keyword))
    const propertyInfoKeywords = [
        'comod',
        'amenit',
        'servicio',
        'precio',
        'tarifa',
        'costo',
        'costos',
        'capacidad',
        'ubicacion',
        'direccion',
        'detalle',
        'info',
        'incluye',
        'pileta',
        'parrilla',
        'quincho'
    ]
    const mentionsAirConditioning = lower.includes('aire') && lower.includes('acond')
    const otherIntentKeywords = [
        'pago',
        'deposito',
        'anticipo',
        'visita',
        'musica',
        'seguro',
        'lluvia',
        'descuento',
        'transferencia',
        'cbu',
        'alias',
        'banco'
    ]
    const hasOtherIntent = otherIntentKeywords.some((keyword) => lower.includes(keyword))
    const generalQuintasQuery = (lower.includes('quinta') || lower.includes('quintas')) && !hasOtherIntent
    const wantsPropertyInfo =
        propertyInfoKeywords.some((keyword) => lower.includes(keyword)) || mentionsAirConditioning || generalQuintasQuery
    if (wantsPropertyInfo && !hasReservationIntent && !visitOnly && !hasVisitKeyword) {
        const property = detectedProperty || (lastPropertyId ? catalogProperties.find((item) => item.propertyId === lastPropertyId) : undefined)
        const startFromMessage =
            explicitDates[0]?.format('YYYY-MM-DD') ||
            (monthRange?.start ? String(monthRange.start) : undefined)
        const endFromMessage =
            explicitDates[1]?.format('YYYY-MM-DD') ||
            (explicitDates[0] && requestedDays
                ? explicitDates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD')
                : startFromMessage) ||
            (monthRange?.end ? String(monthRange.end) : undefined)
        const start = startFromMessage || lastRangeStart
        const end = endFromMessage || lastRangeEnd || start

        if (sessionId && startFromMessage && endFromMessage) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastRangeStart: startFromMessage, lastRangeEnd: endFromMessage, updatedAt: new Date() } }
            )
        }

        if (property) {
            return respond(
                await buildPropertyInfoAnswer({
                    property,
                    locale: lockedLocale,
                    catalogMeta,
                    start,
                    end,
                    requestedDays
                }),
                undefined,
                { intentSummary: 'awaiting_dates', frictionAction: 'reset' }
            )
        }

        const availabilityReply =
            start && end
                ? await buildAvailabilityReply(start, end, undefined, lockedLocale, requestedDays, {
                      includeHeader: lastReplyKind !== 'availability'
                  })
                : null
        return respond(
            buildQuintasInfoSummary({
                catalogMeta,
                properties: catalogProperties,
                locale: lockedLocale,
                availabilityText: availabilityReply?.answer
            }),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'reset' }
        )
    }
    if (explicitDates.length && visitOnly) {
        const start = explicitDates[0].format('YYYY-MM-DD')
        const visitProperty = detectedProperty || catalogProperties.find((item) => item.propertyId === lastVisitPropertyId)
        const visitPropertyName = visitProperty?.name || visitProperty?.propertyId
        const visitTime = detectedVisitTime || lastVisitTime
        lastVisitDate = start
        if (visitProperty?.propertyId) {
            lastVisitPropertyId = visitProperty.propertyId
        }
        if (sessionId) {
            const visitSet: Record<string, any> = {
                lastVisitDate: start,
                lastVisitPending: true,
                updatedAt: new Date()
            }
            if (visitProperty?.propertyId) {
                visitSet.lastVisitPropertyId = visitProperty.propertyId
            }
            await db.collection(collections.manualAgentSessions).updateOne({ sessionId, agentId: 'quintas' }, { $set: visitSet })
        }
        if (visitTime && visitPropertyName) {
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastVisitPending: false, updatedAt: new Date() } }
                )
            }
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Queda agendada la visita para el ${start} a las ${visitTime} en ${visitPropertyName}.\n\nPara coordinarte ese dia, pasame tu nombre y telefono de contacto.`,
                    `Your visit is scheduled for ${start} at ${visitTime} in ${visitPropertyName}.\n\nPlease share your name and phone number to coordinate the visit.`
                ),
                undefined,
                { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
            )
        }
        if (visitTime && !visitPropertyName) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Podemos coordinar una visita el ${start} a las ${visitTime}. Decime que quinta queres ver.`,
                    `We can arrange a visit on ${start} at ${visitTime}. Tell me which quinta you want to visit.`
                ),
                undefined,
                { intentSummary: 'awaiting_property', frictionAction: 'reset' }
            )
        }
        if (!visitTime && visitPropertyName) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Perfecto, coordinemos la visita a ${visitPropertyName} el ${start}. Decime que horario te queda mejor.`,
                    `Great, let's schedule a visit to ${visitPropertyName} on ${start}. Tell me what time works best.`
                ),
                undefined,
                { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Podemos coordinar una visita el ${start}. Decime que horario te queda mejor y cual quinta queres ver.`,
                `We can arrange a visit on ${start}. Tell me what time works best and which quinta you want to visit.`
            ),
            undefined,
            { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
        )
    }
    if (explicitDates.length && !hasReservationIntent) {
        const start = explicitDates[0].format('YYYY-MM-DD')
        const end =
            explicitDates[1]?.format('YYYY-MM-DD') ||
            (requestedDays ? explicitDates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : start)
        const property = detectProperty(input.message || '', catalogProperties)
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastRangeStart: start, lastRangeEnd: end, updatedAt: new Date() } }
            )
        }
        const reply = await buildAvailabilityReply(start, end, property || undefined, lockedLocale, requestedDays, {
            includeHeader: lastReplyKind !== 'availability'
        })
        const negativeAvailability =
            isNoAvailabilitySummary(reply.answer || '') ||
            normalizeText(reply.answer || '').includes('minimo es') ||
            normalizeText(reply.answer || '').includes('minimum stay')
        return respondWith(reply, {
            replyKind: 'availability',
            intentSummary: negativeAvailability ? 'availability_none' : 'availability_options',
            frictionAction: 'reset'
        })
    }

    if (
        visitContext &&
        hasLeadInfo(input.message || '') &&
        (lastVisitDate || lastVisitTime || lastVisitPropertyId) &&
        (!lastVisitDate || !lastVisitTime || !lastVisitPropertyId) &&
        !hasDates
    ) {
        const missingParts = [
            !lastVisitDate ? (lockedLocale === 'en-US' ? 'date' : 'fecha') : '',
            !lastVisitTime ? (lockedLocale === 'en-US' ? 'time' : 'horario') : '',
            !lastVisitPropertyId ? (lockedLocale === 'en-US' ? 'quinta' : 'quinta') : ''
        ].filter(Boolean)
        const missingText =
            missingParts.length > 1 ? missingParts.join(lockedLocale === 'en-US' ? ', ' : ', ') : missingParts[0] || ''
        return respond(
            responseForLocale(
                lockedLocale,
                `Para coordinar la visita me falta ${missingText}. Decime esos datos y lo dejamos agendado.`,
                `To schedule the visit I still need the ${missingText}. Share those details and I will lock it in.`
            ),
            undefined,
            { intentSummary: 'awaiting_visit', frictionAction: 'reset' }
        )
    }

    if (visitContext && hasLeadInfo(input.message || '') && lastVisitDate && lastVisitTime && lastVisitPropertyId && !hasDates) {
        const visitProperty = catalogProperties.find((item) => item.propertyId === lastVisitPropertyId)
        const visitPropertyName = visitProperty?.name || lastVisitPropertyId
        const name = extractName(input.message || '')
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastVisitPending: false, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `${name ? `Gracias ${name}. ` : 'Gracias. '}Queda coordinada la visita a ${visitPropertyName} el ${lastVisitDate} a las ${lastVisitTime}.\n\nSi necesitas ajustar el horario, avisame por aca.`,
                `${name ? `Thanks ${name}. ` : 'Thanks. '}Your visit to ${visitPropertyName} is scheduled for ${lastVisitDate} at ${lastVisitTime}.\n\nIf you need to adjust the time, let me know here.`
            ),
            undefined,
            { intentSummary: 'visit_confirmed', frictionAction: 'reset' }
        )
    }

    if (hasLeadInfo(input.message || '') && lastRangeStart && lastRangeEnd && lastPropertyId && !visitIntent) {
        const property = catalogProperties.find((item) => item.propertyId === lastPropertyId)
        if (property) {
            if (sessionId) {
                lastIntent = 'rent'
                lastVisitPending = false
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastIntent, lastVisitPending: false, updatedAt: new Date() } }
                )
            }
            ensureToolAccess('write', [collectionNames.quintasCalendar])
            const hold = await createHold({
                propertyId: property.propertyId,
                start: lastRangeStart,
                end: lastRangeEnd,
                holdHours: restrictions.payment?.holdHours as number | undefined,
                notes: 'reserva con deposito/anticipo desde chat'
            })

            if (!hold.ok) {
                const suggestion = await buildNearbyAvailabilityMessage({
                    start: lastRangeStart,
                    days: requestedDays,
                    propertyId: property.propertyId,
                    locale: lockedLocale
                })
                if (suggestion) {
                    return respond(suggestion, undefined, { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' })
                }
                return respond(
                    responseForLocale(
                        lockedLocale,
                        'Esas fechas ya no estan disponibles. Te puedo ofrecer alternativas.',
                        'Those dates are no longer available. I can offer alternatives.'
                    ),
                    undefined,
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }

            const name = extractName(input.message || '')
            const email = extractEmail(input.message || '')
            const phone = extractPhone(input.message || '')
            await upsertLead({
                name: name || undefined,
                phone: phone || undefined,
                propertyId: property.propertyId,
                dateRequested: lastRangeStart,
                notes: email ? `email: ${email}` : undefined
            })

            const nights = Math.max(moment(lastRangeEnd).diff(moment(lastRangeStart), 'days'), 1)
            const pricePerNight = property.basePricePerNight
            const currency = property.currency || 'USD'
            const totalAmount =
                typeof pricePerNight === 'number' && Number.isFinite(pricePerNight)
                    ? Number((pricePerNight * nights).toFixed(2))
                    : undefined
            const depositPct = restrictions.payment?.depositPct ?? 0
            const depositAmount = typeof totalAmount === 'number' ? Number(((totalAmount * depositPct) / 100).toFixed(2)) : undefined
            const deadlineHours = restrictions.payment?.depositDeadlineHours ?? 0
            const fullPaymentDays = restrictions.payment?.fullPaymentDaysBefore ?? 0
            const transfer = restrictions.payment?.bankTransfer || {}
            const transferParts = [
                transfer.accountName ? `${lockedLocale === 'en-US' ? 'Account name' : 'Titular'}: ${transfer.accountName}` : '',
                transfer.bank ? `${lockedLocale === 'en-US' ? 'Bank' : 'Banco'}: ${transfer.bank}` : '',
                transfer.cbu ? `CBU: ${transfer.cbu}` : '',
                transfer.alias ? `${lockedLocale === 'en-US' ? 'Alias' : 'Alias'}: ${transfer.alias}` : '',
                transfer.concept ? `${lockedLocale === 'en-US' ? 'Concept' : 'Concepto'}: ${transfer.concept}` : ''
            ].filter(Boolean)
            const transferText = transferParts.length
                ? buildTransferText(transferParts, lockedLocale)
                : responseForLocale(
                      lockedLocale,
                      '\n\nPara realizar la transferencia bancaria, un humano te enviara los datos oficiales.',
                      '\n\nFor bank transfer details, a human will send the official information.'
                  )

            return respondWith(
                {
                    answer: responseForLocale(
                        lockedLocale,
                        `${name ? `Gracias ${name}, ` : ''}listo, genere la reserva a tu nombre.\n\n` +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'a confirmar'}.\n` +
                            `Deposito (${depositPct}%): ${
                                typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'a confirmar'
                            } (dentro de ${deadlineHours} horas).\n` +
                            `Pago total ${fullPaymentDays} dias antes de la llegada.${transferText}\n\n` +
                            'Cuando hagas el deposito/anticipo, adjuntame el comprobante como imagen para confirmar la reserva.',
                        `${name ? `Thanks ${name}, ` : ''}I created the reservation under your name.\n\n` +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'to be confirmed'}.\n` +
                            `Deposit (${depositPct}%): ${
                                typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'to be confirmed'
                            } (within ${deadlineHours} hours).\n` +
                            `Full payment is due ${fullPaymentDays} days before arrival.${transferText}\n\n` +
                            'Once you send the deposit, please attach the proof as an image so I can confirm the reservation.'
                    ),
                    metadata: {
                        type: 'holdCard',
                        hold: {
                            propertyId: property.propertyId,
                            start: lastRangeStart,
                            end: lastRangeEnd,
                            holdExpires: hold.holdExpires?.toISOString(),
                            nights,
                            pricePerNight,
                            currency,
                            totalAmount,
                            depositPct,
                            depositAmount
                        }
                    }
                },
                { intentSummary: 'reservation_hold', frictionAction: 'reset' }
            )
        }
    }

    if (lower.includes('por quien') && (lower.includes('ocupad') || lower.includes('reserv'))) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Por privacidad no podemos compartir datos de otras reservas. Si queres, te paso opciones disponibles.',
                "For privacy reasons we cannot share other guests' details. I can suggest available options instead."
            ),
            undefined,
            { frictionAction: 'reset' }
        )
    }

    try {
        const response = await runLlmFlow(input.message || '', input.sessionId, catalogMeta, restrictions, lockedLocale, sessionMessages)
        return respondWith(response)
    } catch (_error) {
        const fallback = await handleQuintasFallback(input, lockedLocale)
        return respondWith(fallback, { frictionAction: 'increase' })
    }
}

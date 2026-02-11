import moment from 'moment-timezone'
import OpenAI from 'openai'
import { nanoid } from 'nanoid'
import { ManualAgentRequest, ManualAgentResponse, ManualAgentToolDefinition } from './types'
import { ensureQuintasSeed } from './quintasData'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'
import { createHold, confirmPayment } from './quintasOps'
import { computeOutbound, runOutbound } from './outbound'
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
    events?: Array<{ start: string; end: string; status: string; holdExpires?: Date; notes?: string; paymentRef?: string }>
    blockedDates?: string[]
    globalBlackoutDates?: Array<{ start: string; end: string; reason?: string }>
}

type LeadInput = {
    id?: string
    name?: string
    email?: string
    phone?: string
    channel?: string
    dateRequested?: string
    propertyId?: string
    people?: number
    interest?: string
    status?: string
    habitual?: boolean
    negotiatedDiscountPct?: number
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
const QUINTAS_DATE_CONTEXT_TTL_DAYS = 14

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

const normalizeIntentText = (value: string) =>
    normalizeText(value || '')
        .replace(/[^a-z0-9\s/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const hasPhrase = (text: string, phrase: string) => {
    if (!text || !phrase) return false
    const normalizedPhrase = normalizeIntentText(phrase)
    if (!normalizedPhrase) return false
    return (
        text === normalizedPhrase ||
        text.startsWith(`${normalizedPhrase} `) ||
        text.endsWith(` ${normalizedPhrase}`) ||
        text.includes(` ${normalizedPhrase} `)
    )
}

const hasAnyPhrase = (text: string, phrases: string[]) => phrases.some((phrase) => hasPhrase(text, phrase))

const collapseRepeatedLetters = (value: string) => value.replace(/([a-z])\1+/g, '$1')

const getIntentTexts = (value: string) => {
    const base = normalizeIntentText(value)
    if (!base) return [] as string[]
    const collapsed = collapseRepeatedLetters(base)
    return collapsed && collapsed !== base ? [base, collapsed] : [base]
}

const hasAnyIntentPhrase = (message: string, phrases: string[]) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    return texts.some((text) => hasAnyPhrase(text, phrases))
}

const hasAnyIntentKeyword = (message: string, keywords: string[]) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    return keywords.some((keyword) => {
        const normalizedKeyword = normalizeIntentText(keyword)
        if (!normalizedKeyword) return false
        return texts.some((text) => text.includes(normalizedKeyword))
    })
}

const QUINTAS_DOMAIN_KEYWORDS = [
    'quinta',
    'quintas',
    'reserva',
    'reservar',
    'alquiler',
    'alquilar',
    'dispon',
    'precio',
    'tarifa',
    'costo',
    'deposito',
    'anticipo',
    'pago',
    'visita',
    'catalogo',
    'personas',
    'check in',
    'check out',
    'ingreso',
    'salida'
]

const QUINTAS_OFF_TOPIC_KEYWORDS = [
    'futbol',
    'football',
    'nba',
    'nfl',
    'cript',
    'crypto',
    'bitcoin',
    'acciones',
    'stocks',
    'medicina',
    'medico',
    'doctor',
    'hospital',
    'receta',
    'diagnostico',
    'politica',
    'eleccion',
    'presidente',
    'programacion',
    'javascript',
    'python'
]

const isLikelyNameCandidate = (candidate: string) => {
    const normalized = normalizeIntentText(candidate)
    if (!normalized) return false
    const words = normalized.split(' ').filter(Boolean)
    if (!words.length || words.length > 4) return false
    if (words.some((word) => word.length < 2 || /\d/.test(word))) return false
    const blockedWords = new Set([
        'quiero',
        'necesito',
        'busco',
        'reserva',
        'reservar',
        'alquiler',
        'alquilar',
        'fecha',
        'fechas',
        'quinta',
        'quintas',
        'precio',
        'tarifa',
        'costo',
        'disponibilidad',
        'visita',
        'gracias',
        'hola',
        'hello'
    ])
    if (words.some((word) => blockedWords.has(word))) return false
    return true
}

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

const getEasterSunday = (year: number) => {
    const century = Math.floor(year / 100)
    const remainder = year % 19
    const correction =
        (century - Math.floor(century / 4) - Math.floor((8 * century + 13) / 25) + 19 * remainder + 15) % 30
    const adjustment =
        correction - Math.floor(correction / 28) * (1 - Math.floor(29 / (correction + 1)) * Math.floor((21 - remainder) / 11))
    const weekday = (year + Math.floor(year / 4) + adjustment + 2 - century + Math.floor(century / 4)) % 7
    const offset = adjustment - weekday
    const month = 3 + Math.floor((offset + 40) / 44)
    const day = offset + 28 - 31 * Math.floor(month / 4)
    return moment({ year, month: month - 1, day })
}

const parseRelativeDateRange = (message: string) => {
    const text = normalizeText(message || '')
    if (!text) return null
    const timezone = 'America/Argentina/Buenos_Aires'
    const today = moment.tz(timezone).startOf('day')
    const wantsNext = text.includes('proximo') || text.includes('proxima') || text.includes('next')
    const includeToday = !wantsNext
    const isLongWeekend =
        text.includes('fin de semana largo') || text.includes('finde largo') || text.includes('puente') || text.includes('long weekend')
    const isWeekend = text.includes('fin de semana') || text.includes('finde') || text.includes('weekend')
    const isEndOfMonth = text.includes('fin de mes') || text.includes('end of month')
    const isSemanaSanta = text.includes('semana santa') || text.includes('easter week') || text.includes('easter')
    const hasSaturday = text.includes('sabado') || text.includes('saturday')
    const hasSunday = text.includes('domingo') || text.includes('sunday')

    if (isSemanaSanta) {
        let year = today.year()
        let start = getEasterSunday(year).clone().subtract(3, 'day')
        let end = getEasterSunday(year).clone()
        if (end.isBefore(today, 'day')) {
            year += 1
            start = getEasterSunday(year).clone().subtract(3, 'day')
            end = getEasterSunday(year).clone()
        }
        return { start, end, kind: 'semana_santa' }
    }

    if (isEndOfMonth) {
        const lastDay = today.clone().endOf('month').startOf('day')
        const start = lastDay.clone().subtract(1, 'day')
        const end = lastDay.clone()
        return { start, end, kind: 'end_of_month' }
    }

    if (isLongWeekend) {
        const friday = getNextWeekday(today, 5, includeToday)
        const start = friday
        const end = friday.clone().add(2, 'day')
        return { start, end, kind: 'long_weekend' }
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
        'pls',
        'plz',
        'avail',
        'available',
        'availability',
        'book',
        'booking',
        'reserve',
        'reservation',
        'price',
        'rate',
        'quote',
        'cost',
        'night',
        'nights',
        'people',
        'guest',
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
        'tarifa',
        'cotizar',
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
    if (enScore === 0 && esScore === 0) return 'es-AR'
    if (enScore === esScore) {
        const strongEnglish = ['pls', 'plz', 'price', 'rate', 'quote', 'availability', 'booking']
        if (strongEnglish.some((hint) => lower.includes(hint))) return 'en-US'
    }
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
    const today = moment().startOf('day')
    const year = today.year()
    const dayLabel = String(day).padStart(2, '0')
    const monthLabel = String(month).padStart(2, '0')
    const candidate = moment(`${dayLabel}/${monthLabel}/${year}`, 'DD/MM/YYYY', true)
    if (!candidate.isValid()) return candidate
    if (candidate.isBefore(today, 'day')) {
        const nextYear = year + 1
        const nextCandidate = moment(`${dayLabel}/${monthLabel}/${nextYear}`, 'DD/MM/YYYY', true)
        return nextCandidate.isValid() ? nextCandidate : candidate
    }
    return candidate
}

const parseMonthRange = (message: string) => {
    const lower = normalizeText(message || '')
    const monthMatch = Object.keys(MONTHS).find((month) => lower.includes(month))
    if (!monthMatch) return null

    const wantsFirstHalf = lower.includes('primera quincena') || lower.includes('1ra quincena')
    const wantsSecondHalf = lower.includes('segunda quincena') || lower.includes('2da quincena')

    const rangeRegex = new RegExp(
        `(\\d{1,2})\\s*(?:al|to|-)\\s*(\\d{1,2})\\s*(?:de\\s*)?${monthMatch}`
    )
    const singleRegex = new RegExp(`(\\d{1,2})\\s*(?:de\\s*)?${monthMatch}`)

    const range = lower.match(rangeRegex)
    const single = lower.match(singleRegex)
    const startDay = range ? Number(range[1]) : single ? Number(single[1]) : wantsFirstHalf || wantsSecondHalf ? 1 : null
    if (!startDay) return null

    const timezone = 'America/Argentina/Buenos_Aires'
    const now = moment.tz(timezone)
    const monthIndex = MONTHS[monthMatch]
    let year = now.year()
    if (monthIndex < now.month() || (monthIndex === now.month() && startDay < now.date())) {
        year += 1
    }
    const monthStart = moment.tz({ year, month: monthIndex, day: 1 }, timezone)
    const daysInMonth = monthStart.daysInMonth()
    const endDay = range
        ? Number(range[2])
        : wantsSecondHalf
        ? daysInMonth
        : wantsFirstHalf
        ? Math.min(15, daysInMonth)
        : startDay
    if (!endDay) return null

    let endMonthIndex = monthIndex
    let endYear = year
    if (endDay < startDay) {
        endMonthIndex = (monthIndex + 1) % 12
        endYear = monthIndex === 11 ? year + 1 : year
    }

    const start = moment.tz({ year, month: monthIndex, day: startDay }, timezone).format('YYYY-MM-DD')
    const end = moment.tz({ year: endYear, month: endMonthIndex, day: endDay }, timezone).format('YYYY-MM-DD')
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
    if (match) {
        const candidate = match[1].trim().replace(/\s+/g, ' ')
        if (isLikelyNameCandidate(candidate)) {
            return candidate
        }
    }

    const emailMatch = String(message || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch && emailMatch.index !== undefined) {
        const beforeEmail = String(message || '').slice(0, emailMatch.index)
        const candidate = normalizeText(beforeEmail).replace(/(mail|email|correo)\s*/g, '').replace(/[:;,-]/g, ' ')
        const cleaned = candidate.trim().replace(/\s+/g, ' ')
        if (cleaned.length >= 3 && isLikelyNameCandidate(cleaned)) return cleaned
    }

    if (String(message || '').includes(',')) {
        const firstPart = String(message || '').split(',')[0]
        const cleaned = normalizeText(firstPart).trim().replace(/\s+/g, ' ')
        if (cleaned.length >= 3 && isLikelyNameCandidate(cleaned)) return cleaned
    }

    return ''
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
            lastRangeUpdatedAt?: Date
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

const resetQuintasSessionFlow = async (sessionId: string) => {
    if (!sessionId) return
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    ensureToolAccess('write', [collections.manualAgentSessions])
    const unsetFields = [
        'lastMonthIndex',
        'lastYear',
        'lastRangeStart',
        'lastRangeEnd',
        'lastRangeUpdatedAt',
        'lastPropertyId',
        'lastGuests',
        'lastIntent',
        'lastHabitual',
        'lastNegotiatedDiscountPct',
        'lastReplyKind',
        'lastIntentSummary',
        'lastTopic',
        'pendingDateConfirm',
        'pendingHoldConfirm',
        'lastVisitDate',
        'lastVisitPropertyId',
        'lastVisitTime',
        'lastVisitPending',
        'frictionCount',
        'confusionCount'
    ]
    const unsetPayload = Object.fromEntries(unsetFields.map((field) => [field, '']))
    await db.collection(collections.manualAgentSessions).updateOne(
        { sessionId, agentId: 'quintas' },
        { $unset: unsetPayload, $set: { updatedAt: new Date() } }
    )
}

const hasLeadInfo = (message: string) => {
    return Boolean(extractEmail(message) || extractPhone(message) || extractName(message))
}

const hasReservationIntent = (message: string) => {
    const lower = normalizeText(message || '')
    const strong = ['reserv', 'reserva', 'confirmar', 'confirmo', 'avanzar', 'elegi', 'quiero reservar', 'quiero alquilar']
    const weak = ['quiero', 'me interesa', 'me gustaria', 'me gusta', 'interesado']
    const infoOnly = ['precio', 'tarifa', 'costo', 'costos', 'comod', 'amenit', 'detalle', 'info', 'ubicacion', 'direccion']
    if (strong.some((keyword) => lower.includes(keyword))) return true
    if (weak.some((keyword) => lower.includes(keyword)) && !infoOnly.some((keyword) => lower.includes(keyword))) {
        return true
    }
    return false
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
    const greetings = [
        'hola',
        'holaa',
        'buenas',
        'buenass',
        'buen dia',
        'buenas tardes',
        'buenas noches',
        'que tal',
        'hello',
        'hi',
        'hey',
        'holi'
    ]
    const hasGreeting = hasAnyIntentPhrase(message, greetings)
    if (!hasGreeting) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message)) || Boolean(parseRelativeDateRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isThanksOnly = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    if (isPoliteAckOnly(message)) return false
    const thanks = ['gracias', 'muchas gracias', 'mil gracias', 'thanks', 'thank you', 'thx', 'ty', 'grax', 'grx']
    const hasThanks = hasAnyIntentPhrase(message, thanks)
    if (!hasThanks) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message)) || Boolean(parseRelativeDateRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isDeclineOnly = (message: string) => {
    const declinePhrases = [
        'no gracias',
        'no por ahora',
        'paso por ahora',
        'paso',
        'dejalo',
        'dejalo asi',
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
        'no busco',
        'all good',
        'im good',
        'i am good'
    ]
    const hasDecline = hasAnyIntentPhrase(message, declinePhrases)
    if (!hasDecline) return false
    const hasDateSignals =
        extractDates(message).length > 0 ||
        Boolean(parseMonthRange(message)) ||
        Boolean(parseDayRange(message)) ||
        Boolean(parseRelativeDateRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    return !hasDateSignals && !hasDomainKeywords
}

const isShortAckOnly = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    if (texts.some((text) => /^(si+|yes+|yep+|ok+|okay+|dale+|oka+|oki+|okis+|joya+)$/.test(text))) return true
    const phrases = [
        'ok',
        'okay',
        'okey',
        'oki',
        'okis',
        'ok dale',
        'ok por favor',
        'dale',
        'de una',
        'va',
        'joya',
        'genial',
        'perfecto',
        'perfect',
        'great',
        'buenisimo',
        'buenisima',
        'confirmo',
        'confirmar',
        'book it',
        'reserve it',
        'go ahead',
        'sounds good'
    ]
    return hasAnyIntentPhrase(message, phrases)
}

const isPoliteAckOnly = (message: string) => {
    const tokenVariants = getIntentTexts(message).map((text) => text.split(' ').filter(Boolean)).filter((tokens) => tokens.length && tokens.length <= 8)
    if (!tokenVariants.length) return false
    const ackTokens = new Set([
        'si',
        'yes',
        'yep',
        'ok',
        'okay',
        'okey',
        'dale',
        'de',
        'una',
        'va',
        'genial',
        'perfecto',
        'confirmo',
        'confirmar',
        'listo',
        'sure',
        'book',
        'reserve',
        'go',
        'ahead',
        'sounds',
        'good',
        'oki',
        'okis',
        'joya',
        'great',
        'perfect'
    ])
    const politeTokens = new Set(['gracias', 'muchas', 'mil', 'thanks', 'thank', 'you', 'thx', 'ty', 'por', 'favor', 'please'])
    const hasAckSignal =
        tokenVariants.some((tokens) => tokens.some((token) => ackTokens.has(token))) ||
        hasAnyIntentPhrase(message, ['de una', 'go ahead', 'sounds good', 'book it', 'reserve it'])
    if (!hasAckSignal) return false
    return tokenVariants.some((tokens) => tokens.every((token) => ackTokens.has(token) || politeTokens.has(token)))
}

const isShortNoOnly = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    if (texts.some((text) => /^(no+|nop+|nono+|nah+)$/.test(text))) return true
    const phrases = [
        'no',
        'no gracias',
        'no por ahora',
        'paso por ahora',
        'paso',
        'dejalo',
        'dejalo asi',
        'no confirmo',
        'nop',
        'nah',
        'not now',
        'no thanks',
        'cancel it',
        'stop'
    ]
    return hasAnyIntentPhrase(message, phrases)
}

const isHelpOnly = (message: string) => {
    const helpPhrases = [
        'ayuda',
        'help',
        'menu',
        'opciones',
        'que podes hacer',
        'que puedes hacer',
        'como funciona',
        'what can you do',
        'how does it work'
    ]
    if (!hasAnyIntentPhrase(message, helpPhrases)) return false
    return extractDates(message).length === 0
}

const isGoodbyeOnly = (message: string) => {
    const phrases = ['chau', 'chao', 'adios', 'nos vemos', 'hasta luego', 'hasta la proxima', 'bye', 'goodbye', 'see you', 'see ya']
    if (!hasAnyIntentPhrase(message, phrases)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message)) || Boolean(parseRelativeDateRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isRestartRequest = (message: string) => {
    const phrases = [
        'empecemos de nuevo',
        'empezar de nuevo',
        'arranquemos de nuevo',
        'arranquemos de cero',
        'empecemos de cero',
        'reiniciar',
        'resetear',
        'restart',
        'start over',
        'from scratch',
        'reset chat',
        'olvida lo anterior',
        'ignore previous'
    ]
    if (!hasAnyIntentPhrase(message, phrases)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message)) || Boolean(parseRelativeDateRange(message))
    const hasContact = Boolean(extractEmail(message) || extractPhone(message))
    return !hasDates && !hasContact
}

const isHumanHandoffRequest = (message: string) => {
    const phrases = [
        'humano',
        'persona real',
        'asesor',
        'agente humano',
        'representante',
        'operador',
        'speak to human',
        'human agent',
        'real person',
        'support agent'
    ]
    return hasAnyIntentPhrase(message, phrases)
}

const isClearlyOffTopic = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    const hasRelevant = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    const hasOffTopic = hasAnyIntentKeyword(message, QUINTAS_OFF_TOPIC_KEYWORDS)
    return hasOffTopic && !hasRelevant
}

const isSmallTalkOnly = (message: string) => {
    const phrases = [
        'como estas',
        'como andas',
        'todo bien?',
        'todo bien',
        'que tal',
        'how are you',
        'how is it going',
        'how are things',
        'who are you',
        'quien sos',
        'quien eres'
    ]
    if (!hasAnyIntentPhrase(message, phrases)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseMonthRange(message)) || Boolean(parseDayRange(message)) || Boolean(parseRelativeDateRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, QUINTAS_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isDataScopeQuestion = (message: string) =>
    hasAnyIntentPhrase(message, [
        'que datos tenes',
        'que data tenes',
        'que info tenes',
        'que informacion tenes',
        'que bases consultas',
        'que base consultas',
        'con que base trabajas',
        'que podes consultar',
        'que podes ver',
        'what data do you have',
        'what information do you have',
        'what info do you have',
        'which data do you use',
        'which database do you use',
        'what can you check'
    ])

const isUnsupportedMockDataQuestion = (message: string) => {
    const asksRealtime =
        hasAnyIntentPhrase(message, [
            'tiempo real',
            'en vivo',
            'actualizado al minuto',
            'actualizado ahora',
            'real time',
            'real-time',
            'live data',
            'live update'
        ]) ||
        (hasAnyIntentKeyword(message, ['live', 'actualizado']) && hasAnyIntentKeyword(message, ['data', 'datos', 'update']))
    const externalSignals = hasAnyIntentKeyword(message, [
        'clima',
        'weather',
        'trafico',
        'traffic',
        'vuelo',
        'flight',
        'noticias',
        'news',
        'dolar',
        'exchange rate'
    ])
    return asksRealtime && externalSignals
}

const buildMockScopeAnswer = (locale: string) =>
    responseForLocale(
        locale,
        [
            'En esta demo mock puedo consultar calendario de disponibilidad, bloqueos y reglas por quinta.',
            'Tambien tengo catalogo, comodidades, politicas comerciales, pagos y leads/reservas creadas en el chat.',
            'Si algo queda fuera de esos datos, te lo digo claro y te ofrezco pase a humano.'
        ].join(' '),
        [
            'In this mock demo I can check availability calendars, blocked dates, and property rules.',
            'I also use catalog data, amenities, payment/commercial policies, and leads/reservations created in chat.',
            'If something is outside that data, I will say it clearly and offer human handoff.'
        ].join(' ')
    )

const buildUnsupportedMockDataAnswer = (locale: string) =>
    responseForLocale(
        locale,
        'En este entorno mock no tengo ese dato en tiempo real. Te puedo ayudar con la informacion de quintas de la demo o dejar el pedido listo para un humano.',
        "I don't have that real-time data in this mock environment. I can help with the quinta data in the demo or leave the request ready for a human agent."
    )

const isPaymentProofIntent = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    const normalizedMessage = normalizeIntentText(message)
    if (!normalizedMessage) return false

    const proofPhrases = [
        'adjunto comprobante',
        'te adjunto comprobante',
        'te mando comprobante',
        'te envie comprobante',
        'ya envie comprobante',
        'ya transferi',
        'ya hice la transferencia',
        'ya pague',
        'pago realizado',
        'comprobante enviado',
        'sending proof',
        'sent the receipt',
        'payment done',
        'i already paid',
        'transfer completed',
        'i attached the receipt'
    ]
    if (hasAnyIntentPhrase(message, proofPhrases)) return true

    const strongReferencePattern =
        /\b(?:trx|tx|op(?:eracion)?|operation|ref(?:erencia)?|comprobante|voucher)\s*[:#-]?\s*[a-z0-9-]{4,}\b/i
    const hasStrongReference = strongReferencePattern.test(message || '')

    const proofVerbs = [
        'adjunt',
        'envi',
        'mande',
        'subi',
        'cargu',
        'transferi',
        'pague',
        'pago realizado',
        'realice',
        'hice',
        'sent',
        'uploaded',
        'attached',
        'paid',
        'transferred',
        'completed'
    ]
    const proofNouns = [
        'comprobante',
        'receipt',
        'proof',
        'transferencia',
        'transfer',
        'deposito',
        'anticipo',
        'payment',
        'pago',
        'trx',
        'tx',
        'referencia',
        'ref'
    ]
    const policyQuestionPhrases = [
        'como pago',
        'formas de pago',
        'metodo de pago',
        'medios de pago',
        'datos de transferencia',
        'pasame cbu',
        'pasame alias',
        'how do i pay',
        'payment methods',
        'bank details',
        'where do i pay'
    ]

    const asksPolicy = texts.some((text) => policyQuestionPhrases.some((phrase) => text.includes(normalizeIntentText(phrase))))
    if (asksPolicy && !hasStrongReference) return false

    const hasVerb = texts.some((text) => proofVerbs.some((keyword) => text.includes(keyword)))
    const hasNoun = texts.some((text) => proofNouns.some((keyword) => text.includes(keyword)))
    const hasQuestionMark = /[?¿]/.test(message || '')

    if (hasStrongReference && (hasVerb || hasNoun)) return true
    if (hasVerb && hasNoun && !hasQuestionMark) return true
    return false
}

const extractPaymentReference = (message: string) => {
    const raw = String(message || '')
    if (!raw) return ''

    const capturePatterns = [
        /\b(?:trx|tx|op(?:eracion)?|operation|ref(?:erencia)?|comprobante|voucher)\s*[:#-]?\s*([a-z0-9-]{4,})\b/i,
        /\b([a-z]{2,6}-\d{4,})\b/i,
        /\b(\d{8,})\b/
    ]

    for (const pattern of capturePatterns) {
        const match = raw.match(pattern)
        if (!match?.[1]) continue
        const cleaned = match[1].replace(/[^a-z0-9-]/gi, '').slice(0, 64)
        if (cleaned.length >= 4) return cleaned.toUpperCase()
    }

    return ''
}

const extractDates = (message: string, options?: { preferMonthFirst?: boolean }): moment.Moment[] => {
    const preferMonthFirst = Boolean(options?.preferMonthFirst)
    const parseShortDateParts = (first: number, second: number) => {
        const direct = parseShortDate(first, second)
        const flipped = parseShortDate(second, first)
        if (direct.isValid() && flipped.isValid()) {
            return preferMonthFirst ? flipped : direct
        }
        return direct.isValid() ? direct : flipped
    }
    const parseSlashWithYear = (raw: string) => {
        const dayFirst = moment(raw, ['DD/MM/YYYY', 'DD/MM/YY'], true)
        const monthFirst = moment(raw, ['MM/DD/YYYY', 'MM/DD/YY'], true)
        if (dayFirst.isValid() && monthFirst.isValid()) {
            return preferMonthFirst ? monthFirst : dayFirst
        }
        return dayFirst.isValid() ? dayFirst : monthFirst
    }
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
                    return parseShortDateParts(Number(parts[0]), Number(parts[1]))
                }
                return parseSlashWithYear(token.raw)
            }
            const [day, month] = token.raw.split('-').map((value) => Number(value))
            if (!Number.isFinite(day) || !Number.isFinite(month)) {
                return moment.invalid()
            }
            return parseShortDateParts(day, month)
        })
        .filter((parsed) => parsed.isValid())
}

const findAmbiguousShortDate = (message: string) => {
    const ranges: Array<{ start: number; end: number }> = []
    for (const match of message.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
        if (match.index === undefined) continue
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }
    for (const match of message.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)) {
        if (match.index === undefined) continue
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }
    for (const match of message.matchAll(/\b\d{1,2}[/-]\d{1,2}\b/g)) {
        if (match.index === undefined) continue
        const start = match.index
        const end = start + match[0].length
        if (ranges.some((range) => start >= range.start && end <= range.end)) continue
        const parts = match[0].split(/[/-]/).map((value) => Number(value))
        if (parts.length !== 2) continue
        const [first, second] = parts
        if (!Number.isFinite(first) || !Number.isFinite(second)) continue
        if (first <= 12 && second <= 12) {
            return { raw: match[0], first, second }
        }
    }
    return null
}

const buildAmbiguousDateQuestion = (input: { raw: string; first: number; second: number }, locale: string) => {
    const left = String(input.first).padStart(2, '0')
    const right = String(input.second).padStart(2, '0')
    const optionA = `${left}/${right}`
    const optionB = `${right}/${left}`
    return responseForLocale(
        locale,
        `Para evitar errores con "${input.raw}", puede ser ${optionA} o ${optionB}. Confirmame las fechas en formato YYYY-MM-DD.`,
        `Quick check: "${input.raw}" could be ${optionA} or ${optionB}. Can you confirm the dates in YYYY-MM-DD?`
    )
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

const extractStayLengthDetails = (message: string) => {
    const normalized = normalizeText(message || '')
    const match = normalized.match(/\b(\d{1,2})\s*(dias|noches|days|nights)\b/)
    if (!match) return undefined
    const value = Number(match[1])
    if (!Number.isFinite(value)) return undefined
    const unitRaw = match[2]
    const unit = unitRaw.includes('noche') || unitRaw.includes('night') ? 'nights' : 'days'
    return { value, unit } as { value: number; unit: 'days' | 'nights' }
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

const formatDateLabel = (date: moment.Moment, locale = 'es-AR') => {
    const localeKey = locale === 'en-US' ? 'en' : 'es'
    return locale === 'en-US'
        ? date.locale(localeKey).format('MMM D, YYYY')
        : date.locale(localeKey).format('D [de] MMMM [de] YYYY')
}

const formatDateLabelFromISO = (value: string, locale = 'es-AR') => {
    const parsed = moment(value, 'YYYY-MM-DD', true)
    if (!parsed.isValid()) return value
    return formatDateLabel(parsed, locale)
}

const formatStaySpan = (start: string, end: string, locale = 'es-AR') => {
    const checkInLabel = locale === 'en-US' ? 'check-in' : 'ingreso'
    const checkOutLabel = locale === 'en-US' ? 'check-out' : 'salida'
    const startLabel = formatDateLabelFromISO(start, locale)
    const endLabel = formatDateLabelFromISO(end, locale)
    return `${checkInLabel} ${startLabel}, ${checkOutLabel} ${endLabel}`
}

const formatRangeLabel = (start: moment.Moment, end: moment.Moment, locale = 'es-AR') => {
    return formatStaySpan(formatDateLabel(start, locale), formatDateLabel(end, locale), locale)
}

const formatRangeWithYear = (start: moment.Moment, end: moment.Moment, locale = 'es-AR') => {
    return formatRangeLabel(start, end, locale)
}

const buildHoldSummaryLine = (params: {
    start: string
    end: string
    propertyName?: string
    guests?: number
    locale: string
}) => {
    const stay = formatStaySpan(params.start, params.end, params.locale)
    const guests =
        typeof params.guests === 'number' ? (params.locale === 'en-US' ? `${params.guests} guests` : `${params.guests} personas`) : ''
    const parts = [params.propertyName || '', stay, guests].filter(Boolean)
    if (!parts.length) return ''
    const summary = parts.join(' - ')
    return params.locale === 'en-US' ? `Summary: ${summary}.` : `Resumen: ${summary}.`
}

const isDateContextStale = (params: { start?: string; end?: string; lastRangeUpdatedAt?: string | Date | null }) => {
    if (!params.start || !params.end) return false
    if (!params.lastRangeUpdatedAt) return true
    const last = moment(params.lastRangeUpdatedAt)
    if (!last.isValid()) return true
    return moment().diff(last, 'days') >= QUINTAS_DATE_CONTEXT_TTL_DAYS
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
    const [properties, restrictions] = await Promise.all([getCatalogProperties(), getRestrictions()])
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
        const baseMinNights = Math.max(Number(prop.minNights || 1), 1)
        const lastStart = end.clone().subtract(baseMinNights - 1, 'day')
        if (lastStart.isBefore(start, 'day')) continue
        for (let cursor = start.clone(); cursor.isSameOrBefore(lastStart, 'day'); cursor.add(1, 'day')) {
            const minStay = resolveMinNightsForRange({
                start: cursor,
                end: cursor.clone().add(baseMinNights - 1, 'day'),
                propertyMinNights: prop.minNights,
                restrictions
            })
            const minNights = Math.max(Number(minStay.minNights || baseMinNights), baseMinNights)
            const candidateEnd = cursor.clone().add(minNights - 1, 'day')
            if (candidateEnd.isAfter(end, 'day')) continue
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
        const dateLabel = formatDateLabel(day, locale)
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

const normalizePhoneForLookup = (value: string) => String(value || '').replace(/\D/g, '')

const detectZoneFromMessage = (message: string) => {
    const lower = normalizeText(message || '')
    if (lower.includes('zona norte') || lower.includes('north zone')) return 'Zona Norte'
    if (lower.includes('zona oeste') || lower.includes('west zone')) return 'Zona Oeste'
    if (lower.includes('zona sur') || lower.includes('south zone')) return 'Zona Sur'
    return ''
}

const isMarketKpiIntent = (message: string) => {
    const kpiPhrases = [
        'kpi',
        'rendimiento',
        'performance',
        'ocupacion',
        'occupancy',
        'competencia',
        'competidores',
        'competitor',
        'benchmark',
        'comparativa',
        'comparativo',
        'precio promedio de mercado',
        'precio competencia',
        'outbound',
        'recontactar',
        'recontacto'
    ]
    return hasAnyIntentKeyword(message, kpiPhrases)
}

const isOutboundExecutionIntent = (message: string) => {
    const triggerPhrases = [
        'activar outbound',
        'activa outbound',
        'ejecutar outbound',
        'ejecuta outbound',
        'lanzar outbound',
        'manda promociones',
        'envia promociones',
        'enviar promociones',
        'recontactar ahora',
        'recontacta ahora',
        'run outbound',
        'trigger outbound',
        'send promotions'
    ]
    return hasAnyIntentPhrase(message, triggerPhrases)
}

const isDiscountNegotiationIntent = (message: string) => {
    const phrases = [
        'descuento',
        'rebaja',
        'regate',
        'mejor precio',
        'precio final',
        'off',
        'discount'
    ]
    return hasAnyIntentKeyword(message, phrases)
}

const clampDiscountPct = (value: unknown) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return 0
    return Math.min(Math.max(parsed, 0), 50)
}

const extractNegotiatedDiscountPct = (message: string) => {
    const hasNegotiationContext =
        isDiscountNegotiationIntent(message) ||
        hasAnyIntentPhrase(message, ['si nos dejas', 'si nos haces', 'cerramos hoy', 'podemos cerrar', 'te acepto'])
    if (!hasNegotiationContext) return undefined
    const normalized = normalizeText(message || '')
    const pctMatch = normalized.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\s*%/)
    if (pctMatch?.[1]) {
        const parsed = clampDiscountPct(String(pctMatch[1]).replace(',', '.'))
        return parsed > 0 ? parsed : undefined
    }
    const noSymbolMatch = normalized.match(/\b(?:descuento|rebaja|off)\s*(?:de\s*)?(\d{1,2}(?:[.,]\d{1,2})?)\b/)
    if (noSymbolMatch?.[1]) {
        const parsed = clampDiscountPct(String(noSymbolMatch[1]).replace(',', '.'))
        return parsed > 0 ? parsed : undefined
    }
    return undefined
}

const pickNegotiatedDiscountPct = (params: { lead?: any; sessionPct?: number; requestedPct?: number }) => {
    const requested = clampDiscountPct(params.requestedPct)
    if (requested > 0) return requested
    const leadPct = clampDiscountPct(params.lead?.negotiatedDiscountPct)
    if (leadPct > 0) return leadPct
    const sessionPct = clampDiscountPct(params.sessionPct)
    return sessionPct > 0 ? sessionPct : 0
}

const isServiceRequestIntent = (message: string) => {
    const requestPhrases = [
        'pedido',
        'solicitud',
        'reclamo',
        'inconveniente',
        'problema',
        'no funciona',
        'mantenimiento',
        'toalla',
        'limpieza',
        'amenities',
        'amenity',
        'comida',
        'catering'
    ]
    if (!hasAnyIntentKeyword(message, requestPhrases)) return false
    const bookingPhrases = ['reserv', 'dispon', 'precio', 'tarifa', 'alquilar', 'visita', 'deposito', 'anticipo', 'pago']
    const explicitRequest = hasAnyIntentKeyword(message, ['pedido', 'solicitud', 'reclamo', 'inconveniente', 'problema']) || hasAnyIntentPhrase(message, ['no funciona'])
    const hasBookingIntent = hasAnyIntentKeyword(message, bookingPhrases)
    return explicitRequest || !hasBookingIntent
}

const detectServiceRequestType = (message: string) => {
    if (hasAnyIntentKeyword(message, ['toalla', 'limpieza', 'amenit', 'saban', 'cuna'])) return 'amenities'
    if (hasAnyIntentKeyword(message, ['comida', 'catering', 'bebida', 'menu', 'parrilla'])) return 'catering'
    if (hasAnyIntentKeyword(message, ['mantenimiento', 'no funciona', 'aire', 'luz', 'agua', 'inconveniente', 'problema'])) {
        return 'maintenance'
    }
    return 'general'
}

const resolveMinNightsForRange = (params: {
    start: moment.Moment
    end: moment.Moment
    propertyMinNights?: number
    restrictions?: RestrictionsDoc
}) => {
    const baseMinNights = Math.max(Number(params.propertyMinNights || 1), 1)
    const rules = params.restrictions?.minStayRules || []
    let ruleMinNights = 0
    let ruleReason = ''
    for (const rule of rules) {
        const ruleStart = moment(rule.start, 'YYYY-MM-DD', true)
        const ruleEnd = moment(rule.end, 'YYYY-MM-DD', true)
        if (!ruleStart.isValid() || !ruleEnd.isValid()) continue
        if (!rangesOverlap(params.start, params.end, ruleStart, ruleEnd)) continue
        const candidateMin = Math.max(Number(rule.minNights || 0), 0)
        if (candidateMin > ruleMinNights) {
            ruleMinNights = candidateMin
            ruleReason = String(rule.reason || '').trim()
        }
    }
    const minNights = Math.max(baseMinNights, ruleMinNights)
    return { minNights, minReason: ruleReason }
}

const calculateDiscountBreakdown = (params: {
    pricePerNight?: number
    nights: number
    currency?: string
    restrictions?: RestrictionsDoc
    isHabitual?: boolean
    customDiscountPct?: number
}) => {
    const currency = params.currency || 'USD'
    const rawPricePerNight = Number(params.pricePerNight || 0)
    const nights = Math.max(Number(params.nights || 1), 1)
    const totalAmount =
        Number.isFinite(rawPricePerNight) && rawPricePerNight > 0 ? Number((rawPricePerNight * nights).toFixed(2)) : undefined

    const discountEnabled = Boolean(params.restrictions?.discounts?.enabled && params.isHabitual)
    const configuredPct = Math.max(Number(params.restrictions?.discounts?.habitualPct || 0), 0)
    const customPct = clampDiscountPct(params.customDiscountPct)
    const discountPct = discountEnabled ? (customPct > 0 ? customPct : configuredPct) : 0
    const discountAmount =
        discountPct > 0 && typeof totalAmount === 'number' ? Number(((totalAmount * discountPct) / 100).toFixed(2)) : 0
    const finalTotalAmount = typeof totalAmount === 'number' ? Number((totalAmount - discountAmount).toFixed(2)) : undefined
    const finalPricePerNight =
        Number.isFinite(rawPricePerNight) && rawPricePerNight > 0
            ? Number((rawPricePerNight * (1 - discountPct / 100)).toFixed(2))
            : undefined
    return {
        currency,
        totalAmount,
        discountPct,
        discountAmount,
        finalTotalAmount,
        finalPricePerNight
    }
}

const findHabitualLeadByIdentity = async (input: { id?: string; name?: string; email?: string; phone?: string }) => {
    const doc = await getLeadDoc()
    const leads = (doc?.leads || []) as Array<LeadInput & { habitual?: boolean; email?: string; property?: string }>
    if (!leads.length) return null

    const normalizedPhone = normalizePhoneForLookup(input.phone || '')
    const normalizedEmail = normalizeIntentText(input.email || '')
    const normalizedName = normalizeIntentText(input.name || '')

    if (input.id) {
        const byId = leads.find((lead) => String(lead.id || '') === String(input.id))
        if (byId) return byId
    }
    if (normalizedPhone) {
        const byPhone = leads.find((lead) => normalizePhoneForLookup(String(lead.phone || '')) === normalizedPhone)
        if (byPhone) return byPhone
    }
    if (normalizedEmail) {
        const byEmail = leads.find((lead) => normalizeIntentText(String((lead as any).email || '')) === normalizedEmail)
        if (byEmail) return byEmail
    }
    if (normalizedName) {
        const byName = leads.find((lead) => normalizeIntentText(String(lead.name || '')) === normalizedName)
        if (byName) return byName
    }
    return null
}

const buildMarketKpiAnswer = async (locale: string, message: string) => {
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    ensureToolAccess('read', [collections.quintasCatalog, collections.quintasCompetitors, collections.quintasLeads, collections.quintasCalendar])

    const zone = detectZoneFromMessage(message)
    const competitorDoc = await db.collection(collections.quintasCompetitors).findOne({})
    const competitors = (competitorDoc?.competitors || []) as Array<{ pricePerNight?: number; location?: string; currency?: string }>
    const filteredCompetitors = zone
        ? competitors.filter((item) => normalizeText(String(item.location || '')).includes(normalizeText(zone)))
        : competitors
    const competitorPrices = filteredCompetitors.map((item) => Number(item.pricePerNight || 0)).filter((value) => value > 0)
    const avgCompetitorPrice = competitorPrices.length
        ? competitorPrices.reduce((sum, value) => sum + value, 0) / competitorPrices.length
        : 0

    const catalogProperties = await db.collection(collections.quintasCatalog).find({ type: 'property' }).toArray()
    const filteredCatalog = zone
        ? catalogProperties.filter((item) => normalizeText(String(item.location || '')).includes(normalizeText(zone)))
        : catalogProperties
    const ourPrices = filteredCatalog.map((item) => Number(item.basePricePerNight || 0)).filter((value) => value > 0)
    const avgOurPrice = ourPrices.length ? ourPrices.reduce((sum, value) => sum + value, 0) / ourPrices.length : 0
    const deltaPct = avgCompetitorPrice ? ((avgOurPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100 : 0

    const outbound = await computeOutbound()
    const occupancyPct = Number(outbound.occupancyPct || 0)
    const targetPct = Number(outbound.occupancyTargetPct || 0)
    const leadCount = Number((outbound.leads || []).length || 0)
    const shouldOutbound = Boolean(outbound.shouldOutbound)
    const referenceDate = competitorDoc?.referenceDate || ''
    const currency = competitorDoc?.competitors?.[0]?.currency || 'USD'

    if (!avgOurPrice && !avgCompetitorPrice) {
        return responseForLocale(
            locale,
            'No tengo suficientes datos de mercado para KPI ahora. Si queres, igual te comparto ocupacion y cantidad de leads a recontactar.',
            'I do not have enough market data for KPI right now. I can still share occupancy and lead count for outbound.'
        )
    }

    const marketDeltaLabel =
        deltaPct > 0
            ? responseForLocale(locale, `${deltaPct.toFixed(1)}% por encima`, `${deltaPct.toFixed(1)}% above`)
            : deltaPct < 0
            ? responseForLocale(locale, `${Math.abs(deltaPct).toFixed(1)}% por debajo`, `${Math.abs(deltaPct).toFixed(1)}% below`)
            : responseForLocale(locale, 'alineado', 'aligned')

    return responseForLocale(
        locale,
        [
            `KPI${zone ? ` (${zone})` : ''}:`,
            `- Precio promedio nuestro: ${formatPrice(avgOurPrice, currency)}.`,
            `- Precio promedio competencia: ${formatPrice(avgCompetitorPrice, currency)}.`,
            `- Diferencia: ${marketDeltaLabel}.`,
            `- Ocupacion proxima ventana: ${occupancyPct.toFixed(1)}% (objetivo ${targetPct.toFixed(0)}%).`,
            `- Leads para recontactar: ${leadCount}.`,
            shouldOutbound ? '- Recomendacion: activar outbound con promociones hoy.' : '- Recomendacion: no hace falta outbound por ahora.',
            referenceDate ? `- Referencia de mercado: ${referenceDate}.` : ''
        ]
            .filter(Boolean)
            .join('\n'),
        [
            `KPI${zone ? ` (${zone})` : ''}:`,
            `- Our average price: ${formatPrice(avgOurPrice, currency)}.`,
            `- Competitor average price: ${formatPrice(avgCompetitorPrice, currency)}.`,
            `- Gap: ${marketDeltaLabel}.`,
            `- Occupancy in next window: ${occupancyPct.toFixed(1)}% (target ${targetPct.toFixed(0)}%).`,
            `- Leads to recontact: ${leadCount}.`,
            shouldOutbound ? '- Recommendation: trigger outbound promotions today.' : '- Recommendation: no outbound needed right now.',
            referenceDate ? `- Market reference date: ${referenceDate}.` : ''
        ]
            .filter(Boolean)
            .join('\n')
    )
}

const renderOutboundTemplate = (templateText: string, lead: any, locale: string) => {
    const fallbackDateLabel = responseForLocale(locale, 'la fecha que consultaste', 'your requested date')
    const requestedMoment = moment(String(lead?.dateRequested || ''), 'YYYY-MM-DD', true)
    const dateLabel = requestedMoment.isValid() ? formatDateLabel(requestedMoment, locale) : fallbackDateLabel
    const name = String(lead?.name || responseForLocale(locale, 'cliente', 'customer')).trim()
    return templateText
        .replace(/\{\{\s*nombre\s*\}\}/gi, name || responseForLocale(locale, 'cliente', 'customer'))
        .replace(/\{\{\s*fecha\s*\}\}/gi, dateLabel)
}

const runMockOutboundFromChat = async (locale: string) => {
    const result = await runOutbound({ agentId: 'quintas', source: 'chat' })
    const leads = ((result.leads || []) as any[]).slice(0, 5)
    if (!result.shouldOutbound) {
        return responseForLocale(
            locale,
            `No hace falta outbound ahora. Ocupacion estimada: ${Number(result.occupancyPct || 0).toFixed(1)}% (objetivo ${Number(
                result.occupancyTargetPct || 0
            ).toFixed(0)}%).`,
            `No outbound needed now. Estimated occupancy: ${Number(result.occupancyPct || 0).toFixed(1)}% (target ${Number(
                result.occupancyTargetPct || 0
            ).toFixed(0)}%).`
        )
    }
    if (!leads.length) {
        return responseForLocale(
            locale,
            'No tengo leads elegibles para recontactar en este momento.',
            'There are no eligible leads to recontact right now.'
        )
    }

    const templates = (result.templates || []) as Array<{ id?: string; text?: string }>
    const selectedTemplate = templates.find((item) => String(item.text || '').trim()) || { id: 'default', text: '' }
    const templateText =
        String(selectedTemplate.text || '').trim() ||
        responseForLocale(
            locale,
            'Hola {{nombre}}, liberamos fechas para {{fecha}}. Si queres, te paso opciones y valor actualizado.',
            'Hi {{nombre}}, we opened dates for {{fecha}}. If you want, I can share options and updated pricing.'
        )

    const previews = leads.map((lead) => ({
        id: String(lead?.id || ''),
        phone: String(lead?.phone || ''),
        rendered: renderOutboundTemplate(templateText, lead, locale),
        name: String(lead?.name || ''),
        dateRequested: String(lead?.dateRequested || '')
    }))

    const db = await getManualAgentsDb()
    ensureToolAccess('write', [collectionNames.quintasLeads])
    const leadsCollection = db.collection(collectionNames.quintasLeads)
    const leadDoc = await leadsCollection.findOne({ type: 'seed' })
    if (Array.isArray(leadDoc?.leads) && leadDoc?.leads.length) {
        const now = new Date()
        const keyedPreviews = new Map<string, { rendered: string; name: string; phone: string }>()
        for (const item of previews) {
            const keys = [
                item.id ? `id:${item.id}` : '',
                item.phone ? `phone:${normalizePhoneForLookup(item.phone)}` : '',
                item.name ? `name:${normalizeIntentText(item.name)}` : ''
            ].filter(Boolean)
            for (const key of keys) keyedPreviews.set(key, { rendered: item.rendered, name: item.name, phone: item.phone })
        }
        const updatedLeads = (leadDoc.leads as any[]).map((lead) => {
            const keys = [
                lead?.id ? `id:${String(lead.id)}` : '',
                lead?.phone ? `phone:${normalizePhoneForLookup(String(lead.phone || ''))}` : '',
                lead?.name ? `name:${normalizeIntentText(String(lead.name || ''))}` : ''
            ].filter(Boolean)
            const matched = keys.map((key) => keyedPreviews.get(key)).find(Boolean)
            if (!matched) return lead
            return {
                ...lead,
                lastOutboundAt: now,
                lastOutboundSource: 'chat',
                lastOutboundTemplateId: selectedTemplate.id || 'default'
            }
        })
        await leadsCollection.updateOne({ type: 'seed' }, { $set: { type: 'seed', leads: updatedLeads, updatedAt: now } }, { upsert: true })
    }

    const lines = previews.map((item) => `- ${item.name || responseForLocale(locale, 'Cliente', 'Customer')}: ${item.rendered}`)
    return responseForLocale(
        locale,
        `Outbound mock ejecutado. Mensajes sugeridos (${previews.length}):\n${formatBulletList(lines)}`,
        `Mock outbound executed. Suggested messages (${previews.length}):\n${formatBulletList(lines)}`
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

const recordVisitEvent = async (input: {
    propertyId: string
    visitDate: string
    visitTime?: string
    guestName?: string
    phone?: string
    email?: string
}) => {
    const visitMoment = moment(input.visitDate, 'YYYY-MM-DD', true)
    if (!visitMoment.isValid()) return { ok: false as const }
    const year = visitMoment.year()
    const db = await getManualAgentsDb()
    const { quintasCalendar } = collectionNames
    ensureToolAccess('write', [quintasCalendar])
    const collection = db.collection(quintasCalendar)

    const normalizedTime = String(input.visitTime || '').trim()
    const duplicateFilter: Record<string, any> = {
        propertyId: input.propertyId,
        year,
        events: {
            $elemMatch: {
                status: 'visit',
                start: input.visitDate,
                end: input.visitDate
            }
        }
    }
    if (normalizedTime) {
        duplicateFilter.events.$elemMatch.notes = { $regex: new RegExp(escapeRegex(`hora:${normalizedTime}`), 'i') }
    }
    const duplicate = await collection.findOne(duplicateFilter)
    if (duplicate) return { ok: true as const, duplicate: true as const }

    const notes = [
        'visita coordinada desde chat',
        normalizedTime ? `hora:${normalizedTime}` : '',
        input.guestName ? `nombre:${input.guestName}` : '',
        input.phone ? `telefono:${input.phone}` : '',
        input.email ? `email:${input.email}` : ''
    ]
        .filter(Boolean)
        .join(' | ')

    await collection.updateOne(
        { propertyId: input.propertyId, year },
        {
            $push: {
                events: {
                    start: input.visitDate,
                    end: input.visitDate,
                    status: 'visit',
                    notes
                }
            },
            $set: { updatedAt: new Date() }
        },
        { upsert: true }
    )
    return { ok: true as const, duplicate: false as const }
}

const registerServiceRequest = async (input: {
    sessionId?: string
    propertyId?: string
    propertyName?: string
    requestedDate?: string
    requestType?: string
    message?: string
    guestName?: string
    phone?: string
    email?: string
}) => {
    const requestDate = moment(input.requestedDate || '', 'YYYY-MM-DD', true)
    const date = requestDate.isValid() ? requestDate.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')
    const requestId = `QSR-${nanoid(7).toUpperCase()}`
    const db = await getManualAgentsDb()
    ensureToolAccess('write', [collectionNames.manualAgentCalendarLogs])
    await db.collection(collectionNames.manualAgentCalendarLogs).insertOne({
        type: 'service_request',
        agentId: 'quintas',
        requestId,
        sessionId: input.sessionId || undefined,
        propertyId: input.propertyId || 'sin-definir',
        propertyName: input.propertyName || undefined,
        start: date,
        end: date,
        requestType: input.requestType || 'general',
        message: input.message || '',
        guestName: input.guestName || undefined,
        phone: input.phone || undefined,
        email: input.email || undefined,
        status: 'open',
        createdAt: new Date()
    })
    return { ok: true as const, requestId, date }
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
        email: input.email,
        phone: input.phone,
        channel: input.channel,
        dateRequested: input.dateRequested,
        property: input.propertyId,
        propertyId: input.propertyId,
        people: input.people,
        interest: input.interest,
        status: input.status || 'open',
        habitual: input.habitual ?? false,
        notes: input.notes
    } as Record<string, any>
    if (typeof input.negotiatedDiscountPct === 'number' && Number.isFinite(input.negotiatedDiscountPct)) {
        payload.negotiatedDiscountPct = clampDiscountPct(input.negotiatedDiscountPct)
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
    const leads = (doc?.leads || []) as Array<LeadInput & { email?: string }>
    const normalizedPhone = normalizePhoneForLookup(input.phone || '')
    return (
        leads.find(
            (lead) =>
                (input.id && String(lead.id || '') === String(input.id)) ||
                (normalizedPhone && normalizePhoneForLookup(String(lead.phone || '')) === normalizedPhone)
        ) || null
    )
}

const checkAvailability = async (input: { start: string; end?: string; propertyId?: string; locale?: string }) => {
    const startDate = moment(input.start, 'YYYY-MM-DD', true)
    const endDate = moment(input.end || input.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || !endDate.isValid()) {
        return { ok: false, reason: 'invalid_date' }
    }
    const locale = input.locale || 'es-AR'

    const [properties, restrictions] = await Promise.all([getCatalogProperties(), getRestrictions()])
    const filtered = input.propertyId ? properties.filter((p) => p.propertyId === input.propertyId) : properties
    const years = getAvailabilityYears(startDate, endDate)

    const available: Array<Record<string, any>> = []
    const unavailable: Array<Record<string, any>> = []

    for (const prop of filtered) {
        const calendars = await getCalendarDocs(prop.propertyId, years)
        const minStay = resolveMinNightsForRange({
            start: startDate,
            end: endDate,
            propertyMinNights: prop.minNights,
            restrictions
        })
        const minNights = minStay.minNights
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
                minNights,
                minNightsReason: minStay.minReason || ''
            })
        }
    }

    if (!available.length) {
        const reasonCounts = unavailable.reduce<Record<string, number>>((acc, item) => {
            const reason = String(item.reason || 'unknown')
            acc[reason] = (acc[reason] || 0) + 1
            return acc
        }, {})
        console.info('[manual-agents] quintas availability empty', {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD'),
            propertyId: input.propertyId,
            reasons: reasonCounts
        })
    }

    return { ok: true, available, unavailable, summary: formatAvailabilitySections(available, unavailable, locale) }
}

const findNearbyAvailabilityForLength = async (params: { start: string; days: number; propertyId?: string; maxOffsetDays?: number }) => {
    const startDate = moment(params.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || params.days < 1) return null

    const [properties, restrictions] = await Promise.all([getCatalogProperties(), getRestrictions()])
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
                const minStay = resolveMinNightsForRange({
                    start: candidateStart,
                    end: candidateEnd,
                    propertyMinNights: prop.minNights,
                    restrictions
                })
                const minNights = minStay.minNights || 1
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

const buildMissingDetailsQuestion = (params: { locale: string; needsProperty?: boolean; needsGuests?: boolean }) => {
    const parts: string[] = []
    if (params.needsProperty) {
        parts.push(params.locale === 'en-US' ? 'property' : 'quinta')
    }
    if (params.needsGuests) {
        parts.push(params.locale === 'en-US' ? 'guest count' : 'cantidad de personas')
    }
    if (!parts.length) return ''
    const list =
        parts.length === 1
            ? parts[0]
            : `${parts.slice(0, -1).join(params.locale === 'en-US' ? ', ' : ', ')}${params.locale === 'en-US' ? ' and ' : ' y '}${
                  parts[parts.length - 1]
              }`
    return responseForLocale(
        params.locale,
        `Para esas fechas necesito ${list}. Decime eso y sigo.`,
        `For those dates I need the ${list}. Share that and I will continue.`
    )
}

const buildHoldRecap = (params: {
    start: string
    end: string
    propertyName?: string
    guests?: number
    locale: string
}) => {
    const range = formatStaySpan(params.start, params.end, params.locale)
    const parts = [
        params.propertyName || '',
        range,
        typeof params.guests === 'number' ? (params.locale === 'en-US' ? `${params.guests} guests` : `${params.guests} personas`) : ''
    ].filter(Boolean)
    const summary = parts.join(', ')
    return responseForLocale(
        params.locale,
        `Antes de reservar: ${summary}. Confirmo?`,
        `Before I book: ${summary}. Should I confirm?`
    )
}

const buildFlexibleAvailabilityMessage = async (params: {
    monthIndex: number
    year: number
    days?: number
    weekendOnly?: boolean
    locale: string
    propertyId?: string
}) => {
    const days = Math.max(params.days || (params.weekendOnly ? 2 : 2), 1)
    const timezone = 'America/Argentina/Buenos_Aires'
    const monthStart = moment.tz({ year: params.year, month: params.monthIndex, day: 1 }, timezone).startOf('day')
    const monthEnd = monthStart.clone().endOf('month')
    const today = moment.tz(timezone).startOf('day')
    const options: string[] = []

    for (let day = 1; day <= monthEnd.date(); day += 1) {
        const start = moment.tz({ year: params.year, month: params.monthIndex, day }, timezone).startOf('day')
        if (start.isBefore(today, 'day')) continue
        if (params.weekendOnly && start.day() !== 6) continue
        const end = start.clone().add(days - 1, 'day')
        if (end.isAfter(monthEnd, 'day')) continue
        const availability = await checkAvailability({
            start: start.format('YYYY-MM-DD'),
            end: end.format('YYYY-MM-DD'),
            propertyId: params.propertyId,
            locale: params.locale
        })
        const okAvailability = availability as { available?: Array<Record<string, unknown>> }
        if (availability.ok && (okAvailability.available || []).length) {
            options.push(formatRangeWithYear(start, end, params.locale))
        }
        if (options.length >= 3) break
    }

    if (!options.length) return ''
    const monthName = monthStart.locale(params.locale === 'en-US' ? 'en' : 'es').format('MMMM')
    const header = responseForLocale(
        params.locale,
        `Opciones flexibles en ${monthName}:`,
        `Here are some flexible options in ${monthName}:`
    )
    const question = responseForLocale(params.locale, 'Cual te sirve?', 'Which one works best?')
    return `${header}\n${formatBulletList(options.map((option) => `- ${option}`))}\n\n${question}`
}

const buildMinNightsReply = (params: { start: string; minNights: number; locale: string; minReason?: string }) => {
    const startDate = moment(params.start, 'YYYY-MM-DD', true)
    if (!startDate.isValid() || params.minNights < 1) return ''
    const endDate = startDate.clone().add(params.minNights - 1, 'day')
    const rangeLabel = formatRangeLabel(startDate, endDate, params.locale)
    const reasonLabel = params.minReason
        ? responseForLocale(params.locale, ` (${params.minReason})`, ` (${params.minReason})`)
        : ''
    return responseForLocale(
        params.locale,
        `Para esas fechas el minimo es ${params.minNights} noches${reasonLabel}. Si queres, puedo revisar ${rangeLabel}. Te sirve?`,
        `The minimum stay is ${params.minNights} nights${reasonLabel}. I can check ${rangeLabel}. Interested?`
    )
}

const buildHoldFailureAnswer = (params: { reason?: string; locale: string }) => {
    const reason = String(params.reason || '')
    if (reason === 'invalid_date') {
        return responseForLocale(
            params.locale,
            'No pude validar esas fechas. Pasamelas en formato YYYY-MM-DD.',
            "I couldn't validate those dates. Please share them in YYYY-MM-DD format."
        )
    }
    if (reason === 'property_not_found') {
        return responseForLocale(
            params.locale,
            'No encontre esa quinta en el catalogo. Decime cual te interesa y lo reviso.',
            "I couldn't find that property in the catalog. Tell me which one you want and I will check."
        )
    }
    if (reason === 'date_blocked') {
        return responseForLocale(
            params.locale,
            'Esas fechas estan bloqueadas por reglas de temporada/evento.',
            'Those dates are blocked by season/event rules.'
        )
    }
    if (reason === 'date_unavailable') {
        return responseForLocale(
            params.locale,
            'Esas fechas ya no estan disponibles.',
            'Those dates are no longer available.'
        )
    }
    return responseForLocale(
        params.locale,
        'No pude generar la reserva con los datos actuales.',
        'I could not create the reservation with the current details.'
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
    const startDate = moment(startStr, 'YYYY-MM-DD', true)
    const endDate = moment(endStr, 'YYYY-MM-DD', true)
    const rangeLabel =
        startDate.isValid() && endDate.isValid() ? formatRangeLabel(startDate, endDate, locale) : formatStaySpan(startStr, endStr, locale)
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
            const minRuleEntry = minNightsBlocked
                .map((item) => ({
                    minNights: Number(item.minNights || 0),
                    minReason: String(item.minNightsReason || '')
                }))
                .sort((a, b) => b.minNights - a.minNights)[0]
            const minNights = Number(minRuleEntry?.minNights || 0)
            const minNightsReply = minNights
                ? buildMinNightsReply({ start: startStr, minNights, locale, minReason: minRuleEntry?.minReason || '' })
                : ''
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
    const priced = available
        .map((item) => ({
            price: Number(item.basePricePerNight || 0),
            currency: String(item.currency || '')
        }))
        .filter((item) => Number.isFinite(item.price) && item.price > 0)
    const minPrice = priced.length ? priced.reduce((min, item) => (item.price < min.price ? item : min), priced[0]) : null
    const perNightLabel = locale === 'en-US' ? 'per night' : 'por noche'
    const priceLine = minPrice
        ? responseForLocale(
              locale,
              `Precio desde ${formatPrice(minPrice.price, minPrice.currency)} ${perNightLabel}.`,
              `From ${formatPrice(minPrice.price, minPrice.currency)} ${perNightLabel}.`
          )
        : ''
    const availabilityLine = responseForLocale(
        locale,
        `Para ${rangeLabel} tengo:\n\n${summary}`,
        `For ${rangeLabel}, I have:\n\n${summary}`
    )
    return {
        answer: priceLine ? `${availabilityLine}\n\n${priceLine}` : availabilityLine
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
              `Costo base: ${formatPrice(property.basePricePerNight, property.currency)} ${perNightLabel}. El total depende de fechas, noches y cargos. Si queres, decime presupuesto por noche y cantidad de personas.`,
              `Base cost: ${formatPrice(property.basePricePerNight, property.currency)} ${perNightLabel}. Total depends on dates, nights, and fees. If you share your per-night budget and guest count, I can narrow it down.`
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
        'Costos: los precios base estan arriba. El total depende de fechas, noches y cargos. Si queres, decime presupuesto por noche y cantidad de personas.',
        'Costs: base prices are above. The total depends on dates, nights, and fees. If you share your per-night budget and guest count, I can narrow it down.'
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
        `Reglas de musica: ${musicDay}. De noche: ${musicNight}. Si queres, te paso el detalle completo.`,
        `Music rules: ${musicDay}. At night: ${musicNight}. If you want, I can share the full details.`
    )
}

const buildPaymentReply = (restrictions: RestrictionsDoc, locale = 'es-AR') => {
    const payment = restrictions.payment || {}
    const depositPct = payment.depositPct ?? 0
    const deadlineHours = payment.depositDeadlineHours ?? 0
    const fullPaymentDays = payment.fullPaymentDaysBefore ?? 0
    const methods = payment.acceptedMethods?.join(', ') || 'transferencia'
    const habitualPct = restrictions.discounts?.enabled ? Number(restrictions.discounts?.habitualPct || 0) : 0
    const transfer = payment.bankTransfer || {}
    const transferParts = [
        transfer.accountName ? `${locale === 'en-US' ? 'Account name' : 'Titular'}: ${transfer.accountName}` : '',
        transfer.bank ? `${locale === 'en-US' ? 'Bank' : 'Banco'}: ${transfer.bank}` : '',
        transfer.cbu ? `CBU: ${transfer.cbu}` : '',
        transfer.alias ? `${locale === 'en-US' ? 'Alias' : 'Alias'}: ${transfer.alias}` : '',
        transfer.concept ? `${locale === 'en-US' ? 'Concept' : 'Concepto'}: ${transfer.concept}` : ''
    ].filter(Boolean)
    const baseLine = responseForLocale(
        locale,
        `El deposito/anticipo es del ${depositPct}% y vence en ${deadlineHours} horas. El pago total es ${fullPaymentDays} dias antes. Medios: ${methods}.`,
        `Deposit is ${depositPct}% due within ${deadlineHours} hours. Full payment is due ${fullPaymentDays} days before check-in. Methods: ${methods}.`
    )
    const transferHint = transferParts.length
        ? responseForLocale(locale, 'Si queres, te paso los datos de transferencia.', 'If you want, I can share bank transfer details.')
        : responseForLocale(locale, 'Si queres, te paso los datos oficiales de transferencia.', 'If you want, I can share the official transfer details.')
    const discountLine =
        habitualPct > 0
            ? responseForLocale(
                  locale,
                  `Descuento habitual: hasta ${habitualPct}% para clientes recurrentes verificados.`,
                  `Returning-customer discount: up to ${habitualPct}% for verified repeat clients.`
              )
            : ''
    return [baseLine, discountLine, transferHint].filter(Boolean).join(' ').trim()
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
        '- Cuando menciones rangos de fechas, usa formato ingreso/salida con meses en texto (ej: ingreso 5 de enero de 2026, salida 10 de enero de 2026).',
        '- Si consultan por quintas, comodidades o costos, inclui disponibilidad (o pedi fechas), comodidades y costo base o como cotizar.',
        '- Para catalogo o listas de quintas, usa vinetas y separa cada opcion con una linea en blanco.',
        '- Tono: cercano, natural y humano. Responde en 1-3 frases cortas salvo cuando listes opciones.',
        '- Si preguntan por reglas o pagos, responde breve y ofrece ampliar el detalle.',
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
        'Usa las herramientas para disponibilidad, reglas, catalogo, leads y reservas con deposito/anticipo. No inventes datos.',
        'Esta demo usa datos mock: si piden un dato fuera de herramientas, aclaralo y ofrece pase a humano.'
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
                        availabilityRange?.start && availabilityRange?.end
                            ? formatStaySpan(availabilityRange.start, availabilityRange.end, locale)
                            : availabilityRange?.start
                            ? formatDateLabelFromISO(availabilityRange.start, locale)
                            : ''
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
            const holdMeta = metadata as { type?: string; hold?: { propertyId?: string; start?: string; end?: string } } | undefined
            if (holdMeta?.type === 'holdCard' && holdMeta.hold?.start && holdMeta.hold?.end) {
                let propertyName = holdMeta.hold.propertyId || ''
                if (holdMeta.hold.propertyId) {
                    const properties = await getCatalogProperties()
                    const match = properties.find((item) => item.propertyId === holdMeta.hold?.propertyId)
                    propertyName = match?.name || match?.propertyId || propertyName
                }
                const summaryLine = buildHoldSummaryLine({
                    propertyName,
                    start: holdMeta.hold.start,
                    end: holdMeta.hold.end,
                    locale
                })
                if (summaryLine && !answer.includes(summaryLine) && !answer.includes('Resumen:') && !answer.includes('Summary:')) {
                    answer = `${answer}\n\n${summaryLine}`
                }
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
            if (sessionId && (name === 'check_availability' || name === 'create_hold')) {
                const start = typeof args.start === 'string' ? args.start : ''
                const end = typeof args.end === 'string' ? args.end : ''
                const updatePayload: Record<string, any> = {}
                if (start) {
                    updatePayload.lastRangeStart = start
                }
                if (end || start) {
                    updatePayload.lastRangeEnd = end || start
                }
                if (typeof args.propertyId === 'string' && args.propertyId) {
                    updatePayload.lastPropertyId = args.propertyId
                }
                if (Object.keys(updatePayload).length) {
                    if (start || end) {
                        updatePayload.lastRangeUpdatedAt = new Date()
                    }
                    updatePayload.updatedAt = new Date()
                    const db = await getManualAgentsDb()
                    const collections = collectionNames
                    ensureToolAccess('write', [collections.manualAgentSessions])
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: updatePayload }
                    )
                }
            }
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
                const locale = typeof args.locale === 'string' ? args.locale : 'es-AR'
                if (!property) {
                    return {
                        output: {
                            ok: false,
                            reason: 'property_not_found',
                            message: buildHoldFailureAnswer({ reason: 'property_not_found', locale })
                        }
                    }
                }
                const startDate = moment(args.start, 'YYYY-MM-DD', true)
                const endDate = moment(args.end, 'YYYY-MM-DD', true)
                if (!startDate.isValid() || !endDate.isValid()) {
                    return {
                        output: {
                            ok: false,
                            reason: 'invalid_date',
                            message: buildHoldFailureAnswer({ reason: 'invalid_date', locale })
                        }
                    }
                }
                const minStay = resolveMinNightsForRange({
                    start: startDate,
                    end: endDate,
                    propertyMinNights: property.minNights,
                    restrictions
                })
                const stayLength = endDate.diff(startDate, 'days') + 1
                if (stayLength < minStay.minNights) {
                    return {
                        output: {
                            ok: false,
                            reason: 'min_nights',
                            minNights: minStay.minNights,
                            message: buildMinNightsReply({
                                start: args.start,
                                minNights: minStay.minNights,
                                locale,
                                minReason: minStay.minReason || ''
                            })
                        }
                    }
                }
                const nights = startDate.isValid() && endDate.isValid() ? Math.max(endDate.diff(startDate, 'days'), 1) : 1
                const pricePerNight = property?.basePricePerNight
                const currency = property?.currency || 'USD'
                const habitualLead = await findHabitualLeadByIdentity({
                    id: args.leadId,
                    name: args.name,
                    email: args.email,
                    phone: args.phone
                })
                const customDiscountPct = Boolean(habitualLead?.habitual) ? pickNegotiatedDiscountPct({ lead: habitualLead }) : 0
                const pricing = calculateDiscountBreakdown({
                    pricePerNight,
                    nights,
                    currency,
                    restrictions,
                    isHabitual: Boolean(habitualLead?.habitual),
                    customDiscountPct
                })
                const totalAmount = pricing.finalTotalAmount ?? pricing.totalAmount
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
                    return {
                        output: {
                            ok: false,
                            reason: hold.reason,
                            message: buildHoldFailureAnswer({ reason: hold.reason, locale })
                        }
                    }
                }
                const holdPayload = {
                    propertyId: args.propertyId,
                    start: args.start,
                    end: args.end,
                    holdExpires: hold.holdExpires?.toISOString(),
                    leadId: args.leadId,
                    nights,
                    pricePerNight: pricing.finalPricePerNight ?? pricePerNight,
                    currency,
                    totalAmount,
                    depositPct,
                    depositAmount,
                    discountPct: pricing.discountPct,
                    discountAmount: pricing.discountAmount
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
                    email: args.email,
                    phone: args.phone,
                    channel: args.channel,
                    dateRequested: args.dateRequested,
                    propertyId: args.propertyId,
                    people: args.people,
                    interest: args.interest,
                    status: args.status,
                    habitual: args.habitual,
                    negotiatedDiscountPct: args.negotiatedDiscountPct,
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
                email: { type: 'string' },
                phone: { type: 'string' },
                channel: { type: 'string' },
                dateRequested: { type: 'string' },
                propertyId: { type: 'string' },
                people: { type: 'number' },
                interest: { type: 'string' },
                status: { type: 'string' },
                habitual: { type: 'boolean' },
                negotiatedDiscountPct: { type: 'number' },
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
    const fallbackName = extractName(message)
    const fallbackEmail = extractEmail(message)
    const fallbackPhone = extractPhone(message)
    const stayLength = extractStayLengthDetails(message)
    const requestedDays = stayLength?.value
    const dateOptions = { preferMonthFirst: locale === 'en-US' }

    const [catalogMeta, catalogProperties, restrictions] = await Promise.all([getCatalogMeta(), getCatalogProperties(), getRestrictions()])

    const earlyCheckinSignal =
        lower.includes('ingreso temprano') || lower.includes('check-in temprano') || lower.includes('early check-in')
    const lateCheckoutSignal =
        lower.includes('salida tarde') || lower.includes('check-out tarde') || lower.includes('late check-out')
    const lateCheckinSignal = lower.includes('llego tarde') || lower.includes('llegamos tarde') || lower.includes('late check-in')
    const earlyCheckoutSignal =
        lower.includes('salida temprano') || lower.includes('check-out temprano') || lower.includes('early check-out')
    const checkInOutSignal =
        earlyCheckinSignal ||
        lateCheckoutSignal ||
        lateCheckinSignal ||
        earlyCheckoutSignal ||
        lower.includes('check-in') ||
        lower.includes('check out') ||
        lower.includes('check-out') ||
        lower.includes('checkin') ||
        lower.includes('checkout') ||
        lower.includes('ingreso') ||
        lower.includes('salida') ||
        lower.includes('horario')
    const hasDateSignals =
        extractDates(message, dateOptions).length > 0 ||
        Boolean(parseMonthRange(message)) ||
        Boolean(parseDayRange(message)) ||
        Boolean(parseRelativeDateRange(message))
    const outboundExecutionIntent = isOutboundExecutionIntent(message)
    const discountNegotiationIntent = isDiscountNegotiationIntent(message)
    const requestedDiscountPct = extractNegotiatedDiscountPct(message)
    const serviceRequestIntent = isServiceRequestIntent(message)
    const fallbackShouldCaptureLead =
        Boolean(fallbackName || fallbackEmail || fallbackPhone) &&
        Boolean(
            hasDateSignals ||
                lower.includes('visita') ||
                lower.includes('reserv') ||
                lower.includes('alquiler') ||
                lower.includes('precio') ||
                serviceRequestIntent
        )
    if (fallbackShouldCaptureLead) {
        const matchedLead = await findHabitualLeadByIdentity({
            name: fallbackName,
            email: fallbackEmail,
            phone: fallbackPhone
        })
        const firstDate = extractDates(message, dateOptions)[0]?.format('YYYY-MM-DD')
        await upsertLead({
            id: matchedLead?.id || (fallbackEmail ? `lead-${normalizeIntentText(fallbackEmail)}` : undefined),
            name: fallbackName || matchedLead?.name || undefined,
            email: fallbackEmail || (matchedLead as any)?.email || undefined,
            phone: fallbackPhone || matchedLead?.phone || undefined,
            dateRequested: firstDate,
            propertyId: detectProperty(message, catalogProperties)?.propertyId || undefined,
            interest: lower.includes('visita') ? 'visita' : lower.includes('reserv') || lower.includes('alquiler') ? 'alquiler' : 'consulta',
            status: lower.includes('visita') ? 'scheduled' : 'open',
            habitual: Boolean(matchedLead?.habitual),
            negotiatedDiscountPct:
                matchedLead?.habitual && discountNegotiationIntent
                    ? pickNegotiatedDiscountPct({ lead: matchedLead, requestedPct: requestedDiscountPct })
                    : undefined,
            notes: input.sessionId ? `session:${input.sessionId}` : undefined
        })
    }

    if (isRestartRequest(message)) {
        await resetQuintasSessionFlow(input.sessionId || '')
        return {
            answer: responseForLocale(
                locale,
                'Listo, arrancamos de cero. Pasame fechas, cantidad de personas y si ya tenes una quinta en mente.',
                'Done, we can start from scratch. Share dates, guest count, and if you already have a property in mind.'
            )
        }
    }

    if (isDataScopeQuestion(message)) {
        return { answer: buildMockScopeAnswer(locale) }
    }

    if (isUnsupportedMockDataQuestion(message)) {
        return { answer: buildUnsupportedMockDataAnswer(locale) }
    }

    if (isMarketKpiIntent(message)) {
        return { answer: await buildMarketKpiAnswer(locale, message) }
    }

    if (outboundExecutionIntent) {
        return { answer: await runMockOutboundFromChat(locale) }
    }

    if (isSmallTalkOnly(message)) {
        return {
            answer: responseForLocale(
                locale,
                'Todo bien, gracias. Si queres, seguimos con fechas y cantidad de personas.',
                "I'm doing great, thanks. If you want, we can continue with dates and guest count."
            )
        }
    }

    if (checkInOutSignal && !hasDateSignals) {
        const checkInTime = restrictions.checkInOut?.checkInTime
        const checkOutTime = restrictions.checkInOut?.checkOutTime
        const base = checkInTime || checkOutTime
            ? responseForLocale(
                  locale,
                  `Ingreso ${checkInTime || 'a coordinar'} y salida ${checkOutTime || 'a coordinar'}.`,
                  `Check-in ${checkInTime || 'by arrangement'} and check-out ${checkOutTime || 'by arrangement'}.`
              )
            : responseForLocale(
                  locale,
                  'El horario depende de la quinta. Decime cual te interesa y te confirmo.',
                  'Check-in/out times depend on the property. Tell me which one and I will confirm.'
              )
        const notes = restrictions.checkInOut?.notes || ''
        const flexibilityLine =
            earlyCheckinSignal || lateCheckoutSignal
                ? responseForLocale(
                      locale,
                      'Ingreso temprano o salida tarde: sujeto a disponibilidad.',
                      'Early check-in or late check-out: subject to availability.'
                  )
                : ''
        const lateArrivalQuestion = lateCheckinSignal
            ? responseForLocale(
                  locale,
                  'Si vas a llegar tarde, decime el horario aproximado.',
                  'If you will arrive late, share the approximate time.'
              )
            : ''
        const earlyDepartureQuestion = earlyCheckoutSignal
            ? responseForLocale(
                  locale,
                  'Si necesitas salida temprano, decime el horario aproximado.',
                  'If you need an early check-out, share the approximate time.'
              )
            : ''
        return { answer: [base, notes, flexibilityLine, lateArrivalQuestion, earlyDepartureQuestion].filter(Boolean).join(' ') }
    }

    if (isHumanHandoffRequest(message)) {
        return {
            answer: responseForLocale(
                locale,
                'Claro, te puedo pasar con un humano. Si queres, compartime fechas y la quinta y dejo todo listo.',
                'Sure, I can hand this over to a human. If you want, share dates and the property and I will leave everything ready.'
            )
        }
    }

    if (isHelpOnly(message)) {
        return {
            answer: responseForLocale(
                locale,
                'Te ayudo con disponibilidad, precios, reservas, pagos y visitas. Pasame fechas y cantidad de personas y te propongo opciones. Esta demo usa datos mock.',
                'I can help with availability, prices, bookings, payments, and visits. Share your dates and guest count and I will propose options. This demo uses mock data.'
            )
        }
    }

    if (isGoodbyeOnly(message)) {
        return {
            answer: responseForLocale(
                locale,
                'Perfecto, lo dejamos aca. Cuando quieras seguir, pasame fechas y lo retomamos.',
                'Perfect, we can pause here. When you want to continue, share dates and I will pick it up.'
            )
        }
    }

    if (isClearlyOffTopic(message)) {
        return {
            answer: responseForLocale(
                locale,
                'Perdon, solo puedo ayudar con quintas (disponibilidad, precios, reservas, pagos o visitas). Decime fechas y cantidad de personas y te ayudo.',
                'Sorry, I can only help with quintas (availability, prices, reservations, payments or visits). Share your dates and number of guests and I will help.'
            )
        }
    }

    if (serviceRequestIntent && !lower.includes('reserv')) {
        const property = detectProperty(message, catalogProperties)
        const serviceType = detectServiceRequestType(message)
        const requestDate = extractDates(message, dateOptions)[0]?.format('YYYY-MM-DD')
        const result = await registerServiceRequest({
            sessionId: input.sessionId,
            propertyId: property?.propertyId,
            propertyName: property?.name || property?.propertyId,
            requestedDate: requestDate,
            requestType: serviceType,
            message,
            guestName: fallbackName || undefined,
            phone: fallbackPhone || undefined,
            email: fallbackEmail || undefined
        })
        await upsertLead({
            id: fallbackPhone ? undefined : fallbackEmail ? `lead-${normalizeIntentText(fallbackEmail)}` : undefined,
            name: fallbackName || undefined,
            email: fallbackEmail || undefined,
            phone: fallbackPhone || undefined,
            propertyId: property?.propertyId,
            dateRequested: requestDate,
            interest: 'pedido',
            status: 'open',
            notes: `pedido:${serviceType} #${result.requestId}`
        })
        return {
            answer: responseForLocale(
                locale,
                `Listo, registre tu pedido (${result.requestId})${
                    property?.name ? ` para ${property.name}` : ''
                }. Te aviso por aca cuando haya actualizacion.`,
                `Done, I logged your request (${result.requestId})${property?.name ? ` for ${property.name}` : ''}. I will update you here once there is progress.`
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
        const dates = extractDates(message, dateOptions)
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
        const matchedLead = await findHabitualLeadByIdentity({
            name: fallbackName,
            email: fallbackEmail,
            phone: fallbackPhone
        })
        const isHabitual = Boolean(matchedLead?.habitual)
        if (!isHabitual) {
            return {
                answer: responseForLocale(
                    locale,
                    'Los descuentos son para clientes habituales. Si ya alquilaste antes, avisame y lo reviso.',
                    'Discounts are for returning customers. If you have rented with us before, tell me and I will check.'
                )
            }
        }

        if (discountNegotiationIntent && typeof requestedDiscountPct === 'number') {
            const negotiatedPct = pickNegotiatedDiscountPct({ lead: matchedLead, requestedPct: requestedDiscountPct })
            await upsertLead({
                id: matchedLead?.id || (fallbackEmail ? `lead-${normalizeIntentText(fallbackEmail)}` : undefined),
                name: fallbackName || matchedLead?.name || undefined,
                email: fallbackEmail || (matchedLead as any)?.email || undefined,
                phone: fallbackPhone || matchedLead?.phone || undefined,
                habitual: true,
                negotiatedDiscountPct: negotiatedPct,
                interest: matchedLead?.interest || 'alquiler',
                status: matchedLead?.status || 'open',
                notes: `descuento negociado ${negotiatedPct}%`
            })
            return {
                answer: responseForLocale(
                    locale,
                    `Perfecto, deje registrado un descuento del ${negotiatedPct}% para tu perfil habitual.`,
                    `Perfect, I recorded a ${negotiatedPct}% discount for your returning-customer profile.`
                )
            }
        }

        const configuredPct = Math.max(Number(restrictions.discounts?.habitualPct || 0), 0)
        return {
            answer: responseForLocale(
                locale,
                `Podemos aplicar descuento por cliente habitual. Hoy tengo ${configuredPct}% cargado; si queres otro porcentaje, decime cual.`,
                `We can apply a returning-customer discount. Right now I have ${configuredPct}% configured; if you want another percentage, tell me which one.`
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

    const dates = extractDates(message, dateOptions)
    if (dates.length) {
        const dateStr = dates[0].format('YYYY-MM-DD')
        const endStr = dates[1]?.format('YYYY-MM-DD') || (requestedDays ? dates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : dateStr)
        const property = detectProperty(message, catalogProperties)

        if (lower.includes('reserv') || lower.includes('deposit') || lower.includes('anticip')) {
            if (property) {
                const startMoment = moment(dateStr, 'YYYY-MM-DD', true)
                const provisionalEndMoment = dates[1]
                    ? moment(dates[1].format('YYYY-MM-DD'), 'YYYY-MM-DD', true)
                    : moment(dateStr, 'YYYY-MM-DD', true)
                const minStay = resolveMinNightsForRange({
                    start: startMoment,
                    end: provisionalEndMoment,
                    propertyMinNights: property.minNights,
                    restrictions
                })
                const endDate =
                    dates[1]?.format('YYYY-MM-DD') || dates[0].clone().add(Math.max(minStay.minNights, 1), 'days').format('YYYY-MM-DD')
                const finalStartMoment = moment(dateStr, 'YYYY-MM-DD', true)
                const finalEndMoment = moment(endDate, 'YYYY-MM-DD', true)
                const stayLength = finalEndMoment.diff(finalStartMoment, 'days') + 1
                if (stayLength < minStay.minNights) {
                    return {
                        answer: buildMinNightsReply({
                            start: dateStr,
                            minNights: minStay.minNights,
                            locale,
                            minReason: minStay.minReason || ''
                        })
                    }
                }
                ensureToolAccess('write', [collectionNames.quintasCalendar])
                const hold = await createHold({
                    propertyId: property.propertyId,
                    start: dateStr,
                    end: endDate,
                    holdHours: restrictions.payment?.holdHours as number | undefined,
                    notes: 'reserva con deposito/anticipo desde chat'
                })

                if (!hold.ok) {
                    const failure = hold as { reason?: string }
                    const baseAnswer = buildHoldFailureAnswer({ reason: failure.reason, locale })
                    const suggestion = await buildNearbyAvailabilityMessage({
                        start: dateStr,
                        days: requestedDays,
                        propertyId: property.propertyId,
                        locale
                    })
                    if (suggestion) {
                        return { answer: `${baseAnswer} ${suggestion}`.trim() }
                    }
                    return {
                        answer: `${baseAnswer} ${responseForLocale(
                            locale,
                            'Si queres, te ofrezco alternativas.',
                            'If you want, I can offer alternatives.'
                        )}`.trim()
                    }
                }

                const nights = Math.max(moment(endDate).diff(moment(dateStr), 'days'), 1)
                const pricePerNight = property.basePricePerNight
                const currency = property.currency || 'USD'
                const habitualLead = await findHabitualLeadByIdentity({
                    name: fallbackName,
                    email: fallbackEmail,
                    phone: fallbackPhone
                })
                const customDiscountPct = Boolean(habitualLead?.habitual)
                    ? pickNegotiatedDiscountPct({ lead: habitualLead, requestedPct: requestedDiscountPct })
                    : 0
                const pricing = calculateDiscountBreakdown({
                    pricePerNight,
                    nights,
                    currency,
                    restrictions,
                    isHabitual: Boolean(habitualLead?.habitual),
                    customDiscountPct
                })
                const totalAmount = pricing.finalTotalAmount ?? pricing.totalAmount
                const depositPct = restrictions.payment?.depositPct ?? 0
                const depositAmount = typeof totalAmount === 'number' ? Number(((totalAmount * depositPct) / 100).toFixed(2)) : undefined
                const deadlineHours = restrictions.payment?.depositDeadlineHours ?? 0
                const fullPaymentDays = restrictions.payment?.fullPaymentDaysBefore ?? 0
                const discountLine =
                    pricing.discountPct > 0
                        ? responseForLocale(
                              locale,
                              `Descuento cliente habitual (${pricing.discountPct}%): -${pricing.discountAmount.toFixed(0)} ${currency}.`,
                              `Returning-customer discount (${pricing.discountPct}%): -${pricing.discountAmount.toFixed(0)} ${currency}.`
                          )
                        : ''
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
                const summaryLine = buildHoldSummaryLine({
                    propertyName: property.name || property.propertyId,
                    start: dateStr,
                    end: endDate,
                    locale
                })
                const summaryBlock = summaryLine ? `${summaryLine}\n\n` : ''

                return {
                    answer: responseForLocale(
                        locale,
                        `Listo, te reservo por 24h.\n` +
                            summaryBlock +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'a confirmar'}.\n` +
                            `${discountLine ? `${discountLine}\n` : ''}` +
                            `Deposito (${depositPct}%): ${
                                typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'a confirmar'
                            } (vence en ${deadlineHours}h).\n` +
                            `Pago total ${fullPaymentDays} dias antes.${transferText}\n\n` +
                            'Cuando tengas el comprobante, adjuntalo por aca y confirmo la reserva.',
                        `Done, I reserved it for 24h.\n` +
                            summaryBlock +
                            `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'to be confirmed'}.\n` +
                            `${discountLine ? `${discountLine}\n` : ''}` +
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
                            pricePerNight: pricing.finalPricePerNight ?? pricePerNight,
                            currency,
                            totalAmount,
                            depositPct,
                            depositAmount,
                            discountPct: pricing.discountPct,
                            discountAmount: pricing.discountAmount
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
        const budgetLine =
            locale === 'en-US'
                ? 'If you share your per-night budget and guest count, I can narrow it down.'
                : 'Si me decis presupuesto por noche y cantidad de personas, lo ajusto.'
        return {
            answer: responseForLocale(
                locale,
                `Aca tenes precios base por noche:\n${formatBulletList(list)}\n\n${budgetLine}`,
                `Base nightly prices:\n${formatBulletList(list)}\n\n${budgetLine}`
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
    let lastRangeUpdatedAt: string | Date | undefined
    let lastPropertyId: string | undefined
    let lastGuests: number | undefined
    let lastIntent: string | undefined
    let lastName: string | undefined
    let lastEmail: string | undefined
    let lastPhone: string | undefined
    let lastHabitual: boolean | undefined
    let lastNegotiatedDiscountPct: number | undefined
    let nameUseCount: number | undefined
    let frictionCount: number | undefined
    let confusionCount: number | undefined
    let lastReplyKind: string | undefined
    let lastIntentSummary: string | undefined
    let lastTopic: string | undefined
    let pendingDateConfirm: boolean | undefined
    let pendingHoldConfirm: boolean | undefined
    let lastVisitDate: string | undefined
    let lastVisitPropertyId: string | undefined
    let lastVisitTime: string | undefined
    let lastVisitPending: boolean | undefined
    let sessionMessages: Array<{ role: string; content: string }> = []
    let currentTopic = ''

    if (sessionId) {
        const session = await db
            .collection<{
                locale?: string
                lastMonthIndex?: number
                lastYear?: number
                lastRangeStart?: string
                lastRangeEnd?: string
                lastRangeUpdatedAt?: Date
                lastPropertyId?: string
                lastGuests?: number
                lastIntent?: string
                lastName?: string
                lastEmail?: string
                lastPhone?: string
                lastHabitual?: boolean
                lastNegotiatedDiscountPct?: number
                nameUseCount?: number
                frictionCount?: number
                confusionCount?: number
                lastReplyKind?: string
                lastIntentSummary?: string
                lastTopic?: string
                pendingDateConfirm?: boolean
                pendingHoldConfirm?: boolean
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
        lastRangeUpdatedAt = session?.lastRangeUpdatedAt
        lastPropertyId = session?.lastPropertyId
        lastGuests = session?.lastGuests
        lastIntent = session?.lastIntent
        lastName = session?.lastName
        lastEmail = session?.lastEmail
        lastPhone = session?.lastPhone
        lastHabitual = session?.lastHabitual
        lastNegotiatedDiscountPct = session?.lastNegotiatedDiscountPct
        nameUseCount = session?.nameUseCount
        frictionCount = session?.frictionCount
        confusionCount = session?.confusionCount
        lastReplyKind = session?.lastReplyKind
        lastIntentSummary = session?.lastIntentSummary
        lastTopic = session?.lastTopic
        pendingDateConfirm = session?.pendingDateConfirm
        pendingHoldConfirm = session?.pendingHoldConfirm
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
    if (detectedEmail) {
        lastEmail = detectedEmail.toLowerCase()
    }
    if (detectedPhone) {
        lastPhone = detectedPhone
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
        options?: {
            replyKind?: string
            intentSummary?: string
            frictionAction?: 'increase' | 'reset'
            pendingDateConfirm?: boolean
            pendingHoldConfirm?: boolean
        }
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
        if (currentTopic && currentTopic !== lastTopic) {
            lastTopic = currentTopic
            updates.lastTopic = lastTopic
        }
        if (options?.pendingDateConfirm !== undefined) {
            pendingDateConfirm = options.pendingDateConfirm
            updates.pendingDateConfirm = pendingDateConfirm
        }
        if (options?.pendingHoldConfirm !== undefined) {
            pendingHoldConfirm = options.pendingHoldConfirm
            updates.pendingHoldConfirm = pendingHoldConfirm
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
        options?: {
            replyKind?: string
            intentSummary?: string
            frictionAction?: 'increase' | 'reset'
            pendingDateConfirm?: boolean
            pendingHoldConfirm?: boolean
        }
    ) => {
        return respondWith({ answer, metadata }, options)
    }

    const finalizeHoldReservation = async () => {
        if (!lastRangeStart || !lastRangeEnd || !lastPropertyId) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Para reservar necesito fechas y la quinta.',
                    'To reserve I need the dates and the property.'
                ),
                undefined,
                { intentSummary: 'awaiting_details', frictionAction: 'increase' }
            )
        }
        const property = catalogProperties.find((item) => item.propertyId === lastPropertyId)
        if (!property) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'No encontre esa quinta. Decime cual te interesa.',
                    'I could not find that property. Tell me which one you want.'
                ),
                undefined,
                { intentSummary: 'awaiting_property', frictionAction: 'increase' }
            )
        }
        const startMoment = moment(lastRangeStart, 'YYYY-MM-DD', true)
        const endMoment = moment(lastRangeEnd, 'YYYY-MM-DD', true)
        if (!startMoment.isValid() || !endMoment.isValid()) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'No pude validar esas fechas. Pasamelas en formato YYYY-MM-DD.',
                    "I couldn't validate those dates. Please share them in YYYY-MM-DD format."
                ),
                undefined,
                { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
            )
        }
        const minStay = resolveMinNightsForRange({
            start: startMoment,
            end: endMoment,
            propertyMinNights: property.minNights,
            restrictions
        })
        const stayLength = endMoment.diff(startMoment, 'days') + 1
        if (stayLength < minStay.minNights) {
            return respond(
                buildMinNightsReply({
                    start: lastRangeStart,
                    minNights: minStay.minNights,
                    locale: lockedLocale,
                    minReason: minStay.minReason || ''
                }),
                undefined,
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
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
            const failure = hold as { reason?: string }
            const baseAnswer = buildHoldFailureAnswer({ reason: failure.reason, locale: lockedLocale })
            const suggestion = await buildNearbyAvailabilityMessage({
                start: lastRangeStart,
                days: requestedDays,
                propertyId: property.propertyId,
                locale: lockedLocale
            })
            if (suggestion) {
                return respond(`${baseAnswer} ${suggestion}`.trim(), undefined, {
                    replyKind: 'availability',
                    intentSummary: 'availability_options',
                    frictionAction: 'reset'
                })
            }
            return respond(
                `${baseAnswer} ${responseForLocale(
                    lockedLocale,
                    'Si queres, te ofrezco alternativas.',
                    'If you want, I can offer alternatives.'
                )}`.trim(),
                undefined,
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }

        const matchedLead = await findHabitualLeadByIdentity({
            name: lastName,
            email: lastEmail,
            phone: lastPhone
        })
        const effectiveHabitual = Boolean(matchedLead?.habitual || lastHabitual)
        const customDiscountPct = effectiveHabitual
            ? pickNegotiatedDiscountPct({ lead: matchedLead, sessionPct: lastNegotiatedDiscountPct })
            : 0
        await upsertLead({
            id: matchedLead?.id || (lastEmail ? `lead-${normalizeIntentText(lastEmail)}` : undefined),
            name: lastName || undefined,
            email: lastEmail || undefined,
            phone: lastPhone || undefined,
            propertyId: property.propertyId,
            dateRequested: lastRangeStart,
            people: lastGuests || matchedLead?.people,
            interest: 'alquiler',
            status: 'open',
            habitual: effectiveHabitual,
            negotiatedDiscountPct: customDiscountPct > 0 ? customDiscountPct : undefined,
            notes: lastEmail ? `email: ${lastEmail}` : undefined
        })
        if (effectiveHabitual && !lastHabitual) {
            lastHabitual = true
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastHabitual: true, updatedAt: new Date() } }
                )
            }
        }

        const nights = Math.max(moment(lastRangeEnd).diff(moment(lastRangeStart), 'days'), 1)
        const pricePerNight = property.basePricePerNight
        const currency = property.currency || 'USD'
        const pricing = calculateDiscountBreakdown({
            pricePerNight,
            nights,
            currency,
            restrictions,
            isHabitual: effectiveHabitual,
            customDiscountPct
        })
        const totalAmount = pricing.finalTotalAmount ?? pricing.totalAmount
        const depositPct = restrictions.payment?.depositPct ?? 0
        const depositAmount = typeof totalAmount === 'number' ? Number(((totalAmount * depositPct) / 100).toFixed(2)) : undefined
        const deadlineHours = restrictions.payment?.depositDeadlineHours ?? 0
        const fullPaymentDays = restrictions.payment?.fullPaymentDaysBefore ?? 0
        const discountLine =
            pricing.discountPct > 0
                ? responseForLocale(
                      lockedLocale,
                      `Descuento cliente habitual (${pricing.discountPct}%): -${pricing.discountAmount.toFixed(0)} ${currency}.`,
                      `Returning-customer discount (${pricing.discountPct}%): -${pricing.discountAmount.toFixed(0)} ${currency}.`
                  )
                : ''
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
        const summaryLine = buildHoldSummaryLine({
            propertyName: property.name || property.propertyId,
            start: lastRangeStart,
            end: lastRangeEnd,
            guests: lastGuests,
            locale: lockedLocale
        })
        const summaryBlock = summaryLine ? `\n${summaryLine}\n\n` : '\n\n'

        return respondWith(
            {
                answer: responseForLocale(
                    lockedLocale,
                    `${lastName ? `Gracias ${lastName}, ` : ''}listo, genere la reserva a tu nombre.${summaryBlock}` +
                        `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'a confirmar'}.\n` +
                        `${discountLine ? `${discountLine}\n` : ''}` +
                        `Deposito (${depositPct}%): ${
                            typeof depositAmount === 'number' ? `${depositAmount.toFixed(0)} ${currency}` : 'a confirmar'
                        } (dentro de ${deadlineHours} horas).\n` +
                        `Pago total ${fullPaymentDays} dias antes de la llegada.${transferText}\n\n` +
                        'Cuando hagas el deposito/anticipo, adjuntame el comprobante como imagen para confirmar la reserva.',
                    `${lastName ? `Thanks ${lastName}, ` : ''}I created the reservation under your name.${summaryBlock}` +
                        `Total: ${totalAmount ? `${totalAmount.toFixed(0)} ${currency}` : 'to be confirmed'}.\n` +
                        `${discountLine ? `${discountLine}\n` : ''}` +
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
                        pricePerNight: pricing.finalPricePerNight ?? pricePerNight,
                        currency,
                        totalAmount,
                        depositPct,
                        depositAmount,
                        discountPct: pricing.discountPct,
                        discountAmount: pricing.discountAmount
                    }
                }
            },
            { intentSummary: 'reservation_hold', frictionAction: 'reset', pendingHoldConfirm: false }
        )
    }

    const lower = normalizeText(message)
    const stayLength = extractStayLengthDetails(message)
    const requestedDays = stayLength?.value
    const hasVisitKeyword = ['visita', 'ver la quinta', 'ver antes', 'conocer', 'recorrer', 'visitar'].some((keyword) =>
        lower.includes(normalizeText(keyword))
    )
    const rentIntent = ['alquilar', 'alquiler', 'reserv', 'disponibilidad', 'precio', 'tarifa'].some((keyword) => lower.includes(keyword))
    const wantsMixedIntent = hasVisitKeyword && rentIntent
    const earlyCheckinSignal =
        lower.includes('ingreso temprano') || lower.includes('check-in temprano') || lower.includes('early check-in')
    const lateCheckoutSignal =
        lower.includes('salida tarde') || lower.includes('check-out tarde') || lower.includes('late check-out')
    const lateCheckinSignal = lower.includes('llego tarde') || lower.includes('llegamos tarde') || lower.includes('late check-in')
    const earlyCheckoutSignal =
        lower.includes('salida temprano') || lower.includes('check-out temprano') || lower.includes('early check-out')
    const checkInOutSignal =
        earlyCheckinSignal ||
        lateCheckoutSignal ||
        lateCheckinSignal ||
        earlyCheckoutSignal ||
        lower.includes('check-in') ||
        lower.includes('check out') ||
        lower.includes('check-out') ||
        lower.includes('checkin') ||
        lower.includes('checkout') ||
        lower.includes('ingreso') ||
        lower.includes('salida') ||
        lower.includes('horario')
    const quincenaMentioned = lower.includes('quincena')
    const detectedVisitTime = extractVisitTime(input.message || '')
    const hasVisitTime = Boolean(detectedVisitTime)
    const explicitYearInMessage =
        /\b\d{4}-\d{2}-\d{2}\b/.test(message) || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(message)
    const dateOptions = { preferMonthFirst: lockedLocale === 'en-US' }
    const explicitDates = extractDates(input.message || '', dateOptions)
    const hasDates = explicitDates.length > 0
    const monthRange = parseMonthRange(input.message || '')
    const dayRange = parseDayRange(input.message || '')
    const relativeRange = !hasDates && !monthRange && !dayRange ? parseRelativeDateRange(input.message || '') : null
    const hasDateSignals = hasDates || Boolean(monthRange) || Boolean(dayRange) || Boolean(relativeRange)
    const hadVisitContext = Boolean(lastVisitPending || lastIntent === 'visit')
    const isShortAck = isShortAckOnly(message) || isPoliteAckOnly(message)
    const isShortNo = isShortNoOnly(message)
    const paymentProofIntent = isPaymentProofIntent(message)
    const paymentRefFromMessage = extractPaymentReference(message)
    const wantsFlexibleDates =
        lower.includes('flexible') ||
        lower.includes('cualquier') ||
        lower.includes('cualquiera') ||
        lower.includes('cuando tengan') ||
        lower.includes('cualquier fecha')
    const wantsWeekendOnly =
        lower.includes('fin de semana') ||
        lower.includes('finde') ||
        lower.includes('fines de semana') ||
        lower.includes('weekend')
    const reservationIntent = hasReservationIntent(message)
    const needsProperty = !detectedProperty && !lastPropertyId
    const needsGuests = typeof lastGuests !== 'number'
    const marketKpiIntent = isMarketKpiIntent(message)
    const outboundExecutionIntent = isOutboundExecutionIntent(message)
    const discountNegotiationIntent = isDiscountNegotiationIntent(message)
    const requestedDiscountPct = extractNegotiatedDiscountPct(message)
    const serviceRequestIntent = isServiceRequestIntent(message)
    const habitualClaimSignal =
        lower.includes('cliente habitual') ||
        lower.includes('somos habituales') ||
        lower.includes('ya alquile') ||
        lower.includes('ya alquilamos') ||
        lower.includes('returning customer') ||
        lower.includes('repeat customer')
    const policySignal =
        lower.includes('musica') ||
        lower.includes('regla') ||
        lower.includes('pago') ||
        lower.includes('deposito') ||
        lower.includes('anticipo') ||
        lower.includes('transferencia') ||
        lower.includes('cbu') ||
        lower.includes('alias') ||
        lower.includes('banco') ||
        lower.includes('descuento') ||
        lower.includes('seguro') ||
        lower.includes('lluvia')
    const pricingSignal = lower.includes('precio') || lower.includes('tarifa') || lower.includes('costo')
    const bookingSignal = reservationIntent || lower.includes('reserv')
    const availabilitySignal = hasDateSignals || lower.includes('dispon')
    currentTopic = policySignal
        ? 'policy'
        : pricingSignal
        ? 'pricing'
        : bookingSignal
        ? 'booking'
        : availabilitySignal
        ? 'availability'
        : ''
    const previousTopic = String(lastTopic || '')
    const confusionSignal =
        lower.includes('no entiendo') ||
        lower.includes('no entendi') ||
        lower.includes('no me entendiste') ||
        lower.includes('no me entendes') ||
        lower.includes('no me entiendes') ||
        lower.includes('no se entiende') ||
        lower.includes('no comprendo') ||
        lower.includes("don't understand") ||
        lower.includes('dont understand') ||
        lower.includes('what do you mean') ||
        lower.includes("i'm confused") ||
        lower.includes('im confused') ||
        lower.includes('not clear')

    if (habitualClaimSignal && !lastHabitual) {
        lastHabitual = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastHabitual: true, updatedAt: new Date() } }
            )
        }
    }

    if (discountNegotiationIntent && typeof requestedDiscountPct === 'number') {
        lastNegotiatedDiscountPct = requestedDiscountPct
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { lastNegotiatedDiscountPct: requestedDiscountPct, updatedAt: new Date() } }
            )
        }
    }

    const inferredRequestedDate =
        explicitDates[0]?.format('YYYY-MM-DD') ||
        monthRange?.start ||
        (relativeRange ? relativeRange.start.format('YYYY-MM-DD') : undefined) ||
        lastRangeStart
    const shouldAutoLeadCapture =
        Boolean(detectedName || detectedEmail || detectedPhone) &&
        Boolean(hasDateSignals || detectedProperty || lastPropertyId || reservationIntent || hasVisitKeyword || pricingSignal)
    if (shouldAutoLeadCapture) {
        const matchedLead = await findHabitualLeadByIdentity({
            name: detectedName || lastName,
            email: detectedEmail || lastEmail,
            phone: detectedPhone || lastPhone
        })
        const matchedNegotiatedPct = clampDiscountPct((matchedLead as any)?.negotiatedDiscountPct)
        if (matchedNegotiatedPct > 0 && !lastNegotiatedDiscountPct) {
            lastNegotiatedDiscountPct = matchedNegotiatedPct
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastNegotiatedDiscountPct: matchedNegotiatedPct, updatedAt: new Date() } }
                )
            }
        }
        const inferredInterest = hasVisitKeyword ? 'visita' : reservationIntent || rentIntent ? 'alquiler' : 'consulta'
        const inferredStatus = hasVisitKeyword ? 'scheduled' : 'open'
        const autoLead = await upsertLead({
            id: matchedLead?.id || (detectedEmail ? `lead-${normalizeIntentText(detectedEmail)}` : undefined),
            name: detectedName || lastName || matchedLead?.name || undefined,
            email: detectedEmail || lastEmail || (matchedLead as any)?.email || undefined,
            phone: detectedPhone || lastPhone || matchedLead?.phone || undefined,
            dateRequested: inferredRequestedDate,
            propertyId: detectedProperty?.propertyId || lastPropertyId || (matchedLead as any)?.property || undefined,
            people: typeof detectedGuests === 'number' ? detectedGuests : lastGuests || matchedLead?.people,
            interest: inferredInterest,
            status: inferredStatus,
            habitual: Boolean(matchedLead?.habitual || lastHabitual),
            negotiatedDiscountPct:
                Boolean(matchedLead?.habitual || lastHabitual) && discountNegotiationIntent
                    ? pickNegotiatedDiscountPct({ lead: matchedLead, sessionPct: lastNegotiatedDiscountPct, requestedPct: requestedDiscountPct })
                    : undefined,
            notes: [
                detectedEmail || lastEmail ? `email:${detectedEmail || lastEmail}` : '',
                sessionId ? `session:${sessionId}` : ''
            ]
                .filter(Boolean)
                .join(' | ')
        })
        if (autoLead?.habitual && !lastHabitual) {
            lastHabitual = true
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastHabitual: true, updatedAt: new Date() } }
                )
            }
        }
    }

    if (confusionSignal) {
        const nextCount = Number(confusionCount || 0) + 1
        confusionCount = nextCount
        if (sessionId) {
            const updatePayload: Record<string, any> = { confusionCount: nextCount, updatedAt: new Date() }
            if (currentTopic) updatePayload.lastTopic = currentTopic
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: updatePayload }
            )
        }
        const base = responseForLocale(
            lockedLocale,
            'Perdon, que parte queres que aclare?',
            'Sorry, what should I clarify?'
        )
        const answer = nextCount >= 2 ? appendEscalationPrompt(base, lockedLocale) : base
        return respond(answer, undefined, { frictionAction: 'increase' })
    }

    if (isRestartRequest(message)) {
        await resetQuintasSessionFlow(sessionId)
        lastMonthIndex = undefined
        lastYear = undefined
        lastRangeStart = undefined
        lastRangeEnd = undefined
        lastRangeUpdatedAt = undefined
        lastPropertyId = undefined
        lastGuests = undefined
        lastIntent = undefined
        lastHabitual = undefined
        lastNegotiatedDiscountPct = undefined
        pendingDateConfirm = false
        pendingHoldConfirm = false
        lastVisitDate = undefined
        lastVisitPropertyId = undefined
        lastVisitTime = undefined
        lastVisitPending = false
        lastReplyKind = undefined
        lastIntentSummary = undefined
        frictionCount = 0
        confusionCount = 0
        lastTopic = undefined
        return respond(
            responseForLocale(
                lockedLocale,
                'Listo, arrancamos de cero. Pasame fechas, cantidad de personas y si ya tenes una quinta en mente.',
                'Done, we can start from scratch. Share dates, guest count, and if you already have a property in mind.'
            ),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'reset' }
        )
    }

    if (isDataScopeQuestion(message) && !hasDateSignals && !detectedProperty && !detectedEmail && !detectedPhone) {
        return respond(buildMockScopeAnswer(lockedLocale), undefined, {
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset'
        })
    }

    if (isUnsupportedMockDataQuestion(message) && !hasDateSignals && !detectedProperty && !detectedEmail && !detectedPhone) {
        return respond(buildUnsupportedMockDataAnswer(lockedLocale), undefined, {
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset'
        })
    }

    if (outboundExecutionIntent && !hasDateSignals && !detectedProperty && !reservationIntent && !hasVisitKeyword) {
        return respond(await runMockOutboundFromChat(lockedLocale), undefined, {
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset'
        })
    }

    if (marketKpiIntent && !hasDateSignals && !detectedProperty && !reservationIntent && !hasVisitKeyword) {
        return respond(await buildMarketKpiAnswer(lockedLocale, message), undefined, {
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset'
        })
    }

    if (discountNegotiationIntent && !reservationIntent && !hasVisitKeyword && !hasDateSignals) {
        const matchedLead = await findHabitualLeadByIdentity({
            name: detectedName || lastName,
            email: detectedEmail || lastEmail,
            phone: detectedPhone || lastPhone
        })
        const effectiveHabitual = Boolean(matchedLead?.habitual || lastHabitual)
        if (!effectiveHabitual) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Los descuentos son para clientes habituales. Si ya alquilaste antes, avisame y lo reviso.',
                    'Discounts are for returning customers. If you have rented with us before, tell me and I will check.'
                ),
                undefined,
                { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
            )
        }
        if (typeof requestedDiscountPct === 'number') {
            lastNegotiatedDiscountPct = requestedDiscountPct
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastNegotiatedDiscountPct: requestedDiscountPct, updatedAt: new Date() } }
                )
            }
            await upsertLead({
                id: matchedLead?.id || (lastEmail ? `lead-${normalizeIntentText(lastEmail)}` : undefined),
                name: detectedName || lastName || matchedLead?.name || undefined,
                email: detectedEmail || lastEmail || (matchedLead as any)?.email || undefined,
                phone: detectedPhone || lastPhone || matchedLead?.phone || undefined,
                habitual: true,
                negotiatedDiscountPct: requestedDiscountPct,
                interest: matchedLead?.interest || 'alquiler',
                status: matchedLead?.status || 'open',
                notes: `descuento negociado ${requestedDiscountPct}%`
            })
            return respond(
                responseForLocale(
                    lockedLocale,
                    `Perfecto, dejo registrado un descuento del ${requestedDiscountPct}% para tu perfil habitual.`,
                    `Perfect, I recorded a ${requestedDiscountPct}% discount for your returning-customer profile.`
                ),
                undefined,
                { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
            )
        }
        const configuredPct = Math.max(Number(restrictions.discounts?.habitualPct || 0), 0)
        return respond(
            responseForLocale(
                lockedLocale,
                `Podemos aplicar descuento por cliente habitual. Hoy tengo ${configuredPct}% cargado; si queres otro porcentaje, decime cual.`,
                `We can apply a returning-customer discount. Right now I have ${configuredPct}% configured; if you want another percentage, tell me which one.`
            ),
            undefined,
            { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
        )
    }

    if (isSmallTalkOnly(message) && !hasDateSignals && !detectedProperty && !detectedEmail && !detectedPhone) {
        const stayLabel = lastRangeStart && lastRangeEnd ? formatStaySpan(String(lastRangeStart), String(lastRangeEnd), lockedLocale) : ''
        const answer = stayLabel
            ? responseForLocale(
                  lockedLocale,
                  `Todo bien por aca. Si queres, seguimos con ${stayLabel}.`,
                  `All good on my side. If you want, we can continue with ${stayLabel}.`
              )
            : responseForLocale(
                  lockedLocale,
                  'Todo bien, gracias. Si queres, arrancamos con fechas y cantidad de personas.',
                  "I'm doing great, thanks. If you want, we can start with dates and guest count."
              )
        return respond(answer, undefined, {
            intentSummary: stayLabel ? 'awaiting_intent' : 'awaiting_dates',
            frictionAction: 'reset'
        })
    }

    if (checkInOutSignal && !hasDateSignals && !reservationIntent && !hasVisitKeyword && !rentIntent) {
        const checkInTime = restrictions.checkInOut?.checkInTime
        const checkOutTime = restrictions.checkInOut?.checkOutTime
        const base = checkInTime || checkOutTime
            ? responseForLocale(
                  lockedLocale,
                  `Ingreso ${checkInTime || 'a coordinar'} y salida ${checkOutTime || 'a coordinar'}.`,
                  `Check-in ${checkInTime || 'by arrangement'} and check-out ${checkOutTime || 'by arrangement'}.`
              )
            : responseForLocale(
                  lockedLocale,
                  'El horario depende de la quinta. Decime cual te interesa y te confirmo.',
                  'Check-in/out times depend on the property. Tell me which one and I will confirm.'
              )
        const notes = restrictions.checkInOut?.notes || ''
        const flexibilityLine =
            earlyCheckinSignal || lateCheckoutSignal
                ? responseForLocale(
                      lockedLocale,
                      'Ingreso temprano o salida tarde: sujeto a disponibilidad.',
                      'Early check-in or late check-out: subject to availability.'
                  )
                : ''
        const lateArrivalQuestion = lateCheckinSignal
            ? responseForLocale(
                  lockedLocale,
                  'Si vas a llegar tarde, decime el horario aproximado.',
                  'If you will arrive late, share the approximate time.'
              )
            : ''
        const earlyDepartureQuestion = earlyCheckoutSignal
            ? responseForLocale(
                  lockedLocale,
                  'Si necesitas salida temprano, decime el horario aproximado.',
                  'If you need an early check-out, share the approximate time.'
              )
            : ''
        const answer = [base, notes, flexibilityLine, lateArrivalQuestion, earlyDepartureQuestion].filter(Boolean).join(' ')
        return respond(answer, undefined, { frictionAction: 'reset' })
    }

    if (serviceRequestIntent && !reservationIntent && !paymentProofIntent && !hasVisitKeyword) {
        const propertyForRequest =
            detectedProperty || (lastPropertyId ? catalogProperties.find((item) => item.propertyId === lastPropertyId) : undefined)
        const requestType = detectServiceRequestType(message)
        const requestDate = explicitDates[0]?.format('YYYY-MM-DD') || lastRangeStart
        const request = await registerServiceRequest({
            sessionId,
            propertyId: propertyForRequest?.propertyId || lastPropertyId,
            propertyName: propertyForRequest?.name || propertyForRequest?.propertyId || lastPropertyId,
            requestedDate: requestDate,
            requestType,
            message,
            guestName: detectedName || lastName || undefined,
            phone: detectedPhone || lastPhone || undefined,
            email: detectedEmail || lastEmail || undefined
        })
        await upsertLead({
            id: detectedPhone ? undefined : detectedEmail ? `lead-${normalizeIntentText(detectedEmail)}` : undefined,
            name: detectedName || lastName || undefined,
            email: detectedEmail || lastEmail || undefined,
            phone: detectedPhone || lastPhone || undefined,
            propertyId: propertyForRequest?.propertyId || lastPropertyId,
            dateRequested: requestDate,
            interest: 'pedido',
            status: 'open',
            habitual: Boolean(lastHabitual),
            notes: `pedido:${requestType} #${request.requestId}`
        })
        return respond(
            responseForLocale(
                lockedLocale,
                `Listo, registre tu pedido (${request.requestId})${
                    propertyForRequest?.name ? ` para ${propertyForRequest.name}` : ''
                }. Te aviso por aca apenas haya novedad.`,
                `Done, I logged your request (${request.requestId})${
                    propertyForRequest?.name ? ` for ${propertyForRequest.name}` : ''
                }. I will update you here as soon as there is progress.`
            ),
            {
                type: 'serviceRequest',
                request: {
                    id: request.requestId,
                    requestType,
                    propertyId: propertyForRequest?.propertyId || lastPropertyId,
                    date: request.date
                }
            },
            { intentSummary: 'request_logged', frictionAction: 'reset' }
        )
    }

    const ambiguousShortDate = !explicitYearInMessage && !detectMonthInMessage(message) ? findAmbiguousShortDate(message) : null
    if (ambiguousShortDate) {
        return respond(buildAmbiguousDateQuestion(ambiguousShortDate, lockedLocale), undefined, {
            intentSummary: 'awaiting_dates',
            frictionAction: 'increase'
        })
    }

    if (quincenaMentioned && !detectMonthInMessage(message) && !hasDateSignals) {
        return respond(
            responseForLocale(lockedLocale, 'De que mes es la quincena?', 'Which month is that for?'),
            undefined,
            { intentSummary: 'awaiting_month', frictionAction: 'increase' }
        )
    }

    if (explicitYearInMessage && explicitDates.length) {
        const today = moment().startOf('day')
        const hasPastDates = explicitDates.some((date) => date.isBefore(today, 'day'))
        if (hasPastDates) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Esas fechas quedaron en el pasado. Me pasas nuevas fechas?',
                    'Those dates are in the past. Can you share new dates?'
                ),
                undefined,
                { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
            )
        }
    }

    if (explicitDates.length === 1 && stayLength) {
        const lengthValue = Math.max(stayLength.value, 1)
        const start = explicitDates[0].clone().startOf('day')
        const end = start.clone().add(lengthValue - 1, 'day')
        const startStr = start.format('YYYY-MM-DD')
        const endStr = end.format('YYYY-MM-DD')
        const stayLabel = formatStaySpan(startStr, endStr, lockedLocale)
        const unitLabel =
            stayLength.unit === 'nights'
                ? lockedLocale === 'en-US'
                    ? 'nights'
                    : 'noches'
                : lockedLocale === 'en-US'
                ? 'days'
                : 'dias'
        const answer = responseForLocale(
            lockedLocale,
            `Para confirmar ${lengthValue} ${unitLabel}, te referis a ${stayLabel}?`,
            `Just to confirm ${lengthValue} ${unitLabel}, do you mean ${stayLabel}?`
        )
        lastRangeStart = startStr
        lastRangeEnd = endStr
        pendingDateConfirm = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                {
                    $set: {
                        lastRangeStart: startStr,
                        lastRangeEnd: endStr,
                        lastRangeUpdatedAt: new Date(),
                        pendingDateConfirm: true,
                        updatedAt: new Date()
                    }
                }
            )
        }
        return respond(answer, undefined, { intentSummary: 'confirm_dates', frictionAction: 'increase', pendingDateConfirm: true })
    }

    const isNameOnlyMessage =
        detectedName &&
        !detectedEmail &&
        !detectedPhone &&
        !hasDateSignals &&
        !detectedProperty &&
        !rentIntent &&
        !hasVisitKeyword &&
        !lower.includes('precio') &&
        !lower.includes('tarifa') &&
        !lower.includes('costo')
    if (isNameOnlyMessage) {
        const formatted = formatGuestName(detectedName)
        return respond(
            responseForLocale(
                lockedLocale,
                `Gracias ${formatted}. Si queres retomar una charla anterior, pasame tu email o telefono. Si no, contame fechas y cantidad de personas.`,
                `Thanks ${formatted}. If you want me to pick up a previous chat, share your email or phone. Otherwise, share your dates and guest count.`
            ),
            undefined,
            { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
        )
    }

    if (pendingDateConfirm && hasDates) {
        pendingDateConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingDateConfirm: false, updatedAt: new Date() } }
            )
        }
    }

    if (pendingHoldConfirm && (hasDates || detectedProperty || typeof detectedGuests === 'number')) {
        pendingHoldConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingHoldConfirm: false, updatedAt: new Date() } }
            )
        }
    }

    if (pendingHoldConfirm && isShortNo) {
        pendingHoldConfirm = false
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingHoldConfirm: false, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(lockedLocale, 'Dale, que queres cambiar?', 'Ok, what do you want to change?'),
            undefined,
            { intentSummary: 'awaiting_details' }
        )
    }

    if (pendingHoldConfirm && isShortAck) {
        return finalizeHoldReservation()
    }

    if (paymentProofIntent && !pendingDateConfirm && !pendingHoldConfirm) {
        const startFromMessage = explicitDates[0]?.format('YYYY-MM-DD')
        const endFromMessage =
            explicitDates[1]?.format('YYYY-MM-DD') ||
            (explicitDates[0] && requestedDays ? explicitDates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : undefined)
        const paymentPropertyId = detectedProperty?.propertyId || lastPropertyId
        const paymentStart = startFromMessage || lastRangeStart
        const paymentEnd = endFromMessage || lastRangeEnd

        if (!paymentPropertyId || !paymentStart || !paymentEnd) {
            return respond(
                responseForLocale(
                    lockedLocale,
                    'Gracias. Para confirmar el pago necesito ubicar la reserva: pasame la quinta y las fechas (YYYY-MM-DD a YYYY-MM-DD).',
                    'Thanks. To confirm the payment I need to find your reservation: share property and dates (YYYY-MM-DD to YYYY-MM-DD).'
                ),
                undefined,
                { intentSummary: 'awaiting_details', frictionAction: 'increase' }
            )
        }

        ensureToolAccess('write', [collectionNames.quintasCalendar])
        const paymentResult = await confirmPayment({
            propertyId: paymentPropertyId,
            start: paymentStart,
            end: paymentEnd,
            paymentRef: paymentRefFromMessage || undefined
        })

        if (!paymentResult.ok) {
            const suggestion = await buildNearbyAvailabilityMessage({
                start: paymentStart,
                days: requestedDays,
                propertyId: paymentPropertyId,
                locale: lockedLocale
            })
            const base = responseForLocale(
                lockedLocale,
                'No pude confirmar el pago porque la seña/reserva en hold vencio o no aparece activa.',
                'I could not confirm the payment because the hold expired or is no longer active.'
            )
            return respond(
                suggestion
                    ? `${base} ${suggestion}`
                    : `${base} ${responseForLocale(
                          lockedLocale,
                          'Si queres, te ofrezco nuevas fechas ahora.',
                          'If you want, I can offer new dates now.'
                      )}`,
                undefined,
                { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
            )
        }

        const property = catalogProperties.find((item) => item.propertyId === paymentPropertyId)
        const summaryLine = buildHoldSummaryLine({
            propertyName: property?.name || paymentPropertyId,
            start: paymentStart,
            end: paymentEnd,
            guests: lastGuests,
            locale: lockedLocale
        })
        const paymentRefLine = paymentRefFromMessage
            ? responseForLocale(
                  lockedLocale,
                  `Referencia registrada: ${paymentRefFromMessage}.`,
                  `Reference recorded: ${paymentRefFromMessage}.`
              )
            : ''

        lastPropertyId = paymentPropertyId
        lastRangeStart = paymentStart
        lastRangeEnd = paymentEnd
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                {
                    $set: {
                        lastPropertyId: paymentPropertyId,
                        lastRangeStart: paymentStart,
                        lastRangeEnd: paymentEnd,
                        lastRangeUpdatedAt: new Date(),
                        pendingHoldConfirm: false,
                        updatedAt: new Date()
                    }
                }
            )
        }

        const alreadyBooked = Boolean((paymentResult as { alreadyBooked?: boolean }).alreadyBooked)
        const answer = alreadyBooked
            ? responseForLocale(
                  lockedLocale,
                  'Gracias. Esa reserva ya estaba confirmada.',
                  'Thanks. That reservation was already confirmed.'
              )
            : responseForLocale(
                  lockedLocale,
                  'Perfecto, comprobante recibido y pago confirmado. La reserva quedo cerrada.',
                  'Perfect, proof received and payment confirmed. The reservation is now closed.'
              )

        return respond(
            [answer, summaryLine, paymentRefLine]
                .filter(Boolean)
                .join('\n\n')
                .trim(),
            {
                type: 'paymentConfirmed',
                payment: {
                    propertyId: paymentPropertyId,
                    start: paymentStart,
                    end: paymentEnd,
                    paymentRef: paymentRefFromMessage || undefined,
                    alreadyBooked
                }
            },
            { intentSummary: 'reservation_confirmed', frictionAction: 'reset', pendingHoldConfirm: false }
        )
    }

    if (
        bookingSignal &&
        !hasDateSignals &&
        !pendingDateConfirm &&
        !pendingHoldConfirm &&
        lastRangeStart &&
        lastRangeEnd &&
        (previousTopic === 'policy' || previousTopic === 'pricing')
    ) {
        const start = moment(lastRangeStart, 'YYYY-MM-DD', true)
        const end = moment(lastRangeEnd, 'YYYY-MM-DD', true)
        if (start.isValid() && end.isValid()) {
            const stayLabel = formatStaySpan(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), lockedLocale)
            const answer = responseForLocale(
                lockedLocale,
                `Antes de reservar, seguimos con ${stayLabel}?`,
                `Before booking, should I keep ${stayLabel}?`
            )
            pendingDateConfirm = true
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { pendingDateConfirm: true, updatedAt: new Date() } }
                )
            }
            return respond(answer, undefined, { intentSummary: 'confirm_dates', frictionAction: 'increase', pendingDateConfirm: true })
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
        if (intentSummary === 'awaiting_intent') {
            return responseForLocale(
                lockedLocale,
                'Queres coordinar una visita o avanzar con la reserva?',
                'Do you want to schedule a visit or move forward with the reservation?'
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
                { $set: { pendingDateConfirm: false, lastRangeUpdatedAt: new Date(), updatedAt: new Date() } }
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
                {
                    $set: {
                        lastRangeStart: start,
                        lastRangeEnd: end,
                        lastRangeUpdatedAt: new Date(),
                        pendingDateConfirm: true,
                        updatedAt: new Date()
                    }
                }
            )
        }
        const stayLabel = formatStaySpan(start, end, lockedLocale)
        const answer = responseForLocale(lockedLocale, `Te referis a ${stayLabel}?`, `Did you mean ${stayLabel}?`)
        return respond(answer, undefined, { intentSummary: 'confirm_dates', frictionAction: 'increase', pendingDateConfirm: true })
    }

    if (reservationIntent && hasDateSignals && (needsProperty || needsGuests) && !hasVisitKeyword) {
        const question = buildMissingDetailsQuestion({ locale: lockedLocale, needsProperty, needsGuests })
        if (question) {
            return respond(question, undefined, { intentSummary: 'awaiting_details', frictionAction: 'increase' })
        }
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
    if (!hasDates && (detectedEmail || detectedPhone) && (!lastRangeStart || !lastRangeEnd)) {
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
            if (!lastRangeUpdatedAt && restoredSession.lastRangeUpdatedAt) {
                lastRangeUpdatedAt = restoredSession.lastRangeUpdatedAt
                restorePayload.lastRangeUpdatedAt = lastRangeUpdatedAt
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
            if (!lastEmail && restoredSession.lastEmail) {
                lastEmail = restoredSession.lastEmail
                restorePayload.lastEmail = lastEmail
            }
            if (!lastPhone && restoredSession.lastPhone) {
                lastPhone = restoredSession.lastPhone
                restorePayload.lastPhone = lastPhone
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

    const hasVisitDetails = Boolean(detectedVisitTime || lastVisitTime || lastVisitPropertyId || lastVisitDate)
    const hasStoredRange = Boolean(lastRangeStart && lastRangeEnd)
    if (!pendingDateConfirm && !pendingHoldConfirm && wantsMixedIntent && !hasDateSignals && !hasStoredRange && !hasVisitDetails) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Queres coordinar una visita o avanzar con la reserva? Decime una opcion y sigo.',
                'Do you want to schedule a visit or move forward with the reservation? Tell me which one and I will continue.'
            ),
            undefined,
            { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
        )
    }

    const staleDateContext = isDateContextStale({
        start: lastRangeStart,
        end: lastRangeEnd,
        lastRangeUpdatedAt
    })
    if (staleDateContext && hasStoredRange && !hasDateSignals && !pendingDateConfirm && !pendingHoldConfirm) {
        const stayLabel = formatStaySpan(String(lastRangeStart), String(lastRangeEnd), lockedLocale)
        pendingDateConfirm = true
        if (sessionId) {
            await db.collection(collections.manualAgentSessions).updateOne(
                { sessionId, agentId: 'quintas' },
                { $set: { pendingDateConfirm: true, updatedAt: new Date() } }
            )
        }
        return respond(
            responseForLocale(
                lockedLocale,
                `Tengo fechas guardadas (${stayLabel}). Te sirven o las cambiamos?`,
                `I have dates saved (${stayLabel}). Want to keep them or change them?`
            ),
            undefined,
            { intentSummary: 'confirm_dates', frictionAction: 'increase', pendingDateConfirm: true }
        )
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

    if (isThanksOnly(input.message || '') && !pendingDateConfirm && !pendingHoldConfirm) {
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

    if (isGoodbyeOnly(input.message || '') && !pendingDateConfirm && !pendingHoldConfirm) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Perfecto, lo dejamos aca. Cuando quieras seguir, pasame fechas y lo retomamos.',
                'Perfect, we can pause here. When you want to continue, share dates and I will pick it up.'
            ),
            undefined,
            { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
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

    if (isHumanHandoffRequest(message) && !hasDateSignals && !detectedProperty && !detectedEmail) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Claro, te puedo pasar con un humano. Si queres, pasame fechas y la quinta y dejo todo listo.',
                'Sure, I can hand this over to a human. If you want, share dates and the property and I will leave everything ready.'
            ),
            undefined,
            { intentSummary: 'awaiting_details', frictionAction: 'reset' }
        )
    }

    if (isHelpOnly(message) && !hasDateSignals && !detectedProperty && !detectedEmail) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Te ayudo con disponibilidad, precios, reservas, pagos y visitas. Pasame fechas y cantidad de personas y te propongo opciones. Esta demo usa datos mock.',
                'I can help with availability, prices, bookings, payments, and visits. Share your dates and guest count and I will propose options. This demo uses mock data.'
            ),
            undefined,
            { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
        )
    }

    if (isClearlyOffTopic(message) && !hasDateSignals && !detectedProperty && !detectedEmail && !detectedPhone) {
        return respond(
            responseForLocale(
                lockedLocale,
                'Solo puedo ayudar con quintas (disponibilidad, precios, reservas, pagos o visitas). Pasame fechas y cantidad de personas y seguimos.',
                'I can only help with quintas (availability, prices, reservations, payments, or visits). Share dates and guest count and we can continue.'
            ),
            undefined,
            { intentSummary: 'awaiting_intent', frictionAction: 'reset' }
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
                {
                    $set: {
                        lastRangeStart: monthRange.start,
                        lastRangeEnd: monthRange.end,
                        lastRangeUpdatedAt: new Date(),
                        updatedAt: new Date()
                    }
                }
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
        let endMonthIndex = lastMonthIndex
        let endYear = lastYear
        if (dayRange.endDay < dayRange.startDay) {
            endMonthIndex = (lastMonthIndex + 1) % 12
            endYear = lastMonthIndex === 11 ? lastYear + 1 : lastYear
        }
        const start = moment.tz({ year: lastYear, month: lastMonthIndex, day: dayRange.startDay }, timezone).format('YYYY-MM-DD')
        const end = moment.tz({ year: endYear, month: endMonthIndex, day: dayRange.endDay }, timezone).format('YYYY-MM-DD')
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
                { $set: { lastRangeStart: start, lastRangeEnd: end, lastRangeUpdatedAt: new Date(), updatedAt: new Date() } }
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
            let endMonthIndex = lastMonthIndex
            let endYear = lastYear
            if (dayRange.endDay < dayRange.startDay) {
                endMonthIndex = (lastMonthIndex + 1) % 12
                endYear = lastMonthIndex === 11 ? lastYear + 1 : lastYear
            }
            const start = moment.tz({ year: lastYear, month: lastMonthIndex, day: dayRange.startDay }, timezone)
            const end = moment.tz({ year: endYear, month: endMonthIndex, day: dayRange.endDay }, timezone)
            if (start.isValid() && end.isValid()) {
                const startStr = start.format('YYYY-MM-DD')
                const endStr = end.format('YYYY-MM-DD')
                lastRangeStart = startStr
                lastRangeEnd = endStr
                if (sessionId) {
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: { lastRangeStart, lastRangeEnd, lastRangeUpdatedAt: new Date(), updatedAt: new Date() } }
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
        if (wantsFlexibleDates || wantsWeekendOnly) {
            const suggestion = await buildFlexibleAvailabilityMessage({
                monthIndex,
                year,
                days: requestedDays,
                weekendOnly: wantsWeekendOnly,
                locale: lockedLocale,
                propertyId: detectedProperty?.propertyId || lastPropertyId
            })
            if (suggestion) {
                return respond(suggestion, undefined, { intentSummary: 'availability_options', frictionAction: 'reset' })
            }
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

    const hasReservationActionIntent = ['reserv', 'deposito', 'anticipo'].some((keyword) => lower.includes(keyword))
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
    if (wantsPropertyInfo && !hasReservationActionIntent && !visitOnly && !hasVisitKeyword) {
        const property = detectedProperty || (lastPropertyId ? catalogProperties.find((item) => item.propertyId === lastPropertyId) : undefined)
        const startFromMessage = explicitDates[0]?.format('YYYY-MM-DD')
        const endFromMessage =
            explicitDates[1]?.format('YYYY-MM-DD') ||
            (explicitDates[0] && requestedDays
                ? explicitDates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD')
                : startFromMessage)
        const start = startFromMessage || lastRangeStart
        const end = endFromMessage || lastRangeEnd || start

            if (sessionId && startFromMessage && endFromMessage) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    {
                        $set: {
                            lastRangeStart: startFromMessage,
                            lastRangeEnd: endFromMessage,
                            lastRangeUpdatedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
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
            if (hasLeadInfo(input.message || '') && visitProperty?.propertyId) {
                const visitName = extractName(input.message || '') || lastName || ''
                const visitEmail = extractEmail(input.message || '') || lastEmail || ''
                const visitPhone = extractPhone(input.message || '') || lastPhone || ''
                await recordVisitEvent({
                    propertyId: visitProperty.propertyId,
                    visitDate: start,
                    visitTime,
                    guestName: visitName,
                    phone: visitPhone,
                    email: visitEmail
                })
                await upsertLead({
                    id: visitPhone ? undefined : visitEmail ? `lead-${normalizeIntentText(visitEmail)}` : undefined,
                    name: visitName || undefined,
                    email: visitEmail || undefined,
                    phone: visitPhone || undefined,
                    propertyId: visitProperty.propertyId,
                    dateRequested: start,
                    people: lastGuests,
                    interest: 'visita',
                    status: 'scheduled',
                    habitual: Boolean(lastHabitual),
                    notes: `visita ${start} ${visitTime}`
                })
                if (sessionId) {
                    await db.collection(collections.manualAgentSessions).updateOne(
                        { sessionId, agentId: 'quintas' },
                        { $set: { lastVisitPending: false, updatedAt: new Date() } }
                    )
                }
                return respond(
                    responseForLocale(
                        lockedLocale,
                        `${visitName ? `Gracias ${visitName}. ` : 'Gracias. '}Queda coordinada la visita para el ${start} a las ${visitTime} en ${visitPropertyName}.`,
                        `${visitName ? `Thanks ${visitName}. ` : 'Thanks. '}Your visit is confirmed for ${start} at ${visitTime} in ${visitPropertyName}.`
                    ),
                    undefined,
                    { intentSummary: 'visit_confirmed', frictionAction: 'reset' }
                )
            }
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
    if (explicitDates.length && !hasReservationActionIntent) {
        const start = explicitDates[0].format('YYYY-MM-DD')
        const end =
            explicitDates[1]?.format('YYYY-MM-DD') ||
            (requestedDays ? explicitDates[0].clone().add(requestedDays - 1, 'day').format('YYYY-MM-DD') : start)
        const property = detectProperty(input.message || '', catalogProperties)
            if (sessionId) {
                await db.collection(collections.manualAgentSessions).updateOne(
                    { sessionId, agentId: 'quintas' },
                    { $set: { lastRangeStart: start, lastRangeEnd: end, lastRangeUpdatedAt: new Date(), updatedAt: new Date() } }
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
        const email = extractEmail(input.message || '') || lastEmail || ''
        const phone = extractPhone(input.message || '') || lastPhone || ''
        await recordVisitEvent({
            propertyId: lastVisitPropertyId,
            visitDate: lastVisitDate,
            visitTime: lastVisitTime,
            guestName: name || lastName || '',
            phone,
            email
        })
        await upsertLead({
            id: phone ? undefined : email ? `lead-${normalizeIntentText(email)}` : undefined,
            name: name || lastName || undefined,
            email: email || undefined,
            phone: phone || undefined,
            propertyId: lastVisitPropertyId,
            dateRequested: lastVisitDate,
            people: lastGuests,
            interest: 'visita',
            status: 'scheduled',
            habitual: Boolean(lastHabitual),
            notes: `visita ${lastVisitDate} ${lastVisitTime}`
        })
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
            if (!pendingHoldConfirm) {
                const recap = buildHoldRecap({
                    start: lastRangeStart,
                    end: lastRangeEnd,
                    propertyName: property.name || property.propertyId,
                    guests: lastGuests,
                    locale: lockedLocale
                })
                return respond(recap, undefined, { intentSummary: 'awaiting_confirm', frictionAction: 'increase', pendingHoldConfirm: true })
            }
            return finalizeHoldReservation()
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

export const __test__ = {
    parseShortDate,
    findAmbiguousShortDate,
    extractDates,
    extractStayLengthDetails,
    resolveMinNightsForRange,
    calculateDiscountBreakdown,
    buildMinNightsReply,
    buildHoldFailureAnswer,
    formatAvailabilitySections,
    buildHoldSummaryLine,
    formatStaySpan,
    isDateContextStale,
    isShortAckOnly,
    isPoliteAckOnly,
    isShortNoOnly,
    isGreetingOnly,
    isThanksOnly,
    isDeclineOnly,
    isHelpOnly,
    isGoodbyeOnly,
    isRestartRequest,
    isHumanHandoffRequest,
    isClearlyOffTopic,
    isSmallTalkOnly,
    isDataScopeQuestion,
    isUnsupportedMockDataQuestion,
    isMarketKpiIntent,
    isOutboundExecutionIntent,
    isDiscountNegotiationIntent,
    extractNegotiatedDiscountPct,
    isServiceRequestIntent,
    detectServiceRequestType,
    isPaymentProofIntent,
    extractPaymentReference
}

import moment from 'moment-timezone'
import OpenAI from 'openai'
import { nanoid } from 'nanoid'
import { ManualAgentRequest, ManualAgentResponse, ManualAgentToolDefinition } from './types'
import { ensureHotelSeed } from './hotelData'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'
import { getManualAgentModel, getManualAgentOpenAIKey } from './config'

const HOTEL_AGENT_ID = 'gran-sol'

type HotelRoom = {
    tipo?: string
    capacidad?: number
    tarifaBase?: number
    moneda?: string
    amenities?: string[]
    refundable?: boolean
    petFriendly?: boolean
    incluyeDesayuno?: boolean
    notas?: string
    id?: string
}

type HotelInventoryDoc = {
    agentId?: string
    hotelId?: string
    nombre?: string
    sede?: string
    ubicacion?: string
    availabilitySede?: string
    habitaciones?: HotelRoom[]
}

type HotelAvailabilityDoc = {
    agentId?: string
    sede?: string
    fecha?: string
    tipo?: string
    cupo?: number
    overbooking?: boolean
}

type MinNightsRule = {
    rango?: [string, string]
    motivo?: string
    minNoches?: number
}

type PolicyRule = {
    tarifa?: string
    diasLimite?: number
    penalidadPorc?: number
    nota?: string
}

type HotelRulesDoc = {
    agentId?: string
    rulesVersion?: string
    minimasNoches?: MinNightsRule[]
    cancelacion?: PolicyRule[]
    cambios?: PolicyRule[]
    earlyLate?: {
        earlyCheckin?: { desde?: string; fee?: number; moneda?: string; nota?: string }
        lateCheckout?: { hasta?: string; fee?: number; moneda?: string; nota?: string }
    }
    bloqueos?: Array<{ sede?: string; fecha?: string; motivo?: string; nota?: string }>
    horarios?: { checkin?: string; checkout?: string }
    notasTarifas?: Array<{ tarifaTipo?: string; politica?: string }>
}

type HotelFaqItem = {
    intent?: string
    pregunta?: string
    respuesta?: string
    id?: string
}

type HotelFaqDoc = {
    agentId?: string
    type?: string
    faq?: HotelFaqItem[]
}

type HotelReservationDoc = {
    agentId?: string
    id?: string
    sede?: string
    checkIn?: string
    checkOut?: string
    noches?: number
    habitacionTipo?: string
    tarifaTipo?: string
    huespedes?: number
    precioTotal?: number
    moneda?: string
    email?: string
    nombre?: string
    metodoPago?: string
    preferencias?: string
    status?: string
    notas?: string
    earlyCheckin?: boolean
    lateCheckout?: boolean
    createdAt?: Date
    updatedAt?: Date
    cancelacion?: {
        motivo?: string
        penalidadPorc?: number
        penalidadMonto?: number
        fecha?: Date
    }
    credit?: {
        amount?: number
        currency?: string
        issuedAt?: Date
        expiresAt?: Date
        status?: string
        note?: string
    }
    cambios?: Array<Record<string, unknown>>
    serviceRequests?: Array<Record<string, unknown>>
    pagos?: Array<Record<string, unknown>>
}

type HotelInfoDoc = {
    agentId?: string
    hotelId?: string
    nombre?: string
    sede?: string
    ubicacion?: string
    mapaUrl?: string
    serviciosIncluidos?: string[]
    reglasConvivencia?: string[]
    horarios?: Record<string, string>
    contacto?: Record<string, string>
    transporte?: Record<string, string>
    descripcion?: string
    type?: string
}

type HotelServiceDoc = {
    agentId?: string
    serviceId?: string
    nombre?: string
    categoria?: string
    sedes?: string[]
    precio?: number
    moneda?: string
    descripcion?: string
    requiereReserva?: boolean
    horarios?: string
    kind?: string
}

type HotelGuestProfileDoc = {
    agentId?: string
    guestId?: string
    nombre?: string
    email?: string
    idioma?: string
    preferencias?: string[]
    historial?: Array<Record<string, unknown>>
    consumos?: Array<Record<string, unknown>>
}

type HotelSupportDoc = {
    agentId?: string
    type?: string
    protocolos?: Array<Record<string, unknown>>
    manuales?: Array<Record<string, unknown>>
}

type HotelPromoDoc = {
    agentId?: string
    promoId?: string
    nombre?: string
    rango?: [string, string]
    start?: string
    end?: string
    sedes?: string[]
    tiposHabitacion?: string[]
    descuentoPct?: number
    ajustePct?: number
    aplicaTarifa?: string
    nota?: string
}

type HotelLeadDoc = {
    id?: string
    nombre?: string
    email?: string
    telefono?: string
    interes?: string
    origen?: string
    estado?: string
    notas?: string
}

type HotelNotificationDoc = {
    agentId?: string
    type?: string
    status?: string
    payload?: Record<string, unknown>
    createdAt?: Date
}

const collectionNames = getManualAgentsCollections()

export const HOTEL_ALLOWED_COLLECTIONS = [
    collectionNames.manualAgentSessions,
    collectionNames.manualAgentShareTokens,
    collectionNames.manualAgentMetrics,
    collectionNames.manualAgentChatLogs,
    collectionNames.hotelInventory,
    collectionNames.hotelAvailability,
    collectionNames.hotelRules,
    collectionNames.hotelFaq,
    collectionNames.hotelReservations,
    collectionNames.hotelInfo,
    collectionNames.hotelServices,
    collectionNames.hotelGuestProfiles,
    collectionNames.hotelSupport,
    collectionNames.hotelPromos,
    collectionNames.hotelLeads,
    collectionNames.hotelNotifications
]

export const HOTEL_ALLOWED_OPS: Array<'read' | 'write'> = ['read', 'write']

const HOTEL_FRICTION_THRESHOLD = 2
const HOTEL_DATE_CONTEXT_TTL_DAYS = 14

type HotelActivityAgendaItem = {
    time: string
    es: string
    en: string
}

const HOTEL_ACTIVITY_AGENDA: Record<string, { weekday: HotelActivityAgendaItem[]; weekend: HotelActivityAgendaItem[] }> = {
    centro: {
        weekday: [
            { time: '10:00', es: 'Walking tour por casco historico', en: 'Historic center walking tour' },
            { time: '16:00', es: 'Circuito de museos recomendados', en: 'Curated museum circuit' }
        ],
        weekend: [
            { time: '11:00', es: 'City tour guiado', en: 'Guided city tour' },
            { time: '19:30', es: 'Recorrido gastronomico en zona centro', en: 'Downtown food walk' }
        ]
    },
    palermo: {
        weekday: [
            { time: '09:30', es: 'Recorrido en bici por parques', en: 'Park bike route' },
            { time: '20:00', es: 'Ruta gastronomica por Palermo', en: 'Palermo food route' }
        ],
        weekend: [
            { time: '10:30', es: 'Feria y parques de Palermo', en: 'Palermo fairs and parks' },
            { time: '21:00', es: 'Tour nocturno de bares y restaurantes', en: 'Night bars and restaurants tour' }
        ]
    },
    aeropuerto: {
        weekday: [
            { time: '11:00', es: 'Shuttle a shopping cercano', en: 'Shuttle to nearby shopping mall' },
            { time: '17:00', es: 'Salida express al centro', en: 'Express transfer to downtown' }
        ],
        weekend: [
            { time: '12:00', es: 'Circuito shopping + gastronomia', en: 'Shopping and food circuit' },
            { time: '18:00', es: 'Transfer recreativo al centro', en: 'Leisure transfer to downtown' }
        ]
    }
}

const ensureToolAccess = (op: 'read' | 'write', collections: string[]) => {
    if (!HOTEL_ALLOWED_OPS.includes(op)) {
        throw new Error(`Operation not allowed: ${op}`)
    }
    const missing = collections.filter((collection) => !HOTEL_ALLOWED_COLLECTIONS.includes(collection))
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

const HOTEL_DOMAIN_KEYWORDS = [
    'hotel',
    'hoteles',
    'reserva',
    'reservar',
    'booking',
    'book',
    'habitacion',
    'room',
    'sede',
    'check in',
    'check out',
    'check-in',
    'check-out',
    'dispon',
    'availability',
    'tarifa',
    'precio',
    'cost',
    'cancel',
    'modificar',
    'voucher',
    'huesped',
    'guest',
    'servicio',
    'service',
    'pago',
    'payment',
    'deposito',
    'transfer'
]

const HOTEL_OFF_TOPIC_KEYWORDS = [
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
        'booking',
        'book',
        'fecha',
        'fechas',
        'habitacion',
        'room',
        'hotel',
        'hoteles',
        'sede',
        'precio',
        'tarifa',
        'costo',
        'cost',
        'disponibilidad',
        'availability',
        'gracias',
        'hola',
        'hello'
    ])
    if (words.some((word) => blockedWords.has(word))) return false
    return true
}

const parseDate = (value: string) => moment(value, 'YYYY-MM-DD', true)

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

const findMonthInText = (message: string) => {
    const text = normalizeText(message)
    const monthMap: Record<string, number> = {
        enero: 1,
        febrero: 2,
        marzo: 3,
        abril: 4,
        mayo: 5,
        junio: 6,
        julio: 7,
        agosto: 8,
        septiembre: 9,
        setiembre: 9,
        octubre: 10,
        noviembre: 11,
        diciembre: 12,
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12
    }
    for (const [name, month] of Object.entries(monthMap)) {
        if (text.includes(name)) {
            const today = moment()
            const year = month < today.month() + 1 ? today.year() + 1 : today.year()
            return { month, year }
        }
    }
    return null
}

const extractEmail = (message: string) => {
    const match = String(message || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return match ? match[0] : ''
}

const extractReservationId = (message: string) => {
    const match = String(message || '').match(/\bGRS-[0-9]{8}-[A-Z0-9]+\b/i)
    return match ? match[0].toUpperCase() : ''
}

const extractReminderAt = (message: string) => {
    const text = normalizeText(message || '')
    if (!text) return ''
    const timezone = 'America/Argentina/Buenos_Aires'
    const now = moment.tz(timezone).startOf('minute')
    const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
    const hour = timeMatch ? Number(timeMatch[1]) : 9
    const minute = timeMatch ? Number(timeMatch[2]) : 0
    const base = text.includes('manana') || text.includes('tomorrow') ? now.clone().add(1, 'day') : now.clone()
    const reminder = base.clone().hour(hour).minute(minute).second(0)
    if (reminder.isBefore(now)) {
        reminder.add(1, 'day')
    }
    return reminder.toISOString()
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

const extractPaymentMethod = (message: string) => {
    const normalized = normalizeText(message || '')
    if (!normalized) return ''
    if (normalized.includes('tarjeta') || normalized.includes('credito') || normalized.includes('debito')) return 'tarjeta'
    if (normalized.includes('transfer')) return 'transferencia'
    if (normalized.includes('efectivo')) return 'efectivo'
    if (normalized.includes('link')) return 'link'
    if (normalized.includes('mercadopago') || normalized.includes('mercado pago')) return 'mercadopago'
    return ''
}

const detectHotelSelection = (message: string, hotels: HotelInventoryDoc[]) => {
    const normalized = normalizeText(message || '')
    return (
        hotels.find((hotel) => {
            const hotelId = normalizeText(String(hotel.hotelId || ''))
            const nombre = normalizeText(String(hotel.nombre || ''))
            const sede = normalizeText(String(hotel.sede || ''))
            return (
                (hotelId && normalized.includes(hotelId)) ||
                (nombre && normalized.includes(nombre)) ||
                (sede && normalized.includes(sede))
            )
        }) || null
    )
}

const detectRoomSelection = (message: string, hotel?: HotelInventoryDoc | null, hotels?: HotelInventoryDoc[]) => {
    const normalized = normalizeText(message || '')
    if (normalized.includes('normal') || normalized.includes('standard')) {
        const normalizedRooms = (hotel?.habitaciones || (hotels || []).flatMap((item) => item.habitaciones || [])).map((room) => ({
            tipo: room.tipo,
            normalized: normalizeText(String(room.tipo || ''))
        }))
        const fallback = normalizedRooms.find((room) => room.normalized.includes('estandar') || room.normalized.includes('standard'))
        if (fallback?.tipo) return fallback.tipo
    }
    const rooms = hotel?.habitaciones || (hotels || []).flatMap((item) => item.habitaciones || [])
    const match = rooms.find((room) => {
        const label = normalizeText(String(room.tipo || ''))
        return label && normalized.includes(label)
    })
    return match?.tipo || ''
}

const extractDayRange = (message: string) => {
    const text = normalizeText(message)
    const match =
        text.match(/\b(?:del?|el)\s*(\d{1,2})(?:\s*de\s*[a-z]+)?\s*(al|hasta|-)\s*(\d{1,2})(?:\s*de\s*[a-z]+)?\b/) ||
        text.match(/\b(\d{1,2})(?:\s*de\s*[a-z]+)?\s*(al|hasta|-)\s*(\d{1,2})(?:\s*de\s*[a-z]+)?\b/) ||
        text.match(/\bfrom\s*(\d{1,2})(?:\s*of\s*[a-z]+)?\s*(to|-)\s*(\d{1,2})(?:\s*of\s*[a-z]+)?\b/)
    if (!match) return null
    const startDay = Number(match[1])
    const endDay = Number(match[3])
    if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return null
    return { startDay, endDay }
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

const getActivityAgendaKey = (sede?: string) => {
    const normalized = normalizeText(sede || '')
    if (normalized.includes('palermo')) return 'palermo'
    if (normalized.includes('aeropuerto')) return 'aeropuerto'
    return 'centro'
}

const resolveActivitiesDate = (message: string, language: 'es' | 'en') => {
    const explicitDates = extractDates(message, { preferMonthFirst: language === 'en' })
    if (explicitDates.length) {
        return explicitDates[0].clone().startOf('day')
    }
    const today = moment.tz('America/Argentina/Buenos_Aires').startOf('day')
    if (hasAnyIntentKeyword(message, ['manana', 'tomorrow'])) {
        return today.clone().add(1, 'day')
    }
    if (hasAnyIntentKeyword(message, ['hoy', 'today'])) {
        return today
    }
    return null
}

const buildDailyActivitiesAnswer = (params: {
    date: moment.Moment
    sede?: string
    language: 'es' | 'en'
    services?: HotelServiceDoc[]
    defaultSedeUsed?: boolean
}) => {
    const agendaKey = getActivityAgendaKey(params.sede)
    const agenda = HOTEL_ACTIVITY_AGENDA[agendaKey] || HOTEL_ACTIVITY_AGENDA.centro
    const isWeekend = params.date.day() === 0 || params.date.day() === 6
    const dayPlan = isWeekend ? agenda.weekend : agenda.weekday
    const dateLabel = formatDateLabel(params.date, params.language)
    const sedeLabel = params.sede || 'Centro'
    const activityLines = dayPlan.map((item) => `- ${item.time} - ${params.language === 'en' ? item.en : item.es}`)

    const suggestedServices = (params.services || [])
        .filter((service) => {
            const category = normalizeText(String(service.categoria || ''))
            return category.includes('traslado') || category.includes('spa') || category.includes('restaurante')
        })
        .slice(0, 2)
        .map((service) => {
            const name = service.nombre || service.categoria || (params.language === 'en' ? 'service' : 'servicio')
            const hours = service.horarios
                ? params.language === 'en'
                    ? `Hours: ${service.horarios}.`
                    : `Horario: ${service.horarios}.`
                : ''
            return `- ${name}${hours ? ` ${hours}` : ''}`.trim()
        })

    const intro =
        params.language === 'en'
            ? `For ${dateLabel}, this is a mock activities agenda for ${sedeLabel}:`
            : `Para ${dateLabel}, esta es la agenda mock de actividades para ${sedeLabel}:`
    const defaultSedeLine = params.defaultSedeUsed
        ? params.language === 'en'
            ? 'I used Centro as default location. If you share another location, I can adjust it.'
            : 'Use Centro como sede base. Si me decis otra sede, lo ajusto.'
        : ''
    const servicesIntro =
        suggestedServices.length > 0
            ? params.language === 'en'
                ? 'Available add-on services for that day:'
                : 'Servicios adicionales disponibles para ese dia:'
            : ''

    return [intro, activityLines.join('\n\n'), servicesIntro, suggestedServices.join('\n\n'), defaultSedeLine].filter(Boolean).join('\n\n')
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

const buildAmbiguousDateQuestion = (input: { raw: string; first: number; second: number }, language: 'es' | 'en') => {
    const left = String(input.first).padStart(2, '0')
    const right = String(input.second).padStart(2, '0')
    const optionA = `${left}/${right}`
    const optionB = `${right}/${left}`
    return language === 'en'
        ? `Quick check: "${input.raw}" could be ${optionA} or ${optionB}. Can you confirm the dates in YYYY-MM-DD?`
        : `Para evitar errores con "${input.raw}", puede ser ${optionA} o ${optionB}. Confirmame las fechas en formato YYYY-MM-DD.`
}

const buildDateRange = (start: moment.Moment, end: moment.Moment) => {
    const dates: string[] = []
    const cursor = start.clone()
    while (cursor.isBefore(end, 'day')) {
        dates.push(cursor.format('YYYY-MM-DD'))
        cursor.add(1, 'day')
    }
    return dates
}

const formatMoney = (amount?: number, currency?: string) => {
    if (!amount) return 'Consultar'
    return `${amount.toFixed(0)} ${currency || 'USD'}`
}

const formatMonthName = (month: number, year: number, language: 'es' | 'en') => {
    const locale = language === 'en' ? 'en' : 'es'
    return moment({ year, month: month - 1, day: 1 }).locale(locale).format('MMMM')
}

const formatDateLabel = (date: moment.Moment, language: 'es' | 'en') => {
    const locale = language === 'en' ? 'en' : 'es'
    return language === 'en'
        ? date.locale(locale).format('MMM D, YYYY')
        : date.locale(locale).format('D [de] MMMM [de] YYYY')
}

const formatDateLabelFromISO = (value: string, language: 'es' | 'en') => {
    const parsed = parseDate(value)
    if (!parsed.isValid()) return value
    return formatDateLabel(parsed, language)
}

const formatSuggestedRange = (start: moment.Moment, end: moment.Moment, language: 'es' | 'en') => {
    return formatStaySpan(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), language)
}

const formatStaySpan = (start: string, end: string, language: 'es' | 'en') => {
    const startLabel = formatDateLabelFromISO(start, language)
    const endLabel = formatDateLabelFromISO(end, language)
    return language === 'en'
        ? `check-in ${startLabel}, check-out ${endLabel}`
        : `entrada ${startLabel}, salida ${endLabel}`
}

const formatGuestName = (name: string) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/g)
        .filter(Boolean)
    if (!parts.length) return ''
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const mergePreferences = (current: string | undefined, additions: string[]) => {
    const existingRaw = (current || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    const existing = new Set(existingRaw.map((item) => normalizeText(item)))
    const merged = [...existingRaw]
    for (const addition of additions) {
        const normalized = normalizeText(addition)
        if (normalized && !existing.has(normalized)) {
            merged.push(addition)
            existing.add(normalized)
        }
    }
    return merged.join(', ')
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
    const today = moment().startOf('day')
    const wantsNext = text.includes('proximo') || text.includes('proxima') || text.includes('next')
    const includeToday = !wantsNext
    const isLongWeekend =
        text.includes('fin de semana largo') || text.includes('finde largo') || text.includes('puente') || text.includes('long weekend')
    const isWeekend = text.includes('fin de semana') || text.includes('finde') || text.includes('weekend')
    const isEndOfMonth = text.includes('fin de mes') || text.includes('end of month')
    const isSemanaSanta = text.includes('semana santa') || text.includes('easter week') || text.includes('easter')
    const quincenaMentioned = text.includes('quincena')
    const isFirstQuincena = text.includes('primera quincena') || text.includes('1ra quincena')
    const isSecondQuincena = text.includes('segunda quincena') || text.includes('2da quincena')
    const hasSaturday = text.includes('sabado') || text.includes('saturday')
    const hasSunday = text.includes('domingo') || text.includes('sunday')

    if (isSemanaSanta) {
        let year = today.year()
        let start = getEasterSunday(year).clone().subtract(3, 'day')
        let end = getEasterSunday(year).clone().add(1, 'day')
        if (end.isBefore(today, 'day')) {
            year += 1
            start = getEasterSunday(year).clone().subtract(3, 'day')
            end = getEasterSunday(year).clone().add(1, 'day')
        }
        return { start, end, kind: 'semana_santa' }
    }

    if (quincenaMentioned) {
        const monthInfo = findMonthInText(message || '')
        if (monthInfo) {
            const startDay = isSecondQuincena ? 16 : 1
            const monthIndex = monthInfo.month - 1
            const start = moment({ year: monthInfo.year, month: monthIndex, day: startDay })
            const endDay = isSecondQuincena ? start.clone().endOf('month').date() : 15
            const end = moment({ year: monthInfo.year, month: monthIndex, day: endDay })
            return { start, end, kind: isSecondQuincena ? 'second_half' : 'first_half' }
        }
    }

    if (isEndOfMonth) {
        const lastDay = today.clone().endOf('month').startOf('day')
        const start = lastDay.clone().subtract(1, 'day')
        const end = lastDay.clone().add(1, 'day')
        return { start, end, kind: 'end_of_month' }
    }

    if (isLongWeekend) {
        const friday = getNextWeekday(today, 5, includeToday)
        const start = friday
        const end = friday.clone().add(3, 'day')
        return { start, end, kind: 'long_weekend' }
    }

    if (isWeekend) {
        let saturday = getNextWeekday(today, 6, includeToday)
        if (today.day() === 0 && includeToday) {
            saturday = getNextWeekday(today.clone().add(1, 'day'), 6, true)
        }
        const start = saturday
        const end = saturday.clone().add(2, 'day')
        return { start, end, kind: 'weekend' }
    }

    if (hasSaturday || hasSunday) {
        const targetDay = hasSaturday ? 6 : 0
        const start = getNextWeekday(today, targetDay, includeToday)
        const end = start.clone().add(1, 'day')
        return { start, end, kind: hasSaturday ? 'saturday' : 'sunday' }
    }

    return null
}

const buildMinNightsAnswer = (availability: { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> }, language: 'es' | 'en') => {
    const minNights = Number(availability.minNights || 0)
    const nights = Number(availability.nights || 0)
    if (!minNights || nights >= minNights) return ''
    const reason = availability.minRule?.motivo ? ` (${availability.minRule.motivo})` : ''
    const ranges = (availability.suggestedRanges || [])
        .map((range) => {
            const start = parseDate(range.start)
            const end = parseDate(range.end)
            if (!start.isValid() || !end.isValid()) return ''
            return formatSuggestedRange(start, end, language)
        })
        .filter(Boolean)
    const optionsText = ranges.length
        ? language === 'en'
            ? `I can offer ${ranges.join(' or ')}.`
            : `Puedo ofrecer ${ranges.join(' o ')}.`
        : ''
    const base = language === 'en' ? `The minimum stay is ${minNights} nights${reason}.` : `El minimo es ${minNights} noches${reason}.`
    const question = language === 'en' ? 'Interested?' : 'Te sirve?'
    return [base, optionsText, question].filter(Boolean).join(' ')
}

const buildAvailabilityOptionsAnswer = (options: string[], language: 'es' | 'en', repeat: boolean) => {
    if (language === 'en') {
        return repeat ? `Options:\n${formatBulletList(options)}` : `Here are some options:\n${formatBulletList(options)}`
    }
    return repeat ? `Opciones:\n${formatBulletList(options)}` : `Aca tenes opciones:\n${formatBulletList(options)}`
}

const appendEscalationPrompt = (answer: string, language: 'es' | 'en') => {
    const prompt = language === 'en' ? 'Want me to connect you with a human?' : 'Queres que te pase con un humano?'
    return `${answer}\n\n${prompt}`
}

const formatAvailabilityOption = (item: {
    hotelName?: string
    sede?: string
    roomType?: string
    baseRate?: number
    currency?: string
    capacity?: number
    breakfastIncluded?: boolean
}, language: 'es' | 'en') => {
    const place = item.hotelName || item.sede || ''
    const room = item.roomType || ''
    const fromLabel = language === 'en' ? 'from' : 'desde'
    const price = item.baseRate ? `${fromLabel} ${formatMoney(item.baseRate, item.currency)}` : ''
    const details: string[] = []
    if (item.capacity) {
        details.push(language === 'en' ? `capacity ${item.capacity}` : `capacidad ${item.capacity}`)
    }
    if (item.breakfastIncluded) {
        details.push(language === 'en' ? 'breakfast included' : 'con desayuno')
    }
    const detailText = details.length ? ` - ${details.join(', ')}` : ''
    return `- ${place} ${room}: ${price}${detailText}`.replace(/\s+/g, ' ').trim()
}

const buildMissingDetailsQuestion = (params: {
    language: 'es' | 'en'
    needsLocation?: boolean
    needsRoomType?: boolean
    needsGuests?: boolean
}) => {
    const parts: string[] = []
    if (params.needsLocation) {
        parts.push(params.language === 'en' ? 'location' : 'sede')
    }
    if (params.needsRoomType) {
        parts.push(params.language === 'en' ? 'room type' : 'tipo de habitacion')
    }
    if (params.needsGuests) {
        parts.push(params.language === 'en' ? 'guest count' : 'cantidad de personas')
    }
    if (!parts.length) return ''
    const list =
        parts.length === 1
            ? parts[0]
            : `${parts.slice(0, -1).join(params.language === 'en' ? ', ' : ', ')}${params.language === 'en' ? ' and ' : ' y '}${
                  parts[parts.length - 1]
              }`
    return params.language === 'en'
        ? `For those dates I need ${list}. Share that and I will continue.`
        : `Para esas fechas necesito ${list}. Decime eso y sigo.`
}

const buildReservationRecap = (draft: {
    start: string
    end: string
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
    paymentMethod?: string
    earlyCheckin?: boolean
    lateCheckout?: boolean
    preferences?: string
}, language: 'es' | 'en') => {
    const parts: string[] = []
    const place = draft.sede || draft.hotelId
    if (place) {
        parts.push(place)
    }
    if (draft.roomType) {
        parts.push(draft.roomType)
    }
    parts.push(formatStaySpan(draft.start, draft.end, language))
    if (draft.guests) {
        parts.push(language === 'en' ? `${draft.guests} guests` : `${draft.guests} personas`)
    }
    if (draft.paymentMethod) {
        parts.push(language === 'en' ? `payment ${draft.paymentMethod}` : `pago ${draft.paymentMethod}`)
    }
    if (draft.earlyCheckin) {
        parts.push(language === 'en' ? 'early check-in' : 'ingreso temprano')
    }
    if (draft.lateCheckout) {
        parts.push(language === 'en' ? 'late check-out' : 'salida tarde')
    }
    if (draft.preferences) {
        parts.push(language === 'en' ? `prefs ${draft.preferences}` : `preferencias ${draft.preferences}`)
    }
    const summary = parts.filter(Boolean).join(', ')
    return language === 'en'
        ? `Before I confirm: ${summary}. Should I confirm?`
        : `Antes de confirmar: ${summary}. Confirmo?`
}

const buildReservationSummaryLine = (
    params: {
        hotelName?: string
        sede?: string
        roomType?: string
        checkIn?: string
        checkOut?: string
        guests?: number
        earlyCheckin?: boolean
        lateCheckout?: boolean
    },
    language: 'es' | 'en'
) => {
    const place = params.hotelName || params.sede || ''
    const room = params.roomType || ''
    const stay = params.checkIn && params.checkOut ? formatStaySpan(params.checkIn, params.checkOut, language) : ''
    const guests =
        typeof params.guests === 'number'
            ? language === 'en'
                ? `${params.guests} guests`
                : `${params.guests} personas`
            : ''
    const extras = [
        params.earlyCheckin ? (language === 'en' ? 'early check-in' : 'ingreso temprano') : '',
        params.lateCheckout ? (language === 'en' ? 'late check-out' : 'salida tarde') : ''
    ].filter(Boolean)
    const parts = [place, room, stay, guests, ...extras].filter(Boolean)
    if (!parts.length) return ''
    const summary = parts.join(', ')
    return language === 'en' ? `Summary: ${summary}.` : `Resumen: ${summary}.`
}

const buildFlexibleAvailabilityMessage = async (params: {
    month: number
    year: number
    nights?: number
    weekendOnly?: boolean
    language: 'es' | 'en'
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
}) => {
    const nights = Math.max(params.nights || (params.weekendOnly ? 2 : 2), 1)
    const startOfMonth = moment({ year: params.year, month: params.month - 1, day: 1 }).startOf('day')
    const endOfMonth = startOfMonth.clone().endOf('month')
    const today = moment().startOf('day')
    const options: string[] = []

    for (let day = 1; day <= endOfMonth.date(); day += 1) {
        const start = moment({ year: params.year, month: params.month - 1, day }).startOf('day')
        if (start.isBefore(today, 'day')) continue
        if (params.weekendOnly && start.day() !== 5) continue
        const end = start.clone().add(nights, 'day')
        if (end.isAfter(endOfMonth.clone().add(1, 'day'), 'day')) continue
        const availability = await checkAvailability({
            start: start.format('YYYY-MM-DD'),
            end: end.format('YYYY-MM-DD'),
            sede: params.sede,
            hotelId: params.hotelId,
            roomType: params.roomType,
            guests: params.guests
        })
        const okAvailability = availability as { available?: Array<Record<string, unknown>> }
        if (availability.ok && (okAvailability.available || []).length) {
            options.push(formatSuggestedRange(start, end, params.language))
        }
        if (options.length >= 3) break
    }

    if (!options.length) return ''
    const monthName = formatMonthName(params.month, params.year, params.language)
    const header =
        params.language === 'en'
            ? `Here are some flexible options in ${monthName}:`
            : `Opciones flexibles en ${monthName}:`
    const question = params.language === 'en' ? 'Which one works best?' : 'Cual te sirve?'
    const lines = options.map((option) => `- ${option}`)
    return `${header}\n${formatBulletList(lines)}\n\n${question}`
}

const buildContextFromMessages = (messages: Array<{ metadata?: Record<string, any> }>) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const context = messages[i]?.metadata?.context
        if (context) return context
    }
    return {}
}

const buildContextRestorePayload = (restored: Record<string, unknown>, current: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {}
    const keys = ['start', 'end', 'month', 'year', 'hotelId', 'sede', 'roomType', 'guests', 'earlyCheckin', 'lateCheckout', 'preferences', 'dateContextUpdatedAt']
    for (const key of keys) {
        if (current[key] == null && restored[key] != null) {
            payload[key] = restored[key]
        }
    }
    return payload
}

const isDateContextStale = (params: { start?: string; end?: string; dateContextUpdatedAt?: string | Date | null }) => {
    if (!params.start || !params.end) return false
    if (!params.dateContextUpdatedAt) return true
    const last = moment(params.dateContextUpdatedAt)
    if (!last.isValid()) return true
    return moment().diff(last, 'days') >= HOTEL_DATE_CONTEXT_TTL_DAYS
}

const getSessionContext = async (sessionId: string) => {
    if (!sessionId) return {}
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('read', [collections.manualAgentSessions])
    const session = await db
        .collection<{ context?: Record<string, any> }>(collections.manualAgentSessions)
        .findOne({ sessionId, agentId: HOTEL_AGENT_ID }, { projection: { context: 1 } })
    return session?.context || {}
}

const findRecentSessionByIdentity = async (params: { sessionId: string; name?: string; email?: string }) => {
    if (!params.name && !params.email) return null
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('read', [collections.manualAgentSessions])
    const filters: Record<string, unknown>[] = []
    if (params.email) {
        filters.push({ 'context.email': { $regex: `^${escapeRegex(params.email)}$`, $options: 'i' } })
    }
    if (params.name) {
        filters.push({ 'context.name': params.name })
        filters.push({
            messages: {
                $elemMatch: { role: 'user', content: { $regex: new RegExp(`\\b${escapeRegex(params.name)}\\b`, 'i') } }
            }
        })
    }
    if (!filters.length) return null
    const session = await db
        .collection<{ context?: Record<string, any>; messages?: Array<{ role: string; content: string }> }>(
            collections.manualAgentSessions
        )
        .find({ agentId: HOTEL_AGENT_ID, sessionId: { $ne: params.sessionId }, $or: filters })
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray()
    return session[0] || null
}

const updateSessionContext = async (sessionId: string, context: Record<string, unknown>) => {
    if (!sessionId || !Object.keys(context).length) return
    const touchesDateContext = ['start', 'end', 'month', 'year'].some((key) => context[key] !== undefined)
    if (touchesDateContext && !context.dateContextUpdatedAt) {
        context.dateContextUpdatedAt = new Date()
    }
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('write', [collections.manualAgentSessions])
    const setPayload = Object.fromEntries(Object.entries(context).map(([key, value]) => [`context.${key}`, value]))
    await db.collection(collections.manualAgentSessions).updateOne(
        { sessionId, agentId: HOTEL_AGENT_ID },
        { $set: { ...setPayload, updatedAt: new Date() } }
    )
}

const resetHotelSessionFlow = async (sessionId: string) => {
    if (!sessionId) return
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('write', [collections.manualAgentSessions])
    const flowKeys = [
        'start',
        'end',
        'month',
        'year',
        'sede',
        'hotelId',
        'roomType',
        'guests',
        'paymentMethod',
        'preferences',
        'availabilityOk',
        'availabilityScope',
        'pendingDateConfirm',
        'pendingReservationConfirm',
        'lastIntentSummary',
        'lastReplyKind',
        'lastTopic',
        'frictionCount',
        'confusionCount',
        'dateContextUpdatedAt'
    ]
    const unsetPayload = Object.fromEntries(flowKeys.map((key) => [`context.${key}`, '']))
    await db.collection(collections.manualAgentSessions).updateOne(
        { sessionId, agentId: HOTEL_AGENT_ID },
        { $unset: unsetPayload, $set: { updatedAt: new Date() } }
    )
}

const applyHotelReplySignals = async (params: {
    answer: string
    sessionId: string
    context: Record<string, unknown>
    language: 'es' | 'en'
    replyKind?: string
    intentSummary?: string
    frictionAction?: 'increase' | 'reset'
    topic?: string
}) => {
    let answer = params.answer || ''
    const contextUpdate: Record<string, unknown> = {}

    const name = String(params.context?.name || '')
    if (name) {
        const formatted = formatGuestName(name)
        const currentCount = Number(params.context?.nameUseCount || 0)
        const nextCount = currentCount + 1
        contextUpdate.nameUseCount = nextCount
        const shouldUse = nextCount % 3 === 1
        if (formatted && shouldUse && !normalizeText(answer).startsWith(normalizeText(formatted))) {
            answer = `${formatted}, ${answer}`
        }
    }

    if (params.replyKind) {
        contextUpdate.lastReplyKind = params.replyKind
    }
    if (params.intentSummary) {
        contextUpdate.lastIntentSummary = params.intentSummary
    }
    if (params.topic) {
        contextUpdate.lastTopic = params.topic
    }

    if (params.frictionAction) {
        const currentCount = Number(params.context?.frictionCount || 0)
        const nextCount = params.frictionAction === 'reset' ? 0 : currentCount + 1
        contextUpdate.frictionCount = nextCount
        if (params.frictionAction === 'increase' && nextCount >= HOTEL_FRICTION_THRESHOLD) {
            answer = appendEscalationPrompt(answer, params.language)
        }
    }

    if (Object.keys(contextUpdate).length) {
        await updateSessionContext(params.sessionId, contextUpdate)
    }

    return { answer, contextUpdate }
}

const findMinNightsRule = (rules: HotelRulesDoc, start: moment.Moment, end: moment.Moment) => {
    const stayEnd = end.clone().subtract(1, 'day')
    let selected: MinNightsRule | null = null

    for (const rule of rules.minimasNoches || []) {
        const range = rule.rango || []
        if (!range[0] || !range[1]) continue
        const rangeStart = parseDate(range[0])
        const rangeEnd = parseDate(range[1])
        if (!rangeStart.isValid() || !rangeEnd.isValid()) continue
        const overlaps = start.isSameOrBefore(rangeEnd, 'day') && stayEnd.isSameOrAfter(rangeStart, 'day')
        if (!overlaps) continue
        if (!selected || (rule.minNoches || 0) > (selected.minNoches || 0)) {
            selected = rule
        }
    }

    return selected
}

const findPolicyRule = (rules: PolicyRule[] | undefined, tarifa: string, daysUntil: number) => {
    const matching = (rules || []).filter((rule) => normalizeText(rule.tarifa || '') === normalizeText(tarifa))
    if (!matching.length) return null

    const eligible = matching.filter((rule) => typeof rule.diasLimite === 'number' && daysUntil >= (rule.diasLimite as number))
    if (eligible.length) {
        return eligible.sort((a, b) => (b.diasLimite || 0) - (a.diasLimite || 0))[0]
    }

    return matching.sort((a, b) => (a.diasLimite || 0) - (b.diasLimite || 0))[0]
}

const findCancellationLockRule = (rules: PolicyRule[] | undefined, tarifa: string) => {
    const matching = (rules || []).filter((rule) => normalizeText(rule.tarifa || '') === normalizeText(tarifa))
    if (!matching.length) return null
    const lockCandidates = matching.filter((rule) => typeof rule.diasLimite === 'number' && Number(rule.diasLimite || 0) > 0)
    if (!lockCandidates.length) return null
    return lockCandidates.sort((a, b) => Number(b.diasLimite || 0) - Number(a.diasLimite || 0))[0]
}

const resolveCancellationLockDays = (rules: PolicyRule[] | undefined, tarifa: string) => {
    const lockRule = findCancellationLockRule(rules, tarifa)
    if (!lockRule || typeof lockRule.diasLimite !== 'number') return 0
    return Math.max(Number(lockRule.diasLimite || 0), 0)
}

const isBlockedByRule = (rules: HotelRulesDoc, sede: string, dates: string[]) => {
    const normalizedSede = normalizeText(sede)
    return (rules.bloqueos || []).find((block) => {
        if (!block.fecha) return false
        if (normalizeText(block.sede || '') !== normalizedSede) return false
        return dates.includes(block.fecha)
    })
}

const findHotelByQuery = (hotels: HotelInventoryDoc[], query: string) => {
    const normalized = normalizeText(query)
    const matches = hotels.filter((hotel) => {
        const hotelId = normalizeText(String(hotel.hotelId || ''))
        const nombre = normalizeText(String(hotel.nombre || ''))
        const sede = normalizeText(String(hotel.sede || ''))
        return hotelId.includes(normalized) || nombre.includes(normalized) || sede.includes(normalized)
    })
    return matches.sort((a, b) => {
        const aIsPrimary = String(a.hotelId || '').includes('-x') ? 1 : 0
        const bIsPrimary = String(b.hotelId || '').includes('-x') ? 1 : 0
        return aIsPrimary - bIsPrimary
    })
}

const getHotelInventory = async () => {
    const db = await getManualAgentsDb()
    const { hotelInventory } = collectionNames
    ensureToolAccess('read', [hotelInventory])
    return db.collection<HotelInventoryDoc>(hotelInventory).find({ agentId: HOTEL_AGENT_ID }).toArray()
}

const getHotelRules = async (): Promise<HotelRulesDoc> => {
    const db = await getManualAgentsDb()
    const { hotelRules } = collectionNames
    ensureToolAccess('read', [hotelRules])
    const doc = await db.collection<HotelRulesDoc>(hotelRules).findOne({ agentId: HOTEL_AGENT_ID }, { sort: { updatedAt: -1 } })
    return doc || {}
}

const getHotelFaq = async (): Promise<HotelFaqDoc> => {
    const db = await getManualAgentsDb()
    const { hotelFaq } = collectionNames
    ensureToolAccess('read', [hotelFaq])
    const doc = await db.collection<HotelFaqDoc>(hotelFaq).findOne({ agentId: HOTEL_AGENT_ID, type: 'faq' })
    return doc || {}
}

const getHotelInfoDocs = async () => {
    const db = await getManualAgentsDb()
    const { hotelInfo } = collectionNames
    ensureToolAccess('read', [hotelInfo])
    return db.collection<HotelInfoDoc>(hotelInfo).find({ agentId: HOTEL_AGENT_ID }).toArray()
}

const getHotelServices = async () => {
    const db = await getManualAgentsDb()
    const { hotelServices } = collectionNames
    ensureToolAccess('read', [hotelServices])
    return db.collection<HotelServiceDoc>(hotelServices).find({ agentId: HOTEL_AGENT_ID }).toArray()
}

const getHotelGuestProfiles = async () => {
    const db = await getManualAgentsDb()
    const { hotelGuestProfiles } = collectionNames
    ensureToolAccess('read', [hotelGuestProfiles])
    return db.collection<HotelGuestProfileDoc>(hotelGuestProfiles).find({ agentId: HOTEL_AGENT_ID }).toArray()
}

const getHotelSupport = async (): Promise<HotelSupportDoc> => {
    const db = await getManualAgentsDb()
    const { hotelSupport } = collectionNames
    ensureToolAccess('read', [hotelSupport])
    const doc = await db.collection<HotelSupportDoc>(hotelSupport).findOne({ agentId: HOTEL_AGENT_ID, type: 'support' })
    return doc || { protocolos: [], manuales: [], agentId: HOTEL_AGENT_ID, type: 'support' }
}

const getHotelPromos = async () => {
    const db = await getManualAgentsDb()
    const { hotelPromos } = collectionNames
    ensureToolAccess('read', [hotelPromos])
    return db.collection<HotelPromoDoc>(hotelPromos).find({ agentId: HOTEL_AGENT_ID }).toArray()
}

const getHotelLeadsDoc = async () => {
    const db = await getManualAgentsDb()
    const { hotelLeads } = collectionNames
    ensureToolAccess('read', [hotelLeads])
    return db.collection<{ leads?: HotelLeadDoc[] }>(hotelLeads).findOne({ agentId: HOTEL_AGENT_ID, type: 'seed' })
}

const upsertHotelLead = async (input: HotelLeadDoc) => {
    const db = await getManualAgentsDb()
    const { hotelLeads } = collectionNames
    ensureToolAccess('write', [hotelLeads])
    const collection = db.collection<{ leads?: HotelLeadDoc[] }>(hotelLeads)

    const doc = await collection.findOne({ agentId: HOTEL_AGENT_ID, type: 'seed' })
    const leads = (doc?.leads || []) as HotelLeadDoc[]
    const leadId = input.id || input.email || nanoid(8)
    const existingIndex = leads.findIndex((lead) => lead.id === leadId || (input.email && lead.email === input.email))
    const payload = {
        id: leadId,
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        interes: input.interes,
        origen: input.origen,
        estado: input.estado || 'open',
        notas: input.notas
    }

    if (existingIndex >= 0) {
        leads[existingIndex] = { ...leads[existingIndex], ...payload }
    } else {
        leads.push(payload)
    }

    await collection.updateOne(
        { agentId: HOTEL_AGENT_ID, type: 'seed' },
        { $set: { agentId: HOTEL_AGENT_ID, type: 'seed', leads, updatedAt: new Date() } },
        { upsert: true }
    )

    return payload
}

const recordHotelNotification = async (input: { type: string; payload: Record<string, unknown> }) => {
    const db = await getManualAgentsDb()
    const { hotelNotifications } = collectionNames
    ensureToolAccess('write', [hotelNotifications])
    await db.collection<HotelNotificationDoc>(hotelNotifications).insertOne({
        agentId: HOTEL_AGENT_ID,
        type: input.type,
        status: 'queued',
        payload: input.payload,
        createdAt: new Date()
    })
}

const resolveServiceNotification = (requestType: string) => {
    const normalized = normalizeText(requestType || '')
    if (normalized.includes('restaurante') || normalized.includes('restaurant') || normalized.includes('room_service')) {
        return { type: 'restaurant_order', team: 'restaurante' }
    }
    if (normalized.includes('maintenance') || normalized.includes('mantenimiento')) {
        return { type: 'maintenance_incident', team: 'mantenimiento' }
    }
    return { type: 'guest_service_request', team: 'housekeeping' }
}

const recordOperationalServiceNotification = async (input: {
    reservationId: string
    requestType: string
    message?: string
    source?: string
    extraPayload?: Record<string, unknown>
}) => {
    const target = resolveServiceNotification(input.requestType)
    try {
        await recordHotelNotification({
            type: target.type,
            payload: {
                reservationId: input.reservationId,
                requestType: input.requestType,
                team: target.team,
                message: input.message || '',
                source: input.source || 'chat',
                ...(input.extraPayload || {})
            }
        })
    } catch (error) {
        const details = error instanceof Error ? error.message : 'unknown'
        console.error('[manual-agents] hotel notify staff error', details)
    }
}

const scheduleHotelReminder = async (input: {
    reservationId?: string
    message?: string
    when?: string
    channel?: string
    serviceType?: string
}) => {
    if (!input.reservationId) {
        return { ok: false, reason: 'missing_reservation_id' }
    }
    const reservation = await (await getHotelReservationsCollection()).findOne({ agentId: HOTEL_AGENT_ID, id: input.reservationId })
    if (!reservation) {
        return { ok: false, reason: 'reservation_not_found' }
    }
    const whenIso = input.when || extractReminderAt(input.message || '')
    if (!whenIso) {
        return { ok: false, reason: 'invalid_datetime' }
    }
    const reminderId = `RMD-${nanoid(8).toUpperCase()}`
    const payload = {
        reminderId,
        reservationId: input.reservationId,
        hotelSede: reservation.sede || '',
        guestName: reservation.nombre || '',
        guestEmail: reservation.email || '',
        serviceType: input.serviceType || 'general',
        message: input.message || '',
        when: whenIso,
        channel: input.channel || 'chat'
    }
    await recordHotelNotification({ type: 'service_reminder', payload })
    return { ok: true, reminder: payload }
}

const getHotelAvailabilityDocs = async (params: { sede: string; tipo: string; fechas: string[] }) => {
    const db = await getManualAgentsDb()
    const { hotelAvailability } = collectionNames
    ensureToolAccess('read', [hotelAvailability])
    return db
        .collection<HotelAvailabilityDoc>(hotelAvailability)
        .find({
            agentId: HOTEL_AGENT_ID,
            sede: params.sede,
            tipo: params.tipo,
            fecha: { $in: params.fechas }
        })
        .toArray()
}

const getHotelReservationsCollection = async () => {
    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('read', [hotelReservations])
    return db.collection<HotelReservationDoc>(hotelReservations)
}

const buildAvailabilityStatus = (dates: string[], docs: HotelAvailabilityDoc[]) => {
    const byDate = new Map<string, HotelAvailabilityDoc>()
    for (const doc of docs) {
        if (doc.fecha) {
            byDate.set(doc.fecha, doc)
        }
    }

    const missingDates: string[] = []
    let minCupo = Number.POSITIVE_INFINITY
    let overbooking = false

    for (const date of dates) {
        const doc = byDate.get(date)
        if (!doc) {
            missingDates.push(date)
            continue
        }
        const cupo = Number(doc.cupo || 0)
        minCupo = Math.min(minCupo, cupo)
        if (doc.overbooking) {
            overbooking = true
        }
        if (cupo <= 0 && !doc.overbooking) {
            return { ok: false, reason: 'sold_out', missingDates }
        }
    }

    if (missingDates.length) {
        return { ok: false, reason: 'missing_dates', missingDates }
    }

    return { ok: true, minCupo: Number.isFinite(minCupo) ? minCupo : 0, overbooking }
}

const getApplicablePromos = (
    promos: HotelPromoDoc[],
    params: { sede: string; roomType: string; rateType: string; start: moment.Moment; end: moment.Moment }
) => {
    const normalizedSede = normalizeText(params.sede)
    const normalizedRoom = normalizeText(params.roomType)
    const normalizedRate = normalizeText(params.rateType)
    const stayEnd = params.end.clone().subtract(1, 'day')

    return promos.filter((promo) => {
        const range = promo.rango || []
        if (!range[0] || !range[1]) return false
        const start = parseDate(range[0])
        const end = parseDate(range[1])
        if (!start.isValid() || !end.isValid()) return false
        const overlaps = params.start.isSameOrBefore(end, 'day') && stayEnd.isSameOrAfter(start, 'day')
        if (!overlaps) return false
        if (promo.sedes?.length && normalizedSede) {
            const matchSede = promo.sedes.some((sede) => normalizeText(sede) === normalizedSede)
            if (!matchSede) return false
        }
        if (promo.tiposHabitacion?.length && normalizedRoom) {
            const matchRoom = promo.tiposHabitacion.some((tipo) => normalizeText(tipo) === normalizedRoom)
            if (!matchRoom) return false
        }
        const aplica = normalizeText(String(promo.aplicaTarifa || 'both'))
        if (normalizedRate && aplica !== 'both' && aplica !== normalizedRate) return false
        return true
    })
}

const countWeekendNights = (start: moment.Moment, end: moment.Moment) => {
    let count = 0
    const cursor = start.clone().startOf('day')
    const limit = end.clone().startOf('day')
    while (cursor.isBefore(limit, 'day')) {
        const day = cursor.day()
        if (day === 5 || day === 6) {
            count += 1
        }
        cursor.add(1, 'day')
    }
    return count
}

const getSeasonalDynamicPct = (rules: HotelRulesDoc, start: moment.Moment, end: moment.Moment) => {
    const stayEnd = end.clone().subtract(1, 'day')
    for (const rule of rules.minimasNoches || []) {
        const range = rule.rango || []
        if (!range[0] || !range[1]) continue
        const rangeStart = parseDate(range[0])
        const rangeEnd = parseDate(range[1])
        if (!rangeStart.isValid() || !rangeEnd.isValid()) continue
        const overlaps = start.isSameOrBefore(rangeEnd, 'day') && stayEnd.isSameOrAfter(rangeStart, 'day')
        if (!overlaps) continue
        const reason = normalizeText(String(rule.motivo || ''))
        if (reason.includes('feriado')) return 12
        if (reason.includes('temporada')) return 10
        if (reason.includes('alta')) return 8
    }
    return 0
}

const calculateTotal = (params: {
    room: HotelRoom
    nights: number
    rules: HotelRulesDoc
    extras: { earlyCheckin?: boolean; lateCheckout?: boolean }
    promos?: HotelPromoDoc[]
    sede: string
    roomType: string
    rateType: string
    start: moment.Moment
    end: moment.Moment
}) => {
    const { room, nights, rules, extras } = params
    const base = Number(room.tarifaBase || 0)
    const currency = room.moneda || 'USD'
    const baseTotal = base * nights
    let total = baseTotal
    const fees: Array<{ label: string; amount: number; currency: string }> = []
    const appliedPromos = getApplicablePromos(params.promos || [], {
        sede: params.sede,
        roomType: params.roomType,
        rateType: params.rateType,
        start: params.start,
        end: params.end
    })

    const weekendNights = countWeekendNights(params.start, params.end)
    if (weekendNights > 0) {
        const weekendPct = 8
        const weekendAmount = Number(((base * weekendNights * weekendPct) / 100).toFixed(2))
        total += weekendAmount
        fees.push({ label: 'dynamic_weekend', amount: weekendAmount, currency })
    }

    const seasonalPct = getSeasonalDynamicPct(rules, params.start, params.end)
    if (seasonalPct > 0) {
        const seasonalAmount = Number(((baseTotal * seasonalPct) / 100).toFixed(2))
        total += seasonalAmount
        fees.push({ label: 'dynamic_season', amount: seasonalAmount, currency })
    }

    if (appliedPromos.length) {
        const discountPct = Math.max(...appliedPromos.map((promo) => Number(promo.descuentoPct || 0)))
        const ajustePct = Math.max(...appliedPromos.map((promo) => Number(promo.ajustePct || 0)))
        if (ajustePct) {
            const ajusteAmount = (baseTotal * ajustePct) / 100
            total += ajusteAmount
            fees.push({ label: 'ajuste_dinamico', amount: ajusteAmount, currency })
        }
        if (discountPct) {
            const discountAmount = (baseTotal * discountPct) / 100
            total -= discountAmount
            fees.push({ label: 'descuento', amount: discountAmount * -1, currency })
        }
    }

    if (extras.earlyCheckin && rules.earlyLate?.earlyCheckin?.fee) {
        const fee = Number(rules.earlyLate.earlyCheckin.fee || 0)
        total += fee
        fees.push({ label: 'early_checkin', amount: fee, currency })
    }

    if (extras.lateCheckout && rules.earlyLate?.lateCheckout?.fee) {
        const fee = Number(rules.earlyLate.lateCheckout.fee || 0)
        total += fee
        fees.push({ label: 'late_checkout', amount: fee, currency })
    }

    return { total, currency, fees, appliedPromos }
}

const buildConfirmation = (reservation: HotelReservationDoc, info?: HotelInfoDoc | null) => {
    const voucherId = `VCH-${reservation.id}`
    return {
        voucherId,
        confirmationMessage: `Reserva confirmada ${reservation.id}. Check-in ${reservation.checkIn} - Check-out ${reservation.checkOut}.`,
        hotel: {
            nombre: info?.nombre || reservation.sede || '',
            ubicacion: info?.ubicacion || '',
            mapaUrl: info?.mapaUrl || '',
            horarios: info?.horarios || {}
        }
    }
}

const buildReservationFailureAnswer = (
    params: { reason?: string; minNights?: number; maxGuests?: number; policyNote?: string; lockDays?: number; language: 'es' | 'en' }
) => {
    const reason = String(params.reason || '')
    if (reason === 'missing_guest') {
        return params.language === 'en'
            ? 'To complete the booking I still need your full name and email.'
            : 'Para completar la reserva todavia necesito nombre completo y email.'
    }
    if (reason === 'missing_guests') {
        return params.language === 'en'
            ? 'I still need the guest count to complete the booking.'
            : 'Todavia necesito la cantidad de huespedes para completar la reserva.'
    }
    if (reason === 'missing_room_type') {
        return params.language === 'en'
            ? 'I still need the room type to continue.'
            : 'Todavia necesito el tipo de habitacion para continuar.'
    }
    if (reason === 'hotel_not_found') {
        return params.language === 'en'
            ? 'I could not find that hotel location. Share the exact location (Centro, Palermo, or Aeropuerto).'
            : 'No encontre esa sede. Pasame la sede exacta (Centro, Palermo o Aeropuerto).'
    }
    if (reason === 'room_not_found') {
        return params.language === 'en'
            ? 'I could not find that room type in this location. I can show available room types if you want.'
            : 'No encontre ese tipo de habitacion en esa sede. Si queres, te muestro las opciones disponibles.'
    }
    if (reason === 'capacity_exceeded') {
        return params.language === 'en'
            ? `That room does not fit the full group. Max capacity is ${params.maxGuests || 0} guests.`
            : `Esa habitacion no alcanza para todo el grupo. La capacidad maxima es ${params.maxGuests || 0} personas.`
    }
    if (reason === 'invalid_payment_method') {
        return params.language === 'en'
            ? 'That payment method is not available. You can use card, transfer, cash, payment link, or Mercado Pago.'
            : 'Ese metodo de pago no esta disponible. Podes usar tarjeta, transferencia, efectivo, link o Mercado Pago.'
    }
    if (reason === 'min_nights') {
        return params.language === 'en'
            ? `For those dates, the minimum stay is ${params.minNights || 0} nights.`
            : `Para esas fechas, la estadia minima es de ${params.minNights || 0} noches.`
    }
    if (reason === 'cancellation_locked') {
        const note = params.policyNote ? ` ${params.policyNote}` : ''
        return params.language === 'en'
            ? `This booking cannot be cancelled inside ${params.lockDays || 0} days. I can convert it to a credit.${note}`
            : `Esta reserva no se puede cancelar dentro de ${params.lockDays || 0} dias. Si queres, la convierto a credito.${note}`
    }
    if (reason === 'blocked') {
        return params.language === 'en'
            ? 'Those dates are blocked by a special event policy.'
            : 'Esas fechas estan bloqueadas por una politica de evento especial.'
    }
    if (reason === 'sold_out' || reason === 'missing_dates') {
        return buildNoAvailabilityAnswer(params.language)
    }
    if (reason === 'missing_reservation_id') {
        return params.language === 'en' ? 'I still need the reservation ID to continue.' : 'Todavia necesito el ID de reserva para continuar.'
    }
    if (reason === 'reservation_not_found') {
        return params.language === 'en'
            ? 'I could not find that reservation. Check the ID or share the booking email.'
            : 'No encontre esa reserva. Revisa el ID o compartime el email de la reserva.'
    }
    if (reason === 'reservation_ambiguous') {
        return params.language === 'en'
            ? 'I found multiple reservations for that email. Share the reservation ID to avoid mistakes.'
            : 'Encontre varias reservas con ese email. Pasame el ID de reserva para evitar errores.'
    }
    if (reason === 'missing_reservation_lookup') {
        return params.language === 'en'
            ? 'Share reservation ID or booking email so I can continue.'
            : 'Pasame ID de reserva o email de la reserva para continuar.'
    }
    if (reason === 'invalid_date') {
        return params.language === 'en'
            ? 'Those dates are invalid. Share check-in and check-out in YYYY-MM-DD format.'
            : 'Esas fechas son invalidas. Pasame check-in y check-out en formato YYYY-MM-DD.'
    }
    return params.language === 'en'
        ? 'I could not complete that action with the current details.'
        : 'No pude completar esa accion con los datos actuales.'
}

const validatePaymentMethod = (method?: string) => {
    if (!method) return { ok: false, normalized: '' }
    const normalized = normalizeText(method)
    const allowed = ['tarjeta', 'credito', 'debito', 'transferencia', 'efectivo', 'link', 'mercadopago']
    const ok = allowed.some((entry) => normalized.includes(entry))
    return { ok, normalized }
}

const updateAvailabilityCounts = async (params: { sede: string; tipo: string; dates: string[]; delta: number }) => {
    const db = await getManualAgentsDb()
    const { hotelAvailability } = collectionNames
    ensureToolAccess('write', [hotelAvailability])
    const collection = db.collection<HotelAvailabilityDoc>(hotelAvailability)

    let updated = 0
    for (const fecha of params.dates) {
        const result = await collection.updateOne(
            { agentId: HOTEL_AGENT_ID, sede: params.sede, tipo: params.tipo, fecha },
            { $inc: { cupo: params.delta }, $set: { updatedAt: new Date() } }
        )
        if (result.modifiedCount) updated += result.modifiedCount
    }
    return updated
}

const resolveStayDates = (start: string, end?: string) => {
    const startDate = parseDate(start)
    const endDate = parseDate(end || start)
    if (!startDate.isValid() || !endDate.isValid()) {
        return null
    }
    if (!end || endDate.isSameOrBefore(startDate, 'day')) {
        endDate.add(1, 'day')
    }
    return { startDate, endDate }
}

const findRoomType = (hotel: HotelInventoryDoc, roomType: string) => {
    const normalized = normalizeText(roomType)
    return (hotel.habitaciones || []).find((room) => normalizeText(String(room.tipo || '')) === normalized) || null
}

const listHotels = async (query?: string) => {
    const hotels = await getHotelInventory()
    const list = query ? findHotelByQuery(hotels, query) : hotels
    return list.map((hotel) => ({
        hotelId: hotel.hotelId,
        nombre: hotel.nombre,
        sede: hotel.sede,
        ubicacion: hotel.ubicacion,
        availabilitySede: hotel.availabilitySede || hotel.sede,
        tipos: (hotel.habitaciones || []).map((room) => room.tipo).filter(Boolean)
    }))
}

const listRoomTypes = async (params: { sede?: string; hotelId?: string }) => {
    const hotels = await getHotelInventory()
    const target = params.hotelId ? findHotelByQuery(hotels, params.hotelId) : params.sede ? findHotelByQuery(hotels, params.sede) : hotels
    const hotel = target[0]
    if (!hotel) return []
    return (hotel.habitaciones || []).map((room) => ({
        hotelId: hotel.hotelId,
        hotelName: hotel.nombre,
        sede: hotel.sede,
        tipo: room.tipo,
        capacidad: room.capacidad,
        tarifaBase: room.tarifaBase,
        moneda: room.moneda,
        amenities: room.amenities,
        refundable: room.refundable ?? true,
        petFriendly: room.petFriendly ?? false,
        incluyeDesayuno: room.incluyeDesayuno ?? false,
        notas: room.notas || ''
    }))
}

const getHotelInfo = async (params: { hotelId?: string; sede?: string }) => {
    const infoDocs = await getHotelInfoDocs()
    const query = params.hotelId || params.sede || ''
    if (!query) return infoDocs
    const normalized = normalizeText(query)
    return infoDocs.filter((hotel) => {
        const hotelId = normalizeText(String(hotel.hotelId || ''))
        const sede = normalizeText(String(hotel.sede || ''))
        const nombre = normalizeText(String(hotel.nombre || ''))
        return hotelId.includes(normalized) || sede.includes(normalized) || nombre.includes(normalized)
    })
}

const listHotelServices = async (params: { sede?: string; categoria?: string; kind?: string }) => {
    const services = await getHotelServices()
    const normalizedSede = params.sede ? normalizeText(params.sede) : ''
    const normalizedCategory = params.categoria ? normalizeText(params.categoria) : ''
    const normalizedKind = params.kind ? normalizeText(params.kind) : ''

    return services.filter((service) => {
        if (normalizedKind && normalizeText(String(service.kind || '')) !== normalizedKind) return false
        if (normalizedCategory && normalizeText(String(service.categoria || '')) !== normalizedCategory) return false
        if (normalizedSede && service.sedes?.length) {
            return service.sedes.some((sede) => normalizeText(sede) === normalizedSede)
        }
        return true
    })
}

const getGuestProfile = async (params: { email?: string; guestId?: string }) => {
    const profiles = await getHotelGuestProfiles()
    if (params.guestId) {
        return profiles.find((profile) => profile.guestId === params.guestId) || null
    }
    if (params.email) {
        return profiles.find((profile) => profile.email === params.email) || null
    }
    return null
}

const getSupportByTopic = async (topic: string) => {
    const support = await getHotelSupport()
    const normalized = normalizeText(topic)
    const protocols = (support.protocolos || []).filter((protocol: Record<string, unknown>) => {
        return normalizeText(String((protocol as { tema?: string }).tema || '')).includes(normalized)
    })
    return {
        protocolos: protocols,
        manuales: support.manuales || []
    }
}

const findAlternativeOptions = async (params: {
    hotels: HotelInventoryDoc[]
    dates: string[]
    start: moment.Moment
    end: moment.Moment
    guests?: number
    roomType?: string
    excludeHotelIds?: string[]
}) => {
    const alternatives: Array<Record<string, unknown>> = []
    for (const hotel of params.hotels) {
        if (params.excludeHotelIds?.includes(String(hotel.hotelId || ''))) continue
        const availabilitySede = hotel.availabilitySede || hotel.sede || ''
        if (!availabilitySede) continue
        const rooms = params.roomType
            ? (hotel.habitaciones || []).filter((room) => normalizeText(String(room.tipo || '')) === normalizeText(params.roomType || ''))
            : hotel.habitaciones || []
        for (const room of rooms) {
            const capacity = Number(room.capacidad || 0)
            if (params.guests && capacity > 0 && params.guests > capacity) {
                continue
            }
            const docs = await getHotelAvailabilityDocs({
                sede: availabilitySede,
                tipo: String(room.tipo || ''),
                fechas: params.dates
            })
            const status = buildAvailabilityStatus(params.dates, docs)
            if (!status.ok) continue
            alternatives.push({
                hotelId: hotel.hotelId,
                hotelName: hotel.nombre,
                sede: hotel.sede,
                roomType: room.tipo
            })
            if (alternatives.length >= 3) return alternatives
        }
    }
    return alternatives
}

const checkAvailability = async (input: {
    start: string
    end?: string
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
}) => {
    const stay = resolveStayDates(input.start, input.end)
    if (!stay) {
        return { ok: false, reason: 'invalid_date' }
    }

    const { startDate, endDate } = stay
    const nights = endDate.diff(startDate, 'days')
    const dates = buildDateRange(startDate, endDate)
    const rules = await getHotelRules()
    const promos = await getHotelPromos()
    const minRule = findMinNightsRule(rules, startDate, endDate)
    const minNights = minRule?.minNoches || 1
    const minOk = nights >= minNights

    const hotels = await getHotelInventory()
    const selected = input.hotelId ? findHotelByQuery(hotels, input.hotelId) : input.sede ? findHotelByQuery(hotels, input.sede) : hotels

    if (!selected.length) {
        return { ok: false, reason: 'hotel_not_found' }
    }

    const available: Array<Record<string, unknown>> = []
    const unavailable: Array<Record<string, unknown>> = []

    for (const hotel of selected) {
        const availabilitySede = hotel.availabilitySede || hotel.sede || ''
        if (!availabilitySede) continue
        const blocked = isBlockedByRule(rules, hotel.sede || availabilitySede, dates)
        const rooms = input.roomType
            ? (hotel.habitaciones || []).filter((room) => normalizeText(String(room.tipo || '')) === normalizeText(input.roomType || ''))
            : hotel.habitaciones || []

        for (const room of rooms) {
            const capacity = Number(room.capacidad || 0)
            if (input.guests && capacity > 0 && input.guests > capacity) {
                unavailable.push({
                    hotelId: hotel.hotelId,
                    hotelName: hotel.nombre,
                    sede: hotel.sede,
                    roomType: room.tipo,
                    reason: 'capacity'
                })
                continue
            }

            if (blocked) {
                unavailable.push({
                    hotelId: hotel.hotelId,
                    hotelName: hotel.nombre,
                    sede: hotel.sede,
                    roomType: room.tipo,
                    reason: 'blocked',
                    blockedDate: blocked.fecha,
                    blockedNote: blocked.nota || blocked.motivo || ''
                })
                continue
            }

            if (!minOk) {
                unavailable.push({
                    hotelId: hotel.hotelId,
                    hotelName: hotel.nombre,
                    sede: hotel.sede,
                    roomType: room.tipo,
                    reason: 'min_nights',
                    minNights
                })
                continue
            }

            const docs = await getHotelAvailabilityDocs({
                sede: availabilitySede,
                tipo: String(room.tipo || ''),
                fechas: dates
            })
            const status = buildAvailabilityStatus(dates, docs)
            if (!status.ok) {
                unavailable.push({
                    hotelId: hotel.hotelId,
                    hotelName: hotel.nombre,
                    sede: hotel.sede,
                    roomType: room.tipo,
                    reason: status.reason,
                    missingDates: status.missingDates || []
                })
                continue
            }

            available.push({
                hotelId: hotel.hotelId,
                hotelName: hotel.nombre,
                sede: hotel.sede,
                roomType: room.tipo,
                capacity: room.capacidad,
                baseRate: room.tarifaBase,
                currency: room.moneda,
                refundable: room.refundable ?? true,
                breakfastIncluded: room.incluyeDesayuno ?? false,
                minNights,
                estimatedTotal: calculateTotal({
                    room,
                    nights,
                    rules,
                    extras: {},
                    promos,
                    sede: hotel.sede || '',
                    roomType: String(room.tipo || ''),
                    rateType: room.refundable === false ? 'no_reembolsable' : 'refundable',
                    start: startDate,
                    end: endDate
                }).total
            })
        }
    }

    if (!available.length) {
        const reasonCounts = unavailable.reduce<Record<string, number>>((acc, item) => {
            const reason = String(item.reason || 'unknown')
            acc[reason] = (acc[reason] || 0) + 1
            return acc
        }, {})
        console.info('[manual-agents] hotel availability empty', {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD'),
            sede: input.sede,
            hotelId: input.hotelId,
            roomType: input.roomType,
            guests: input.guests,
            minNights,
            reasons: reasonCounts
        })
    }

    const alternatives =
        available.length === 0
            ? await findAlternativeOptions({
                  hotels,
                  dates,
                  start: startDate,
                  end: endDate,
                  guests: input.guests,
                  roomType: input.roomType,
                  excludeHotelIds: selected.map((hotel) => String(hotel.hotelId || ''))
              })
            : []

    const suggestedRanges =
        !minOk && minRule?.minNoches
            ? [
                  {
                      start: startDate
                          .clone()
                          .subtract(minRule.minNoches - nights, 'day')
                          .format('YYYY-MM-DD'),
                      end: endDate.format('YYYY-MM-DD')
                  },
                  {
                      start: startDate.format('YYYY-MM-DD'),
                      end: endDate
                          .clone()
                          .add(minRule.minNoches - nights, 'day')
                          .format('YYYY-MM-DD')
                  }
              ]
            : []

    return {
        ok: true,
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        nights,
        minNights,
        minRule,
        available,
        unavailable,
        suggestedRanges,
        alternatives
    }
}

const findNearbyAvailability = async (params: {
    start: string
    nights: number
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
    maxOffsetDays?: number
}) => {
    const startDate = parseDate(params.start)
    if (!startDate.isValid() || params.nights < 1) return null
    const maxOffset = params.maxOffsetDays ?? 10
    const today = moment().startOf('day')

    for (let offset = 1; offset <= maxOffset; offset += 1) {
        const candidates = [startDate.clone().subtract(offset, 'day'), startDate.clone().add(offset, 'day')]
        for (const candidateStart of candidates) {
            if (candidateStart.isBefore(today, 'day')) continue
            const candidateEnd = candidateStart.clone().add(params.nights, 'day')
            const availability = await checkAvailability({
                start: candidateStart.format('YYYY-MM-DD'),
                end: candidateEnd.format('YYYY-MM-DD'),
                sede: params.sede,
                hotelId: params.hotelId,
                roomType: params.roomType,
                guests: params.guests
            })
            const okAvailability = availability as { available?: Array<Record<string, unknown>> }
            if (availability.ok && (okAvailability.available || []).length) {
                return { start: candidateStart, end: candidateEnd, option: okAvailability.available?.[0] }
            }
        }
    }
    return null
}

const buildNearbyAvailabilitySuggestion = async (params: {
    start: string
    nights?: number
    language: 'es' | 'en'
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
}) => {
    if (!params.nights) return null
    const suggestion = await findNearbyAvailability({
        start: params.start,
        nights: params.nights,
        sede: params.sede,
        hotelId: params.hotelId,
        roomType: params.roomType,
        guests: params.guests
    })
    if (!suggestion) return null

    const rangeLabel = formatSuggestedRange(suggestion.start, suggestion.end, params.language)
    const nightsLabel = params.language === 'en' ? `${params.nights} nights` : `${params.nights} noches`
    const option = suggestion.option as { hotelName?: string; sede?: string; roomType?: string } | undefined
    const place = option?.hotelName || option?.sede
    const room = option?.roomType
    const placeLabel = place
        ? params.language === 'en'
            ? ` at ${place}${room ? ` (${room})` : ''}`
            : ` en ${place}${room ? ` (${room})` : ''}`
        : ''

    return params.language === 'en'
        ? `For ${nightsLabel}, I have availability ${rangeLabel}${placeLabel}. Interested?`
        : `Para ${nightsLabel}, tengo disponibilidad ${rangeLabel}${placeLabel}. Te interesa?`
}

const createReservation = async (input: {
    name?: string
    email?: string
    start: string
    end: string
    sede?: string
    hotelId?: string
    roomType?: string
    guests?: number
    rateType?: string
    paymentMethod?: string
    preferences?: string
    earlyCheckin?: boolean
    lateCheckout?: boolean
}) => {
    const stay = resolveStayDates(input.start, input.end)
    if (!stay) {
        return { ok: false, reason: 'invalid_date' }
    }
    if (!input.name || !input.email) {
        return { ok: false, reason: 'missing_guest' }
    }
    if (!input.roomType) {
        return { ok: false, reason: 'missing_room_type' }
    }
    if (typeof input.guests !== 'number' || input.guests <= 0) {
        return { ok: false, reason: 'missing_guests' }
    }

    const hotels = await getHotelInventory()
    const selected = input.hotelId ? findHotelByQuery(hotels, input.hotelId) : input.sede ? findHotelByQuery(hotels, input.sede) : []
    const hotel = selected[0]
    if (!hotel) {
        return { ok: false, reason: 'hotel_not_found' }
    }

    const room = findRoomType(hotel, input.roomType)
    if (!room) {
        return { ok: false, reason: 'room_not_found' }
    }
    if (input.guests && room.capacidad && input.guests > room.capacidad) {
        return { ok: false, reason: 'capacity_exceeded', maxGuests: room.capacidad }
    }

    const { startDate, endDate } = stay
    const nights = endDate.diff(startDate, 'days')
    const rules = await getHotelRules()
    const minRule = findMinNightsRule(rules, startDate, endDate)
    if (minRule && nights < (minRule.minNoches || 0)) {
        return { ok: false, reason: 'min_nights', minNights: minRule.minNoches || 0, minRule }
    }

    const availabilitySede = hotel.availabilitySede || hotel.sede || ''
    const dates = buildDateRange(startDate, endDate)
    const blocked = isBlockedByRule(rules, hotel.sede || availabilitySede, dates)
    if (blocked) {
        return { ok: false, reason: 'blocked', blockedDate: blocked.fecha, blockedNote: blocked.nota || blocked.motivo || '' }
    }

    const docs = await getHotelAvailabilityDocs({
        sede: availabilitySede,
        tipo: String(room.tipo || ''),
        fechas: dates
    })
    const status = buildAvailabilityStatus(dates, docs)
    if (!status.ok) {
        return { ok: false, reason: status.reason, missingDates: status.missingDates || [] }
    }

    const paymentCheck = validatePaymentMethod(input.paymentMethod)
    if (!paymentCheck.ok) {
        return { ok: false, reason: 'invalid_payment_method' }
    }

    const rateType = input.rateType || (room.refundable === false ? 'no_reembolsable' : 'refundable')
    const guestProfile = await getGuestProfile({ email: input.email })
    const preferences = input.preferences || guestProfile?.preferencias?.join(', ') || ''
    const promos = await getHotelPromos()
    const total = calculateTotal({
        room,
        nights,
        rules,
        extras: { earlyCheckin: input.earlyCheckin, lateCheckout: input.lateCheckout },
        promos,
        sede: hotel.sede || input.sede || '',
        roomType: String(room.tipo || ''),
        rateType,
        start: startDate,
        end: endDate
    })

    const reservationId = `GRS-${startDate.format('YYYYMMDD')}-${nanoid(5).toUpperCase()}`
    const reservation: HotelReservationDoc = {
        agentId: HOTEL_AGENT_ID,
        id: reservationId,
        sede: hotel.sede || input.sede,
        checkIn: startDate.format('YYYY-MM-DD'),
        checkOut: endDate.format('YYYY-MM-DD'),
        noches: nights,
        habitacionTipo: room.tipo,
        tarifaTipo: rateType,
        huespedes: input.guests,
        precioTotal: total.total,
        moneda: total.currency,
        email: input.email,
        nombre: input.name,
        metodoPago: input.paymentMethod,
        preferencias: preferences,
        notas: room.notas || '',
        earlyCheckin: input.earlyCheckin || false,
        lateCheckout: input.lateCheckout || false,
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date()
    }

    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('write', [hotelReservations])
    await db.collection<HotelReservationDoc>(hotelReservations).insertOne(reservation)

    await updateAvailabilityCounts({ sede: availabilitySede, tipo: String(room.tipo || ''), dates, delta: -1 })
    const info = await getHotelInfo({ hotelId: hotel.hotelId || hotel.sede })
    const confirmation = buildConfirmation(reservation, info[0] || null)

    return {
        ok: true,
        reservation: {
            id: reservationId,
            sede: reservation.sede,
            hotelName: hotel.nombre,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
            noches: reservation.noches,
            habitacionTipo: reservation.habitacionTipo,
            tarifaTipo: reservation.tarifaTipo,
            huespedes: reservation.huespedes,
            precioTotal: reservation.precioTotal,
            moneda: reservation.moneda,
            status: reservation.status
        },
        confirmation,
        fees: total.fees || [],
        promos: total.appliedPromos?.map((promo) => ({
            id: promo.promoId,
            nombre: promo.nombre,
            descuentoPct: promo.descuentoPct || 0,
            ajustePct: promo.ajustePct || 0,
            nota: promo.nota || ''
        }))
    }
}

const updateReservation = async (input: {
    reservationId?: string
    checkIn?: string
    checkOut?: string
    roomType?: string
    guests?: number
    rateType?: string
    paymentMethod?: string
    preferences?: string
    earlyCheckin?: boolean
    lateCheckout?: boolean
}) => {
    if (!input.reservationId) {
        return { ok: false, reason: 'missing_reservation_id' }
    }

    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('write', [hotelReservations])
    const reservations = db.collection<HotelReservationDoc>(hotelReservations)
    const existing = await reservations.findOne({ agentId: HOTEL_AGENT_ID, id: input.reservationId })
    if (!existing) {
        return { ok: false, reason: 'reservation_not_found' }
    }

    const rules = await getHotelRules()
    const today = moment().startOf('day')
    const checkInDate = parseDate(existing.checkIn || '')
    if (!checkInDate.isValid()) {
        return { ok: false, reason: 'invalid_date' }
    }

    const daysUntil = checkInDate.diff(today, 'days')
    const rateType = input.rateType || existing.tarifaTipo || 'refundable'
    const policy = findPolicyRule(rules.cambios, rateType, daysUntil)
    if (policy && (policy.penalidadPorc || 0) >= 100 && normalizeText(rateType) !== 'refundable') {
        return { ok: false, reason: 'change_not_allowed', policy }
    }

    const updatedCheckIn = input.checkIn || existing.checkIn || ''
    const updatedCheckOut = input.checkOut || existing.checkOut || ''
    const stay = resolveStayDates(updatedCheckIn, updatedCheckOut)
    if (!stay) {
        return { ok: false, reason: 'invalid_date' }
    }

    const hotels = await getHotelInventory()
    const hotelMatch = existing.sede ? findHotelByQuery(hotels, existing.sede) : []
    const hotel = hotelMatch[0]
    if (!hotel) {
        return { ok: false, reason: 'hotel_not_found' }
    }

    const roomType = input.roomType || existing.habitacionTipo || ''
    const room = findRoomType(hotel, roomType)
    if (!room) {
        return { ok: false, reason: 'room_not_found' }
    }
    const nextGuests = input.guests ?? existing.huespedes
    if (typeof nextGuests === 'number' && room.capacidad && nextGuests > room.capacidad) {
        return { ok: false, reason: 'capacity_exceeded', maxGuests: room.capacidad }
    }

    const { startDate, endDate } = stay
    const nights = endDate.diff(startDate, 'days')
    const minRule = findMinNightsRule(rules, startDate, endDate)
    if (minRule && nights < (minRule.minNoches || 0)) {
        return { ok: false, reason: 'min_nights', minNights: minRule.minNoches || 0, minRule }
    }

    const availabilitySede = hotel.availabilitySede || hotel.sede || ''
    const newDates = buildDateRange(startDate, endDate)
    const blocked = isBlockedByRule(rules, hotel.sede || availabilitySede, newDates)
    if (blocked) {
        return { ok: false, reason: 'blocked', blockedDate: blocked.fecha, blockedNote: blocked.nota || blocked.motivo || '' }
    }

    const docs = await getHotelAvailabilityDocs({
        sede: availabilitySede,
        tipo: String(room.tipo || ''),
        fechas: newDates
    })
    const availability = buildAvailabilityStatus(newDates, docs)
    if (!availability.ok) {
        return { ok: false, reason: availability.reason, missingDates: availability.missingDates || [] }
    }

    const promos = await getHotelPromos()
    const price = calculateTotal({
        room,
        nights,
        rules,
        extras: {
            earlyCheckin: input.earlyCheckin ?? existing.earlyCheckin,
            lateCheckout: input.lateCheckout ?? existing.lateCheckout
        },
        promos,
        sede: hotel.sede || '',
        roomType: String(room.tipo || ''),
        rateType,
        start: startDate,
        end: endDate
    })

    const penaltyPct = policy?.penalidadPorc || 0
    const penaltyAmount = price.total * (penaltyPct / 100)
    const totalWithPenalty = price.total + penaltyAmount

    const updatedReservation: Partial<HotelReservationDoc> = {
        checkIn: startDate.format('YYYY-MM-DD'),
        checkOut: endDate.format('YYYY-MM-DD'),
        noches: nights,
        habitacionTipo: room.tipo,
        tarifaTipo: rateType,
        huespedes: nextGuests,
        precioTotal: totalWithPenalty,
        moneda: price.currency,
        metodoPago: input.paymentMethod ?? existing.metodoPago,
        preferencias: input.preferences ?? existing.preferencias,
        earlyCheckin: input.earlyCheckin ?? existing.earlyCheckin,
        lateCheckout: input.lateCheckout ?? existing.lateCheckout,
        updatedAt: new Date()
    }

    await reservations.updateOne(
        { agentId: HOTEL_AGENT_ID, id: input.reservationId },
        {
            $set: updatedReservation,
            $push: {
                cambios: {
                    at: new Date(),
                    previous: {
                        checkIn: existing.checkIn,
                        checkOut: existing.checkOut,
                        habitacionTipo: existing.habitacionTipo,
                        huespedes: existing.huespedes
                    },
                    next: {
                        checkIn: updatedReservation.checkIn,
                        checkOut: updatedReservation.checkOut,
                        habitacionTipo: updatedReservation.habitacionTipo,
                        huespedes: updatedReservation.huespedes
                    },
                    penalidadPct: penaltyPct,
                    penalidadMonto: penaltyAmount
                }
            }
        }
    )

    if (existing.checkIn && existing.checkOut && existing.habitacionTipo) {
        const existingStay = resolveStayDates(existing.checkIn, existing.checkOut)
        if (existingStay) {
            const oldDates = buildDateRange(existingStay.startDate, existingStay.endDate)
            await updateAvailabilityCounts({
                sede: availabilitySede,
                tipo: String(existing.habitacionTipo),
                dates: oldDates,
                delta: 1
            })
        }
    }

    await updateAvailabilityCounts({
        sede: availabilitySede,
        tipo: String(room.tipo || ''),
        dates: newDates,
        delta: -1
    })

    return {
        ok: true,
        reservation: {
            id: existing.id,
            sede: hotel.sede,
            hotelName: hotel.nombre,
            checkIn: updatedReservation.checkIn,
            checkOut: updatedReservation.checkOut,
            noches: updatedReservation.noches,
            habitacionTipo: updatedReservation.habitacionTipo,
            tarifaTipo: updatedReservation.tarifaTipo,
            huespedes: updatedReservation.huespedes,
            precioTotal: updatedReservation.precioTotal,
            moneda: updatedReservation.moneda,
            status: existing.status || 'confirmed'
        },
        penalty: {
            percent: penaltyPct,
            amount: penaltyAmount,
            currency: price.currency,
            note: policy?.nota || ''
        },
        promos: price.appliedPromos?.map((promo) => ({
            id: promo.promoId,
            nombre: promo.nombre,
            descuentoPct: promo.descuentoPct || 0,
            ajustePct: promo.ajustePct || 0,
            nota: promo.nota || ''
        }))
    }
}

const cancelReservation = async (input: { reservationId?: string; email?: string; reason?: string; convertToCredit?: boolean }) => {
    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('write', [hotelReservations])
    const reservations = db.collection<HotelReservationDoc>(hotelReservations)
    if (!input.reservationId && !input.email) {
        return { ok: false, reason: 'missing_reservation_lookup' }
    }

    let existing: HotelReservationDoc | null = null
    if (input.reservationId) {
        existing = await reservations.findOne({ agentId: HOTEL_AGENT_ID, id: input.reservationId })
    } else if (input.email) {
        const byEmail = await reservations.find({ agentId: HOTEL_AGENT_ID, email: input.email }).sort({ createdAt: -1 }).limit(5).toArray()
        const active = byEmail.filter((reservation) => {
            const status = normalizeText(String(reservation.status || ''))
            return status !== 'cancelled' && status !== 'credit_issued'
        })
        if (active.length > 1) {
            return {
                ok: false,
                reason: 'reservation_ambiguous',
                reservations: active.map((reservation) => reservation.id).filter(Boolean)
            }
        }
        existing = active[0] || byEmail[0] || null
    }

    if (!existing) {
        return { ok: false, reason: 'reservation_not_found' }
    }
    const targetReservationId = String(existing.id || input.reservationId || '')
    if (!targetReservationId) {
        return { ok: false, reason: 'reservation_not_found' }
    }

    const rules = await getHotelRules()
    const today = moment().startOf('day')
    const checkInDate = parseDate(existing.checkIn || '')
    if (!checkInDate.isValid()) {
        return { ok: false, reason: 'invalid_date' }
    }

    const daysUntil = checkInDate.diff(today, 'days')
    const rateType = existing.tarifaTipo || 'refundable'
    const policy = findPolicyRule(rules.cancelacion, rateType, daysUntil)
    const penaltyPct = policy?.penalidadPorc || 0
    const penaltyAmount = (existing.precioTotal || 0) * (penaltyPct / 100)
    const normalizedRate = normalizeText(rateType)
    const wantsCredit =
        Boolean(input.convertToCredit) ||
        normalizeText(String(input.reason || '')).includes('credito') ||
        normalizeText(String(input.reason || '')).includes('credit')
    const isNonRefundable = normalizedRate.includes('no_reembolsable') || normalizedRate.includes('non refundable')
    const lockPolicy = findCancellationLockRule(rules.cancelacion, rateType)
    const hardLockDays = resolveCancellationLockDays(rules.cancelacion, rateType)
    if (hardLockDays > 0 && daysUntil <= hardLockDays && !wantsCredit) {
        return {
            ok: false,
            reason: 'cancellation_locked',
            lockDays: hardLockDays,
            policyNote: lockPolicy?.nota || policy?.nota || '',
            suggestion: 'offer_credit'
        }
    }

    const now = new Date()
    let credit: HotelReservationDoc['credit'] | undefined
    let status = 'cancelled'
    if (wantsCredit) {
        const baseTotal = Number(existing.precioTotal || 0)
        const creditAmount = isNonRefundable ? Number((baseTotal * 0.8).toFixed(2)) : Math.max(Number((baseTotal - penaltyAmount).toFixed(2)), 0)
        credit = {
            amount: creditAmount,
            currency: existing.moneda || 'USD',
            issuedAt: now,
            expiresAt: moment(now).add(365, 'day').toDate(),
            status: 'active',
            note: isNonRefundable
                ? 'Credito comercial mock aplicado sobre tarifa no reembolsable.'
                : 'Credito emitido por cancelacion.'
        }
        status = 'credit_issued'
    }

    await reservations.updateOne(
        { agentId: HOTEL_AGENT_ID, id: targetReservationId },
        {
            $set: {
                status,
                updatedAt: now,
                cancelacion: {
                    motivo: input.reason || 'sin_detalle',
                    penalidadPorc: penaltyPct,
                    penalidadMonto: penaltyAmount,
                    fecha: now
                },
                ...(credit ? { credit } : {})
            }
        }
    )

    const hotels = await getHotelInventory()
    const hotelMatch = existing.sede ? findHotelByQuery(hotels, existing.sede) : []
    const hotel = hotelMatch[0]
    const availabilitySede = hotel?.availabilitySede || hotel?.sede || existing.sede || ''

    if (existing.checkIn && existing.checkOut && existing.habitacionTipo && availabilitySede) {
        const stay = resolveStayDates(existing.checkIn, existing.checkOut)
        if (stay) {
            const dates = buildDateRange(stay.startDate, stay.endDate)
            await updateAvailabilityCounts({
                sede: availabilitySede,
                tipo: String(existing.habitacionTipo),
                dates,
                delta: 1
            })
        }
    }

    return {
        ok: true,
        cancellation: {
            id: targetReservationId,
            status,
            penaltyPct,
            penaltyAmount,
            currency: existing.moneda || 'USD',
            note: policy?.nota || ''
        },
        ...(credit ? { credit } : {})
    }
}

const recordServiceRequest = async (input: { reservationId?: string; requestType?: string; message?: string }) => {
    if (!input.reservationId) {
        return { ok: false, reason: 'missing_reservation_id' }
    }

    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('write', [hotelReservations])
    const reservations = db.collection<HotelReservationDoc>(hotelReservations)
    const update = await reservations.updateOne(
        { agentId: HOTEL_AGENT_ID, id: input.reservationId },
        {
            $push: {
                serviceRequests: {
                    type: input.requestType || 'general',
                    message: input.message || '',
                    createdAt: new Date()
                }
            },
            $set: { updatedAt: new Date() }
        }
    )
    if (!update.matchedCount) {
        return { ok: false, reason: 'reservation_not_found' }
    }

    return { ok: true }
}

const getReservation = async (input: { id?: string; email?: string }) => {
    const collection = await getHotelReservationsCollection()
    if (input.id) {
        const reservation = await collection.findOne({ agentId: HOTEL_AGENT_ID, id: input.id })
        return { ok: true, reservation }
    }
    if (input.email) {
        const list = await collection.find({ agentId: HOTEL_AGENT_ID, email: input.email }).sort({ createdAt: -1 }).limit(5).toArray()
        return { ok: true, reservations: list }
    }
    return { ok: false, reason: 'missing_lookup' }
}

const generateVoucher = async (reservationId: string) => {
    const collection = await getHotelReservationsCollection()
    const reservation = await collection.findOne({ agentId: HOTEL_AGENT_ID, id: reservationId })
    if (!reservation) {
        return { ok: false, reason: 'reservation_not_found' }
    }
    const voucherId = `VCH-${reservationId}`
    return {
        ok: true,
        voucher: {
            voucherId,
            reservationId,
            hotel: reservation.sede,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
            nombre: reservation.nombre,
            email: reservation.email,
            issuedAt: new Date().toISOString()
        }
    }
}

const recordPayment = async (input: {
    reservationId: string
    amount?: number
    currency?: string
    method?: string
    paymentRef?: string
}) => {
    const db = await getManualAgentsDb()
    const { hotelReservations } = collectionNames
    ensureToolAccess('write', [hotelReservations])
    const reservations = db.collection<HotelReservationDoc>(hotelReservations)
    const existing = await reservations.findOne({ agentId: HOTEL_AGENT_ID, id: input.reservationId })
    if (!existing) {
        return { ok: false, reason: 'reservation_not_found' }
    }
    await reservations.updateOne(
        { agentId: HOTEL_AGENT_ID, id: input.reservationId },
        {
            $set: { status: 'paid', updatedAt: new Date() },
            $push: {
                pagos: {
                    amount: input.amount ?? existing.precioTotal ?? 0,
                    currency: input.currency || existing.moneda || 'USD',
                    method: input.method || 'tarjeta',
                    paymentRef: input.paymentRef || '',
                    createdAt: new Date()
                }
            }
        }
    )
    return { ok: true, status: 'paid' }
}

const getAvailabilityRange = async (params: { sede?: string; start: string; end: string }) => {
    const db = await getManualAgentsDb()
    const { hotelAvailability } = collectionNames
    ensureToolAccess('read', [hotelAvailability])
    const filter: Record<string, unknown> = {
        agentId: HOTEL_AGENT_ID,
        fecha: { $gte: params.start, $lte: params.end }
    }
    if (params.sede) {
        filter.sede = params.sede
    }
    return db.collection<HotelAvailabilityDoc>(hotelAvailability).find(filter).toArray()
}

const generateReport = async (params: { start: string; end: string; sede?: string }) => {
    const startDate = parseDate(params.start)
    const endDate = parseDate(params.end)
    if (!startDate.isValid() || !endDate.isValid()) {
        return { ok: false, reason: 'invalid_date' }
    }

    const availability = await getAvailabilityRange({ sede: params.sede, start: params.start, end: params.end })
    const maxByGroup = new Map<string, number>()
    for (const row of availability) {
        const key = `${row.sede || 'unknown'}-${row.tipo || 'unknown'}`
        const cupo = Number(row.cupo || 0)
        const currentMax = maxByGroup.get(key) || 0
        if (cupo > currentMax) {
            maxByGroup.set(key, cupo)
        }
    }

    const groupStats = new Map<string, { sumRatio: number; count: number }>()
    for (const row of availability) {
        const key = `${row.sede || 'unknown'}-${row.tipo || 'unknown'}`
        const cupo = Number(row.cupo || 0)
        const maxCupo = maxByGroup.get(key) || 0
        const ratio = maxCupo ? 1 - cupo / maxCupo : 0
        const current = groupStats.get(key) || { sumRatio: 0, count: 0 }
        groupStats.set(key, { sumRatio: current.sumRatio + ratio, count: current.count + 1 })
    }

    const occupancyByGroup = Array.from(groupStats.entries()).map(([key, stats]) => ({
        group: key,
        occupancyPct: stats.count ? Math.round((stats.sumRatio / stats.count) * 100) : 0
    }))
    const avgOccupancy =
        occupancyByGroup.length > 0
            ? Math.round(occupancyByGroup.reduce((sum, item) => sum + item.occupancyPct, 0) / occupancyByGroup.length)
            : 0

    const reservations = await (
        await getHotelReservationsCollection()
    )
        .find({
            agentId: HOTEL_AGENT_ID,
            checkIn: { $gte: params.start, $lte: params.end },
            ...(params.sede ? { sede: params.sede } : {})
        })
        .toArray()
    const cancelled = reservations.filter((res) => res.status === 'cancelled')
    const cancelReasons: Record<string, number> = {}
    for (const res of cancelled) {
        const reason = normalizeText(String(res.cancelacion?.motivo || 'sin_detalle'))
        cancelReasons[reason] = (cancelReasons[reason] || 0) + 1
    }

    const upsellCount = reservations.filter((res) => res.earlyCheckin || res.lateCheckout || (res.serviceRequests || []).length > 0).length

    return {
        ok: true,
        period: { start: params.start, end: params.end },
        occupancyPct: avgOccupancy,
        occupancyByGroup,
        totalReservations: reservations.length,
        cancelledReservations: cancelled.length,
        cancellationReasons: cancelReasons,
        upsellCount
    }
}

const detectLanguage = (message: string) => {
    const text = normalizeText(message)
    const englishHits = [
        'hello',
        'hi',
        'thanks',
        'thank',
        'please',
        'pls',
        'plz',
        'book',
        'booking',
        'reserve',
        'reservation',
        'room',
        'price',
        'rate',
        'quote',
        'avail',
        'availability',
        'check-in',
        'checkin',
        'check-out',
        'checkout',
        'cancel',
        'change',
        'guest'
    ]
    const spanishHits = [
        'hola',
        'gracias',
        'por favor',
        'reserva',
        'reservar',
        'habitacion',
        'precio',
        'tarifa',
        'cotizar',
        'disponible',
        'disponibilidad',
        'check-in',
        'check-out',
        'cancelar',
        'cambiar',
        'desayuno',
        'huesped'
    ]
    const enScore = englishHits.reduce((acc, word) => (text.includes(word) ? acc + 1 : acc), 0)
    const esScore = spanishHits.reduce((acc, word) => (text.includes(word) ? acc + 1 : acc), 0)
    if (enScore === 0 && esScore === 0) return 'es'
    if (enScore === esScore) {
        const strongEnglish = ['pls', 'plz', 'price', 'rate', 'quote', 'availability', 'booking', 'checkin', 'checkout']
        if (strongEnglish.some((word) => text.includes(word))) return 'en'
    }
    return enScore > esScore ? 'en' : 'es'
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
    if (!hasAnyIntentPhrase(message, greetings)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isThanksOnly = (message: string) => {
    const texts = getIntentTexts(message)
    if (!texts.length) return false
    if (isPoliteAckOnly(message)) return false
    const thanks = ['gracias', 'muchas gracias', 'mil gracias', 'thanks', 'thank you', 'thx', 'ty', 'grax', 'grx']
    if (!hasAnyIntentPhrase(message, thanks)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
}

const isDeclineOnly = (message: string) => {
    const declinePhrases = [
        'no gracias',
        'no por ahora',
        'paso por ahora',
        'no me interesa',
        'no quiero reservar',
        'prefiero no',
        'todo bien no',
        'todo bien, no',
        'all good',
        'im good',
        'i am good'
    ]
    if (!hasAnyIntentPhrase(message, declinePhrases)) return false
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
    return !hasDates && !hasDomainKeywords
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
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
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
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasContact = Boolean(extractEmail(message))
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
    const hasRelevant = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
    const hasOffTopic = hasAnyIntentKeyword(message, HOTEL_OFF_TOPIC_KEYWORDS)
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
    const hasDates = extractDates(message).length > 0 || Boolean(parseRelativeDateRange(message)) || Boolean(extractDayRange(message))
    const hasDomainKeywords = hasAnyIntentKeyword(message, HOTEL_DOMAIN_KEYWORDS)
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

const buildHelpAnswer = (language: 'es' | 'en') =>
    language === 'en'
        ? [
              'I can help with hotel bookings.',
              'Share check-in/check-out dates and I can quote options.',
              'I can also handle changes, cancellations, services, and payment details.',
              'This demo uses mock data.'
          ].join(' ')
        : [
              'Te ayudo con reservas de hotel.',
              'Pasame fechas de check-in/check-out y te cotizo opciones.',
              'Tambien puedo gestionar cambios, cancelaciones, servicios y temas de pago.',
              'Esta demo usa datos mock.'
          ].join(' ')

const buildMockScopeAnswer = (language: 'es' | 'en') =>
    language === 'en'
        ? [
              'In this mock demo I can use hotel inventory, availability calendar, commercial rules, and reservations.',
              'I can also read hotel info, services, guest profiles, support protocols, promos, and leads.',
              'If something is outside that data, I will tell you clearly and offer a human handoff.'
          ].join(' ')
        : [
              'En esta demo mock puedo usar inventario, calendario de disponibilidad, reglas comerciales y reservas.',
              'Tambien consulto info del hotel, servicios, perfiles de huesped, protocolos internos, promos y leads.',
              'Si algo queda fuera de esos datos, te lo digo claro y te ofrezco pase a humano.'
          ].join(' ')

const buildUnsupportedMockDataAnswer = (language: 'es' | 'en') =>
    language === 'en'
        ? "I don't have that real-time data in this mock environment. I can help with hotel data from the demo or leave the request ready for a human agent."
        : 'En este entorno mock no tengo ese dato en tiempo real. Te puedo ayudar con los datos hoteleros de la demo o dejar el pedido listo para un humano.'

const formatBulletList = (items: string[]) => items.join('\n\n')

const buildNoAvailabilityAnswer = (language: 'es' | 'en') =>
    language === 'en' ? 'No availability for those dates.' : 'No hay disponibilidad para esas fechas.'

const getSessionMessages = async (sessionId: string) => {
    const db = await getManualAgentsDb()
    const collections = collectionNames
    ensureToolAccess('read', [collections.manualAgentSessions])
    const session = await db
        .collection<{ messages?: Array<{ role: string; content: string; metadata?: Record<string, unknown> }> }>(
            collections.manualAgentSessions
        )
        .findOne({ sessionId, agentId: HOTEL_AGENT_ID }, { projection: { messages: 1 } })
    return session?.messages || []
}

const getSessionLanguage = (messages: Array<{ role?: string; content?: string }>, fallbackMessage: string) => {
    const firstUser = messages.find((msg) => msg?.role === 'user' && msg?.content)
    return detectLanguage(firstUser?.content || fallbackMessage)
}

const buildSystemPrompt = (rules: HotelRulesDoc, hotels: HotelInventoryDoc[], language: 'es' | 'en') => {
    const sedes = Array.from(new Set(hotels.map((hotel) => hotel.sede).filter(Boolean)))
    const todayRef = moment.tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD')
    const checkIn = rules.horarios?.checkin || '15:00'
    const checkOut = rules.horarios?.checkout || '11:00'
    const early = rules.earlyLate?.earlyCheckin
        ? `Early check-in desde ${rules.earlyLate.earlyCheckin.desde || '11:00'} con fee ${rules.earlyLate.earlyCheckin.fee || 0} ${
              rules.earlyLate.earlyCheckin.moneda || 'USD'
          }`
        : 'Early check-in sujeto a disponibilidad'
    const late = rules.earlyLate?.lateCheckout
        ? `Late check-out hasta ${rules.earlyLate.lateCheckout.hasta || '14:00'} con fee ${rules.earlyLate.lateCheckout.fee || 0} ${
              rules.earlyLate.lateCheckout.moneda || 'USD'
          }`
        : 'Late check-out sujeto a disponibilidad'

    const minRules = (rules.minimasNoches || [])
        .slice(0, 3)
        .map((rule) => {
            const range = rule.rango || []
            const label = range[0] && range[1] ? `${range[0]} a ${range[1]}` : 'rango especial'
            return `${label}: minimo ${rule.minNoches || 1} noches`
        })
        .join(' | ')

    const languageLine =
        language === 'en'
            ? 'You are Freia, Hotel Gran Sol assistant. Reply in friendly US English.'
            : 'Sos Freia, asistente del Hotel Gran Sol. Respondes en espanol de Argentina, amable y directo.'

    return [
        languageLine,
        `Referencia temporal: hoy es ${todayRef}.`,
        `Sedes: ${sedes.join(', ') || 'Centro, Palermo, Aeropuerto'}.`,
        `Check-in ${checkIn}. Check-out ${checkOut}.`,
        early,
        late,
        minRules ? `Reglas de estadia minima: ${minRules}.` : '',
        'Gestionas reservas, cambios, cancelaciones, conversiones a credito, leads, vouchers, pagos, recordatorios y pedidos de servicio.',
        language === 'en'
            ? 'If info is missing (dates, location, room type, guest count, name, email, payment method), ask only what is needed.'
            : 'Si faltan datos (fechas, sede, habitacion, cantidad de huespedes, nombre, email, metodo de pago), pregunta solo lo necesario.',
        language === 'en'
            ? 'Stay on hotel topics only. Decline off-topic requests and redirect to reservations or guest support.'
            : 'No te desvias del rol hotelero: rechaza temas fuera de hoteleria (deportes, medicina, finanzas, etc.) y redirigi a reservas o atencion al huesped.',
        language === 'en'
            ? 'Use tools for availability, rules, info, services, profiles, support, promos, and reservations. Do not invent data.'
            : 'Usa herramientas para disponibilidad, reglas, info, servicios, perfiles, soporte, promos y reservas. No inventes datos.',
        language === 'en'
            ? 'This is a mock dataset. If requested data is not available in tools, say it clearly and offer human handoff.'
            : 'Esta es una base mock. Si piden un dato que no esta en herramientas, decilo claramente y ofrece pase a humano.',
        language === 'en'
            ? 'When answering availability, list only available options in bullets. If there is no availability, reply: "No availability for those dates."'
            : 'Cuando respondas disponibilidad, lista solo opciones disponibles en vinetas. Si no hay disponibilidad, responde: "No hay disponibilidad para esas fechas."',
        language === 'en'
            ? 'When you mention date ranges, use check-in/check-out with month names (e.g., check-in Jan 5, 2026, check-out Jan 10, 2026).'
            : 'Cuando menciones rangos de fechas, usa formato check-in/check-out con meses en texto (ej: check-in 5 de enero de 2026, check-out 10 de enero de 2026).',
        language === 'en'
            ? 'If the guest asks for X nights and there is no availability on the requested date, suggest a nearby range with that length.'
            : 'Si el huesped pide X noches/dias y no hay disponibilidad en esa fecha, sugiere un rango cercano con esa duracion.',
        language === 'en'
            ? 'Tone: short, natural, and human. Keep replies to 1-3 short sentences unless listing options.'
            : 'Tono: cercano, natural y humano. Responde en 1-3 frases cortas salvo cuando listes opciones.',
        language === 'en'
            ? 'For policies or payments, give a short summary and offer to share full details.'
            : 'Para politicas o pagos, da un resumen corto y ofrece ampliar el detalle.',
        language === 'en'
            ? 'Use short acknowledgements like "ok" or "got it" when it fits.'
            : 'Usa confirmaciones cortas tipo "dale" u "ok" cuando aplique.',
        language === 'en'
            ? 'When listing items, put one bullet per paragraph (blank line between bullets).'
            : 'Cuando listes items, pone un guion por parrafo (linea en blanco entre guiones).'
    ]
        .filter(Boolean)
        .join('\n')
}

const executeHotelTool = async (name: string, args: Record<string, any>, rules: HotelRulesDoc) => {
    try {
        switch (name) {
            case 'list_hotels': {
                const list = await listHotels(args.query || args.sede || '')
                return { output: list }
            }
            case 'list_room_types': {
                const list = await listRoomTypes({ sede: args.sede, hotelId: args.hotelId })
                return { output: list }
            }
            case 'get_hotel_info': {
                const list = await getHotelInfo({ hotelId: args.hotelId, sede: args.sede })
                return { output: list }
            }
            case 'list_services': {
                const list = await listHotelServices({ sede: args.sede, categoria: args.categoria, kind: args.kind })
                return { output: list }
            }
            case 'get_guest_profile': {
                const profile = await getGuestProfile({ email: args.email, guestId: args.guestId })
                return { output: { ok: true, profile } }
            }
            case 'get_support': {
                const support = await getSupportByTopic(String(args.topic || ''))
                return { output: support }
            }
            case 'get_promos': {
                const promos = await getHotelPromos()
                if (args.start && args.end && (args.sede || args.roomType || args.rateType)) {
                    const start = parseDate(args.start)
                    const end = parseDate(args.end)
                    const filtered =
                        start.isValid() && end.isValid()
                            ? getApplicablePromos(promos, {
                                  sede: String(args.sede || ''),
                                  roomType: String(args.roomType || ''),
                                  rateType: String(args.rateType || 'refundable'),
                                  start,
                                  end
                              })
                            : []
                    return { output: filtered }
                }
                return { output: promos }
            }
            case 'check_availability': {
                const result = await checkAvailability({
                    start: args.start,
                    end: args.end,
                    sede: args.sede,
                    hotelId: args.hotelId,
                    roomType: args.roomType,
                    guests: args.guests
                })
                return { output: result }
            }
            case 'get_rules': {
                return { output: rules }
            }
            case 'get_faq': {
                const faqDoc = await getHotelFaq()
                const faq = faqDoc.faq || []
                if (args.intent) {
                    const match = faq.filter((item) => normalizeText(String(item.intent || '')) === normalizeText(args.intent))
                    return { output: match }
                }
                return { output: faq }
            }
            case 'get_reservation': {
                const result = await getReservation({ id: args.id, email: args.email })
                return { output: result }
            }
            case 'create_reservation': {
                const result = await createReservation({
                    name: args.name,
                    email: args.email,
                    start: args.start,
                    end: args.end,
                    sede: args.sede,
                    hotelId: args.hotelId,
                    roomType: args.roomType,
                    guests: args.guests,
                    rateType: args.rateType,
                    paymentMethod: args.paymentMethod,
                    preferences: args.preferences,
                    earlyCheckin: args.earlyCheckin,
                    lateCheckout: args.lateCheckout
                })
                if (result.ok) {
                    return {
                        output: result,
                        metadata: {
                            type: 'reservationCard',
                            reservation: result.reservation,
                            confirmation: result.confirmation,
                            fees: result.fees,
                            promos: result.promos
                        }
                    }
                }
                return { output: result }
            }
            case 'update_reservation': {
                const result = await updateReservation({
                    reservationId: args.reservationId,
                    checkIn: args.checkIn,
                    checkOut: args.checkOut,
                    roomType: args.roomType,
                    guests: args.guests,
                    rateType: args.rateType,
                    paymentMethod: args.paymentMethod,
                    preferences: args.preferences,
                    earlyCheckin: args.earlyCheckin,
                    lateCheckout: args.lateCheckout
                })
                if (result.ok) {
                    return { output: result, metadata: { type: 'reservationUpdate', reservation: result.reservation } }
                }
                return { output: result }
            }
            case 'cancel_reservation': {
                const result = await cancelReservation({
                    reservationId: args.reservationId,
                    email: args.email,
                    reason: args.reason,
                    convertToCredit: Boolean(args.convertToCredit)
                })
                if (result.ok) {
                    const successful = result as {
                        cancellation?: Record<string, unknown>
                    }
                    return { output: result, metadata: { type: 'reservationCancel', cancellation: successful.cancellation || null } }
                }
                return { output: result }
            }
            case 'convert_reservation_to_credit': {
                const result = await cancelReservation({
                    reservationId: args.reservationId,
                    email: args.email,
                    reason: args.reason || 'credito_por_cancelacion',
                    convertToCredit: true
                })
                if (result.ok) {
                    const successful = result as {
                        cancellation?: Record<string, unknown>
                        credit?: Record<string, unknown>
                    }
                    return {
                        output: result,
                        metadata: { type: 'reservationCredit', cancellation: successful.cancellation || null, credit: successful.credit || null }
                    }
                }
                return { output: result }
            }
            case 'record_service_request': {
                const result = await recordServiceRequest({
                    reservationId: args.reservationId,
                    requestType: args.requestType,
                    message: args.message
                })
                if (result.ok) {
                    if (args.reservationId) {
                        await recordOperationalServiceNotification({
                            reservationId: String(args.reservationId),
                            requestType: String(args.requestType || 'general'),
                            message: String(args.message || ''),
                            source: 'tool_call'
                        })
                    }
                    return { output: result, metadata: { type: 'serviceRequest', reservationId: args.reservationId } }
                }
                return { output: result }
            }
            case 'schedule_reminder': {
                const result = await scheduleHotelReminder({
                    reservationId: args.reservationId,
                    message: args.message,
                    when: args.when,
                    channel: args.channel,
                    serviceType: args.serviceType
                })
                if (result.ok) {
                    return { output: result, metadata: { type: 'serviceReminder', reminder: (result as any).reminder } }
                }
                return { output: result }
            }
            case 'record_lead': {
                const lead = await upsertHotelLead({
                    id: args.id,
                    nombre: args.nombre,
                    email: args.email,
                    telefono: args.telefono,
                    interes: args.interes,
                    origen: args.origen,
                    estado: args.estado,
                    notas: args.notas
                })
                return { output: { ok: true, lead } }
            }
            case 'list_leads': {
                const doc = await getHotelLeadsDoc()
                const leads = (doc?.leads || []) as HotelLeadDoc[]
                const status = args.status ? normalizeText(String(args.status)) : ''
                const filtered = status ? leads.filter((lead) => normalizeText(String(lead.estado || '')) === status) : leads
                return { output: filtered }
            }
            case 'notify_staff': {
                await recordHotelNotification({
                    type: String(args.type || 'general'),
                    payload: {
                        message: args.message || '',
                        reservationId: args.reservationId || '',
                        sede: args.sede || ''
                    }
                })
                return { output: { ok: true } }
            }
            case 'generate_voucher': {
                const result = await generateVoucher(String(args.reservationId || ''))
                if (result.ok) {
                    return { output: result, metadata: { type: 'voucher', voucher: result.voucher } }
                }
                return { output: result }
            }
            case 'record_payment': {
                const result = await recordPayment({
                    reservationId: String(args.reservationId || ''),
                    amount: args.amount,
                    currency: args.currency,
                    method: args.method,
                    paymentRef: args.paymentRef
                })
                return { output: result }
            }
            case 'generate_report': {
                const result = await generateReport({
                    start: String(args.start || ''),
                    end: String(args.end || ''),
                    sede: args.sede
                })
                return { output: result }
            }
            default:
                return { output: { ok: false, error: 'unknown_tool' } }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[manual-agents] hotel tool error', name, message)
        return { output: { ok: false, error: 'tool_error', message } }
    }
}

const runLlmFlow = async (
    message: string,
    sessionId: string,
    rules: HotelRulesDoc,
    hotels: HotelInventoryDoc[],
    language: 'es' | 'en',
    sessionMessages?: Array<{ role: string; content: string }>
) => {
    const apiKey = getManualAgentOpenAIKey()
    if (!apiKey) {
        throw new Error('OpenAI key missing')
    }

    const openai = new OpenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(rules, hotels, language)
    const fallbackAnswer =
        language === 'en' ? 'Sorry, I could not process that.' : 'Perdon, no pude procesar eso.'

    let historySource = sessionMessages
    if (!historySource) {
        const db = await getManualAgentsDb()
        const collections = collectionNames
        ensureToolAccess('read', [collections.manualAgentSessions])
        const session = await db
            .collection<{ messages?: Array<{ role: string; content: string }> }>(collections.manualAgentSessions)
            .findOne({ sessionId, agentId: HOTEL_AGENT_ID })
        historySource = session?.messages || []
    }

    const history = (historySource || [])
        .slice(-8)
        .filter((msg: any) => msg?.role === 'user' || msg?.role === 'assistant')
        .map((msg: any) => ({ role: msg.role, content: msg.content }))

    const messages: any[] = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]

    const tools = HOTEL_TOOL_SPECS.map((tool) => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    })) as OpenAI.ChatCompletionTool[]

    let metadata: Record<string, unknown> | undefined

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
            return {
                answer: (assistant.content || '').trim() || fallbackAnswer,
                metadata
            }
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
            const toolResult = await executeHotelTool(name, args, rules)
            if (sessionId && (name === 'check_availability' || name === 'create_reservation' || name === 'update_reservation')) {
                const contextUpdate: Record<string, unknown> = {}
                const start =
                    typeof args.start === 'string'
                        ? args.start
                        : typeof args.checkIn === 'string'
                        ? args.checkIn
                        : ''
                const end =
                    typeof args.end === 'string'
                        ? args.end
                        : typeof args.checkOut === 'string'
                        ? args.checkOut
                        : ''
                if (start) {
                    contextUpdate.start = start
                }
                if (end || start) {
                    contextUpdate.end = end || start
                }
                if (typeof args.sede === 'string' && args.sede) {
                    contextUpdate.sede = args.sede
                }
                if (typeof args.hotelId === 'string' && args.hotelId) {
                    contextUpdate.hotelId = args.hotelId
                }
                if (typeof args.roomType === 'string' && args.roomType) {
                    contextUpdate.roomType = args.roomType
                }
                if (typeof args.guests === 'number') {
                    contextUpdate.guests = args.guests
                }
                if (typeof args.paymentMethod === 'string' && args.paymentMethod) {
                    contextUpdate.paymentMethod = args.paymentMethod
                }
                if (typeof args.preferences === 'string' && args.preferences) {
                    contextUpdate.preferences = args.preferences
                }
                if (typeof args.earlyCheckin === 'boolean') {
                    contextUpdate.earlyCheckin = args.earlyCheckin
                }
                if (typeof args.lateCheckout === 'boolean') {
                    contextUpdate.lateCheckout = args.lateCheckout
                }
                if (Object.keys(contextUpdate).length) {
                    await updateSessionContext(sessionId, contextUpdate)
                }
            }
            if (toolResult.metadata) {
                metadata = toolResult.metadata
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

const findFaqAnswer = (faq: HotelFaqItem[], message: string) => {
    const text = normalizeText(message)
    const keywordMap: Record<string, string[]> = {
        checkin_checkout: ['checkin', 'check-in', 'checkout', 'check-out', 'horario'],
        desayuno: ['desayuno'],
        gimnasio: ['gimnasio', 'gym'],
        mascotas: ['mascota', 'pet'],
        transporte: ['traslado', 'transporte', 'shuttle', 'aeropuerto'],
        servicios: ['servicios', 'incluye', 'incluido'],
        actividades: ['actividad', 'recomend', 'tour'],
        clima: ['clima', 'tiempo'],
        equipaje: ['equipaje', 'valija', 'maleta'],
        parking: ['parking', 'estacionamiento', 'cochera'],
        room_service: ['room service', 'habitacion', 'comida']
    }

    const intent = Object.keys(keywordMap).find((key) => keywordMap[key].some((word) => text.includes(word)))
    if (!intent) return null

    return faq.find((item) => normalizeText(String(item.intent || '')) === intent)?.respuesta || null
}

const handleHotelFallback = async (input: ManualAgentRequest, language: 'es' | 'en'): Promise<ManualAgentResponse> => {
    const message = input.message || ''
    const lower = normalizeText(message)
    const stayLength = extractStayLengthDetails(message)
    const requestedNights = stayLength?.value

    const [rules, faqDoc, hotels] = await Promise.all([getHotelRules(), getHotelFaq(), getHotelInventory()])
    const selectedHotel = detectHotelSelection(message, hotels)
    const selectedSede =
        selectedHotel?.sede ||
        (typeof input.metadata?.sede === 'string' ? (input.metadata?.sede as string) : '')

    if (isDataScopeQuestion(message)) {
        return { answer: buildMockScopeAnswer(language) }
    }

    if (isUnsupportedMockDataQuestion(message)) {
        return { answer: buildUnsupportedMockDataAnswer(language) }
    }

    if (isSmallTalkOnly(message)) {
        return {
            answer:
                language === 'en'
                    ? "I'm doing great, thanks. If you want, we can continue with your booking details."
                    : 'Todo bien, gracias. Si queres, seguimos con los detalles de tu reserva.'
        }
    }

    const wantsPersonalizedRecommendations =
        lower.includes('recomend') ||
        lower.includes('actividad') ||
        lower.includes('que hacer') ||
        lower.includes('what to do') ||
        (lower.includes('restaurante') && !lower.includes('pedir') && !extractReservationId(message))
    const hasActivitiesIntent =
        hasAnyIntentKeyword(message, ['actividad', 'actividades', 'activities', 'agenda', 'itinerario']) ||
        hasAnyIntentPhrase(message, ['que hacer', 'what to do'])
    const activitiesDate = resolveActivitiesDate(message, language)
    if (hasActivitiesIntent && activitiesDate) {
        const agendaSede = selectedSede || 'Centro'
        const services = await listHotelServices({ sede: agendaSede })
        return {
            answer: buildDailyActivitiesAnswer({
                date: activitiesDate,
                sede: agendaSede,
                language,
                services,
                defaultSedeUsed: !selectedSede
            })
        }
    }
    if (wantsPersonalizedRecommendations) {
        const services = await listHotelServices({ sede: selectedSede || undefined })
        const curated = services
            .filter((service) => {
                const category = normalizeText(String(service.categoria || ''))
                return (
                    category.includes('restaurante') ||
                    category.includes('traslado') ||
                    category.includes('transporte') ||
                    category.includes('spa') ||
                    category.includes('amenity')
                )
            })
            .slice(0, 4)
        const profileEmail = extractEmail(message)
        const profile = profileEmail ? await getGuestProfile({ email: profileEmail }) : null
        const preferences = (profile?.preferencias || []).slice(0, 2).join(', ')
        const recommendationLines = curated.map((service) => {
            const price =
                typeof service.precio === 'number' && Number.isFinite(service.precio)
                    ? `${service.precio} ${service.moneda || 'USD'}`
                    : language === 'en'
                    ? 'price on request'
                    : 'precio a confirmar'
            return `- ${service.nombre || service.categoria || 'servicio'}: ${price}`
        })
        if (recommendationLines.length) {
            const intro =
                language === 'en'
                    ? `Here are recommended options${selectedSede ? ` for ${selectedSede}` : ''}:`
                    : `Aca tenes opciones recomendadas${selectedSede ? ` para ${selectedSede}` : ''}:`
            const preferenceLine = preferences
                ? language === 'en'
                    ? `Based on your profile, I can prioritize: ${preferences}.`
                    : `Si queres, priorizo segun tu perfil: ${preferences}.`
                : ''
            return { answer: [intro, formatBulletList(recommendationLines), preferenceLine].filter(Boolean).join('\n\n') }
        }
    }

    const climateSignal = lower.includes('clima') || lower.includes('weather') || lower.includes('temperatura')
    if (climateSignal) {
        const monthFromText = findMonthInText(message)
        const explicitDates = extractDates(message, { preferMonthFirst: language === 'en' })
        const month = monthFromText?.month || (explicitDates[0]?.month() ?? moment().month()) + 1
        const monthName = moment({ year: 2026, month: month - 1, day: 1 })
            .locale(language === 'en' ? 'en' : 'es')
            .format('MMMM')
        const outlook =
            month === 12 || month <= 2
                ? language === 'en'
                    ? 'warm to hot weather, usually 24-33C'
                    : 'clima calido a caluroso, normalmente entre 24C y 33C'
                : month >= 3 && month <= 5
                ? language === 'en'
                    ? 'mild weather, around 15-25C'
                    : 'clima templado, alrededor de 15C a 25C'
                : month >= 6 && month <= 8
                ? language === 'en'
                    ? 'cool weather, around 7-17C'
                    : 'clima fresco, alrededor de 7C a 17C'
                : language === 'en'
                ? 'mild weather, around 13-24C'
                : 'clima templado, alrededor de 13C a 24C'
        const note = language === 'en' ? 'If you share exact dates, I can tailor suggestions.' : 'Si me pasas fechas exactas, te adapto las recomendaciones.'
        return {
            answer:
                language === 'en'
                    ? `For ${monthName}, expect ${outlook}. ${note}`
                    : `Para ${monthName}, espera ${outlook}. ${note}`
        }
    }

    const faqAnswer = findFaqAnswer(faqDoc.faq || [], message)
    if (faqAnswer) {
        return { answer: faqAnswer }
    }

    if (isRestartRequest(message)) {
        await resetHotelSessionFlow(input.sessionId || '')
        return {
            answer:
                language === 'en'
                    ? 'Done, we can start from scratch. Share check-in/check-out dates and location and I will quote options.'
                    : 'Listo, arrancamos de cero. Pasame fechas de check-in/check-out y sede y te cotizo opciones.'
        }
    }

    if (isHumanHandoffRequest(message)) {
        return {
            answer:
                language === 'en'
                    ? 'Sure, I can hand this over to a human. If you share dates and location, I can leave everything ready.'
                    : 'Claro, te puedo pasar con un humano. Si me compartis fechas y sede, dejo todo listo.'
        }
    }

    if (isHelpOnly(message)) {
        return { answer: buildHelpAnswer(language) }
    }

    if (isThanksOnly(message)) {
        return {
            answer: language === 'en' ? "You're welcome. If you want, I can keep helping with your booking." : 'De nada. Si queres, seguimos con tu reserva.'
        }
    }

    if (isDeclineOnly(message)) {
        return {
            answer: language === 'en' ? "All good. If you want to continue later, I'm here." : 'Todo bien. Si queres retomar despues, estoy aca.'
        }
    }

    if (isGoodbyeOnly(message)) {
        return {
            answer:
                language === 'en'
                    ? 'Perfect, we can pause here. When you want to continue, share dates and I pick it up.'
                    : 'Perfecto, lo dejamos aca. Cuando quieras seguir, pasame fechas y lo retomamos.'
        }
    }

    if (isGreetingOnly(message)) {
        return {
            answer:
                language === 'en'
                    ? 'Hi! I can help with bookings, changes, cancellations, and services. Share dates and I will start.'
                    : 'Hola! Te ayudo con reservas, cambios, cancelaciones y servicios. Pasame fechas y arrancamos.'
        }
    }

    if (isClearlyOffTopic(message)) {
        return {
            answer:
                language === 'en'
                    ? 'I can only help with hotel topics (reservations, changes, cancellations, and guest services). Share dates and I can continue.'
                    : 'Solo puedo ayudar con hoteleria (reservas, cambios, cancelaciones y servicios al huesped). Pasame fechas y seguimos.'
        }
    }

    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch) {
        const profile = await getGuestProfile({ email: emailMatch[0] })
        if (profile) {
            const prefs = profile.preferencias?.join(', ') || 'sin preferencias registradas'
            return {
                answer:
                    language === 'en'
                        ? `Got it, I have your profile. Preferences: ${prefs}. Want me to use them for this booking?`
                        : `Listo, tengo tu perfil. Preferencias: ${prefs}. Queres que las use en la reserva?`
            }
        }
    }

    if (lower.includes('direccion') || lower.includes('ubicacion') || lower.includes('mapa')) {
        const infoDocs = await getHotelInfo({})
        const match = infoDocs.find((hotel) => lower.includes(normalizeText(String(hotel.sede || ''))))
        const info = match || infoDocs[0]
        if (info) {
            return {
                answer:
                    language === 'en'
                        ? `Here you go: ${info.nombre || 'Hotel Gran Sol'}: ${info.ubicacion || ''}. Map: ${info.mapaUrl || ''}`.trim()
                        : `Aca va: ${info.nombre || 'Hotel Gran Sol'}: ${info.ubicacion || ''}. Mapa: ${info.mapaUrl || ''}`.trim()
            }
        }
    }

    if (
        lower.includes('spa') ||
        lower.includes('traslado') ||
        lower.includes('cuna') ||
        lower.includes('amenit') ||
        lower.includes('lavanderia') ||
        lower.includes('room service')
    ) {
        const sedeMatch = hotels.find((hotel) => lower.includes(normalizeText(String(hotel.sede || ''))))
        const services = await listHotelServices({ sede: sedeMatch?.sede })
        const lines = services.slice(0, 4).map((service) => {
            const price = service.precio ? `${service.precio} ${service.moneda || 'USD'}` : 'sin costo'
            return `- ${service.nombre}: ${price}`
        })
        if (lines.length) {
            return {
                answer:
                    language === 'en'
                        ? `Here are the available services:\n${formatBulletList(lines)}`
                        : `Aca tenes servicios disponibles:\n${formatBulletList(lines)}`
            }
        }
    }

    if (lower.includes('protocolo') || lower.includes('manual') || lower.includes('soporte interno')) {
        const support = await getSupportByTopic(message)
        const protocols = (support.protocolos || []).slice(0, 2).map((item: any) => `- ${item.tema || 'protocolo'}`)
        if (protocols.length) {
            return {
                answer:
                    language === 'en'
                        ? `Internal protocols:\n${formatBulletList(protocols)}`
                        : `Protocolos internos:\n${formatBulletList(protocols)}`
            }
        }
    }

    if (
        lower.includes('early check-in') ||
        lower.includes('early check in') ||
        lower.includes('early checkin') ||
        lower.includes('ingreso temprano') ||
        lower.includes('late check-out') ||
        lower.includes('late check out') ||
        lower.includes('late checkout') ||
        lower.includes('salida tarde')
    ) {
        const early = rules.earlyLate?.earlyCheckin
        const late = rules.earlyLate?.lateCheckout
        const earlyLine = early
            ? language === 'en'
                ? `- Early check-in from ${early.desde || '11:00'} with fee ${formatMoney(Number(early.fee || 0), early.moneda || 'USD')}, subject to availability.`
                : `- Early check-in desde ${early.desde || '11:00'} con cargo ${formatMoney(Number(early.fee || 0), early.moneda || 'USD')}, sujeto a disponibilidad.`
            : language === 'en'
            ? '- Early check-in is subject to availability.'
            : '- Early check-in sujeto a disponibilidad.'
        const lateLine = late
            ? language === 'en'
                ? `- Late check-out until ${late.hasta || '14:00'} with fee ${formatMoney(Number(late.fee || 0), late.moneda || 'USD')}, subject to availability.`
                : `- Late check-out hasta ${late.hasta || '14:00'} con cargo ${formatMoney(Number(late.fee || 0), late.moneda || 'USD')}, sujeto a disponibilidad.`
            : language === 'en'
            ? '- Late check-out is subject to availability.'
            : '- Late check-out sujeto a disponibilidad.'
        return {
            answer:
                language === 'en'
                    ? `Here are the policy details:\n${formatBulletList([earlyLine, lateLine])}`
                    : `Aca tenes el detalle de politicas:\n${formatBulletList([earlyLine, lateLine])}`
        }
    }

    if (lower.includes('precio') || lower.includes('tarifa')) {
        const hotel = hotels[0]
        const fromLabel = language === 'en' ? 'from' : 'desde'
        const perNightLabel = language === 'en' ? 'per night' : 'por noche'
        const rooms = (hotel?.habitaciones || []).slice(0, 3).map((room) => {
            const price = room.tarifaBase ? `${fromLabel} ${formatMoney(room.tarifaBase, room.moneda)} ${perNightLabel}` : ''
            const capacity = room.capacidad ? (language === 'en' ? `capacity ${room.capacidad}` : `capacidad ${room.capacidad}`) : ''
            const breakfast = room.incluyeDesayuno ? (language === 'en' ? 'breakfast included' : 'con desayuno') : ''
            const details = [capacity, breakfast].filter(Boolean).join(', ')
            return `- ${room.tipo || (language === 'en' ? 'room' : 'habitacion')}: ${price}${details ? ` - ${details}` : ''}`.trim()
        })
        const budgetLine =
            language === 'en'
                ? 'If you share your per-night budget and guest count, I can narrow it down. Total can vary by dates, taxes, and promos.'
                : 'Si me decis presupuesto por noche y cantidad de personas, lo ajusto. El total puede variar por fechas, impuestos y promos.'
        return {
            answer:
                language === 'en'
                    ? rooms.length
                        ? `Base nightly rates:\n${formatBulletList(rooms)}\n\n${budgetLine}`
                        : 'I can quote if you share dates and location.'
                    : rooms.length
                    ? `Tarifas base por noche:\n${formatBulletList(rooms)}\n\n${budgetLine}`
                    : 'Puedo cotizar si me decis fechas y sede.'
        }
    }

    const dates = extractDates(message, { preferMonthFirst: language === 'en' })
    if (dates.length) {
        const startStr = dates[0].format('YYYY-MM-DD')
        const endStr = dates[1]
            ? dates[1].format('YYYY-MM-DD')
            : requestedNights
            ? dates[0].clone().add(requestedNights, 'day').format('YYYY-MM-DD')
            : dates[0].clone().add(1, 'day').format('YYYY-MM-DD')
        const availability = await checkAvailability({ start: startStr, end: endStr, sede: input.metadata?.sede as string | undefined })
        if (!availability.ok) {
            return {
                answer: buildNoAvailabilityAnswer(language)
            }
        }
        const okAvailability = availability as {
            nights: number
            minNights: number
            suggestedRanges?: Array<{ start: string; end: string }>
            available?: Array<Record<string, unknown>>
            alternatives?: Array<Record<string, unknown>>
        }
        if (okAvailability.nights < okAvailability.minNights) {
            const ranges = (okAvailability.suggestedRanges || []).map((range: any) => `${range.start} a ${range.end}`).filter(Boolean)
            const rangeLines = ranges.map((range) => `- ${range}`)
            return {
                answer:
                    language === 'en'
                        ? `Minimum stay is ${okAvailability.minNights} nights for those dates.${
                              rangeLines.length ? `\n\nOptions:\n${formatBulletList(rangeLines)}` : ' You can adjust the dates.'
                          }`
                        : `Para esas fechas el minimo es ${okAvailability.minNights} noches.${
                              rangeLines.length ? `\n\nOpciones:\n${formatBulletList(rangeLines)}` : ' Podes ajustar las fechas.'
                          }`
            }
        }
        if (!okAvailability.available?.length) {
            const suggestion = await buildNearbyAvailabilitySuggestion({
                start: startStr,
                nights: requestedNights,
                language,
                sede: input.metadata?.sede as string | undefined
            })
            if (suggestion) {
                return { answer: suggestion }
            }
            const alternativeLines = (okAvailability.alternatives || []).map((alt: any) => {
                return `- ${alt.hotelName || alt.sede} ${alt.roomType || ''}`.trim()
            })
            if (alternativeLines.length) {
                return {
                    answer:
                        language === 'en'
                            ? `${buildNoAvailabilityAnswer(language)}\n\nOptions in other locations:\n${formatBulletList(
                                  alternativeLines
                              )}`
                            : `${buildNoAvailabilityAnswer(language)}\n\nOpciones en otras sedes:\n${formatBulletList(
                                  alternativeLines
                              )}`
                }
            }
            return {
                answer: buildNoAvailabilityAnswer(language)
            }
        }
    const options = okAvailability.available.slice(0, 4).map((item: any) =>
        formatAvailabilityOption(item, language)
    )
        return {
            answer:
                language === 'en'
                    ? `Here are some options:\n${formatBulletList(options)}`
                    : `Aca tenes opciones:\n${formatBulletList(options)}`
        }
    }

    if (lower.includes('reserv')) {
        return {
            answer:
                language === 'en'
                    ? 'To book, I need dates, location, room type, and guest count.'
                    : 'Para reservar necesito fechas, sede, tipo de habitacion y cantidad de huespedes.'
        }
    }

    if (lower.includes('voucher')) {
        const match = message.match(/GRS-[0-9]{8}-[A-Z0-9]+/i)
        if (match) {
            const voucher = await generateVoucher(match[0].toUpperCase())
            if (voucher.ok) {
                const okVoucher = voucher as { voucher: { voucherId: string } }
                return {
                    answer:
                        language === 'en'
                            ? `Done, I reissued voucher ${okVoucher.voucher.voucherId}.`
                            : `Listo, reemiti el voucher ${okVoucher.voucher.voucherId}.`
                }
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'To reissue a voucher, I need the reservation ID.'
                    : 'Para reemitir el voucher necesito el ID de la reserva.'
        }
    }

    if (lower.includes('cancel')) {
        const reservationId = extractReservationId(message)
        const reservationEmail = extractEmail(message)
        if (lower.includes('credito') || lower.includes('credit')) {
            if (reservationId || reservationEmail) {
                const result = await cancelReservation({
                    reservationId,
                    email: reservationEmail || undefined,
                    reason: language === 'en' ? 'credit_requested' : 'credito_solicitado',
                    convertToCredit: true
                })
                if (result.ok) {
                    const cancelledId = (result as { cancellation?: { id?: string } }).cancellation?.id || reservationId
                    const credit = (result as { credit?: { amount?: number; currency?: string } }).credit
                    const amountLabel =
                        typeof credit?.amount === 'number'
                            ? `${formatMoney(credit.amount, credit.currency || 'USD')}`
                            : language === 'en'
                            ? 'an available amount'
                            : 'un monto disponible'
                    return {
                        answer:
                            language === 'en'
                                ? `Done, I converted ${cancelledId} to hotel credit for ${amountLabel}.`
                                : `Listo, converti ${cancelledId} a credito hotelero por ${amountLabel}.`
                    }
                }
                const failure = result as { reason?: string; policyNote?: string; lockDays?: number }
                return {
                    answer: buildReservationFailureAnswer({
                        reason: failure.reason,
                        policyNote: failure.policyNote,
                        lockDays: failure.lockDays,
                        language
                    })
                }
            }
            return {
                answer:
                    language === 'en'
                        ? 'I can convert it to hotel credit. Share the reservation ID or booking email and I will do it.'
                        : 'Puedo convertirla a credito hotelero. Pasame el ID de reserva o el email de la reserva y lo hago.'
            }
        }
        if (reservationId || reservationEmail) {
            const result = await cancelReservation({
                reservationId,
                email: reservationEmail || undefined,
                reason: language === 'en' ? 'guest_requested' : 'solicitud_huesped'
            })
            if (result.ok) {
                const cancelledId = (result as { cancellation?: { id?: string } }).cancellation?.id || reservationId
                const cancellation = (result as { cancellation?: { penaltyAmount?: number; currency?: string } }).cancellation
                const penaltyLabel =
                    typeof cancellation?.penaltyAmount === 'number' && cancellation.penaltyAmount > 0
                        ? language === 'en'
                            ? `Penalty applied: ${formatMoney(cancellation.penaltyAmount, cancellation.currency || 'USD')}.`
                            : `Penalidad aplicada: ${formatMoney(cancellation.penaltyAmount, cancellation.currency || 'USD')}.`
                        : language === 'en'
                        ? 'No penalty applied.'
                        : 'Sin penalidad.'
                return {
                    answer:
                        language === 'en'
                            ? `Done, reservation ${cancelledId} is cancelled. ${penaltyLabel}`
                            : `Listo, la reserva ${cancelledId} quedo cancelada. ${penaltyLabel}`
                }
            }
            const failure = result as { reason?: string; policyNote?: string; lockDays?: number }
            return {
                answer: buildReservationFailureAnswer({
                    reason: failure.reason,
                    policyNote: failure.policyNote,
                    lockDays: failure.lockDays,
                    language
                })
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'Sure, I can cancel it. Share the reservation ID or email. If you prefer, I can convert it to credit.'
                    : 'Dale, lo cancelo. Pasame el ID de reserva o el email. Si preferis, tambien puedo convertirla a credito.'
        }
    }

    if (lower.includes('cambiar') || lower.includes('modificar')) {
        return {
            answer:
                language === 'en'
                    ? 'Sure, I can modify it. Share the ID and the new dates or room type.'
                    : 'Dale, lo modifico. Pasame el ID y las nuevas fechas o habitacion.'
        }
    }

    if (lower.includes('toalla') || lower.includes('limpieza') || lower.includes('amenit') || lower.includes('room service')) {
        const reservationId = extractReservationId(message)
        if (reservationId) {
            const requestType = lower.includes('limpieza')
                ? 'housekeeping'
                : lower.includes('toalla')
                ? 'toallas'
                : lower.includes('room service')
                ? 'room_service'
                : 'amenity'
            const result = await recordServiceRequest({
                reservationId,
                requestType,
                message
            })
            if (result.ok) {
                await recordOperationalServiceNotification({
                    reservationId,
                    requestType,
                    message,
                    source: 'fallback'
                })
                return {
                    answer:
                        language === 'en'
                            ? `Done, I logged this request for ${reservationId}.`
                            : `Listo, registre este pedido para ${reservationId}.`
                }
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'Got it, I can log it. Share the reservation ID and the details.'
                    : 'Listo, lo registro. Decime el ID de reserva y el detalle del servicio.'
        }
    }

    if (
        lower.includes('recorda') ||
        lower.includes('recordame') ||
        lower.includes('recordarme') ||
        lower.includes('recordatorio') ||
        lower.includes('remind')
    ) {
        const reservationId = extractReservationId(message)
        if (!reservationId) {
            return {
                answer:
                    language === 'en'
                        ? 'I can schedule a reminder. Share the reservation ID and what I should remind.'
                        : 'Puedo programar un recordatorio. Pasame el ID de reserva y que queres que recuerde.'
            }
        }
        const reminderResult = await scheduleHotelReminder({
            reservationId,
            message,
            when: extractReminderAt(message),
            serviceType: 'guest_followup'
        })
        if (reminderResult.ok) {
            const reminder = (reminderResult as { reminder?: { when?: string } }).reminder
            const whenLabel = reminder?.when ? moment(reminder.when).format('YYYY-MM-DD HH:mm') : ''
            return {
                answer:
                    language === 'en'
                        ? `Done, reminder scheduled${whenLabel ? ` for ${whenLabel}` : ''}.`
                        : `Listo, recordatorio programado${whenLabel ? ` para ${whenLabel}` : ''}.`
            }
        }
        return {
            answer:
                language === 'en' ? 'I could not schedule that reminder. Share date and time.' : 'No pude programar ese recordatorio. Pasame fecha y hora.'
        }
    }

    if (lower.includes('aire') && lower.includes('acond')) {
        const reservationId = extractReservationId(message)
        if (reservationId) {
            await recordOperationalServiceNotification({
                reservationId,
                requestType: 'maintenance',
                message,
                source: 'fallback',
                extraPayload: { topic: 'aire_acondicionado' }
            })
            await recordServiceRequest({ reservationId, requestType: 'maintenance', message })
            return {
                answer:
                    language === 'en'
                        ? `I already reported this to maintenance for ${reservationId}.`
                        : `Ya lo reporte a mantenimiento para ${reservationId}.`
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'I can report it to maintenance right away. Share your reservation ID.'
                    : 'Lo puedo reportar a mantenimiento ahora mismo. Pasame tu ID de reserva.'
        }
    }

    if (lower.includes('comida') || lower.includes('restaurante')) {
        const reservationId = extractReservationId(message)
        if (reservationId) {
            const requestType = 'restaurante'
            const result = await recordServiceRequest({ reservationId, requestType, message })
            if (result.ok) {
                await recordOperationalServiceNotification({
                    reservationId,
                    requestType,
                    message,
                    source: 'fallback'
                })
                return {
                    answer:
                        language === 'en'
                            ? `Great, I sent your restaurant request for ${reservationId}.`
                            : `Genial, envie tu pedido a restaurante para ${reservationId}.`
                }
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'I can place that order. Share your reservation ID and what you want.'
                    : 'Puedo tomar ese pedido. Pasame tu ID de reserva y que queres pedir.'
        }
    }

    if (lower.includes('extender') || lower.includes('extension') || lower.includes('extend')) {
        const reservationId = extractReservationId(message)
        const dates = extractDates(message, { preferMonthFirst: language === 'en' })
        const requestedCheckout = dates.length ? dates[dates.length - 1].format('YYYY-MM-DD') : ''
        if (reservationId && requestedCheckout) {
            const result = await updateReservation({ reservationId, checkOut: requestedCheckout })
            if (result.ok) {
                return {
                    answer:
                        language === 'en'
                            ? `Done, I updated ${reservationId} with new check-out ${requestedCheckout}.`
                            : `Listo, actualice ${reservationId} con nuevo check-out ${requestedCheckout}.`
                }
            }
            const failure = result as { reason?: string; minNights?: number; maxGuests?: number; policy?: { nota?: string } }
            return {
                answer: buildReservationFailureAnswer({
                    reason: failure.reason,
                    minNights: failure.minNights,
                    maxGuests: failure.maxGuests,
                    policyNote: failure.policy?.nota || '',
                    language
                })
            }
        }
        return {
            answer:
                language === 'en'
                    ? 'I can help extend your stay. Share reservation ID and new check-out date.'
                    : 'Te ayudo a extender la estadia. Pasame ID de reserva y nueva fecha de check-out.'
        }
    }

    const checkIn = rules.horarios?.checkin || '15:00'
    const checkOut = rules.horarios?.checkout || '11:00'
    const summary =
        language === 'en'
            ? `I'm Freia. I can help with bookings, changes, cancellations, and services. Check-in ${checkIn}, check-out ${checkOut}.`
            : `Soy Freia. Te ayudo con reservas, cambios, cancelaciones y servicios. Check-in ${checkIn}, check-out ${checkOut}.`
    return { answer: summary }
}

export const HOTEL_TOOL_SPECS: ManualAgentToolDefinition[] = [
    {
        name: 'list_hotels',
        description: 'Lista hoteles y sedes disponibles.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Filtrar por sede o nombre' }
            }
        }
    },
    {
        name: 'list_room_types',
        description: 'Lista tipos de habitaciones con precios y amenities.',
        parameters: {
            type: 'object',
            properties: {
                sede: { type: 'string', description: 'Sede del hotel' },
                hotelId: { type: 'string', description: 'ID del hotel' }
            }
        }
    },
    {
        name: 'get_hotel_info',
        description: 'Devuelve informacion de sede, servicios incluidos, horarios y ubicacion.',
        parameters: {
            type: 'object',
            properties: {
                sede: { type: 'string', description: 'Sede del hotel' },
                hotelId: { type: 'string', description: 'ID del hotel' }
            }
        }
    },
    {
        name: 'list_services',
        description: 'Lista servicios y amenities disponibles.',
        parameters: {
            type: 'object',
            properties: {
                sede: { type: 'string', description: 'Sede del hotel' },
                categoria: { type: 'string', description: 'Categoria del servicio' },
                kind: { type: 'string', description: 'service o amenity' }
            }
        }
    },
    {
        name: 'get_guest_profile',
        description: 'Busca perfil del huesped por email o ID.',
        parameters: {
            type: 'object',
            properties: {
                email: { type: 'string' },
                guestId: { type: 'string' }
            }
        }
    },
    {
        name: 'get_support',
        description: 'Devuelve protocolos internos y manuales segun tema.',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'Tema del protocolo' }
            }
        }
    },
    {
        name: 'get_promos',
        description: 'Devuelve promociones aplicables para fechas y tipo de tarifa.',
        parameters: {
            type: 'object',
            properties: {
                start: { type: 'string' },
                end: { type: 'string' },
                sede: { type: 'string' },
                roomType: { type: 'string' },
                rateType: { type: 'string' }
            }
        }
    },
    {
        name: 'check_availability',
        description: 'Verifica disponibilidad para fechas y tipo de habitacion.',
        parameters: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                end: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                sede: { type: 'string', description: 'Sede del hotel' },
                hotelId: { type: 'string', description: 'ID del hotel' },
                roomType: { type: 'string', description: 'Tipo de habitacion' },
                guests: { type: 'number', description: 'Cantidad de huespedes' }
            },
            required: ['start']
        }
    },
    {
        name: 'get_rules',
        description: 'Devuelve reglas comerciales y politicas.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_faq',
        description: 'Devuelve preguntas frecuentes o una respuesta por intent.',
        parameters: {
            type: 'object',
            properties: {
                intent: { type: 'string', description: 'Intent a buscar' }
            }
        }
    },
    {
        name: 'get_reservation',
        description: 'Busca reservas por ID o email.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                email: { type: 'string' }
            }
        }
    },
    {
        name: 'create_reservation',
        description: 'Crea una reserva nueva aplicando reglas y disponibilidad.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                start: { type: 'string' },
                end: { type: 'string' },
                sede: { type: 'string' },
                hotelId: { type: 'string' },
                roomType: { type: 'string' },
                guests: { type: 'number' },
                rateType: { type: 'string' },
                paymentMethod: { type: 'string' },
                preferences: { type: 'string' },
                earlyCheckin: { type: 'boolean' },
                lateCheckout: { type: 'boolean' }
            },
            required: ['name', 'email', 'start', 'end', 'roomType', 'paymentMethod']
        }
    },
    {
        name: 'update_reservation',
        description: 'Actualiza fechas, tipo de habitacion o huespedes.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                checkIn: { type: 'string' },
                checkOut: { type: 'string' },
                roomType: { type: 'string' },
                guests: { type: 'number' },
                rateType: { type: 'string' },
                paymentMethod: { type: 'string' },
                preferences: { type: 'string' },
                earlyCheckin: { type: 'boolean' },
                lateCheckout: { type: 'boolean' }
            },
            required: ['reservationId']
        }
    },
    {
        name: 'cancel_reservation',
        description: 'Cancela una reserva y calcula penalidad.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                email: { type: 'string', description: 'Email de la reserva cuando no se tiene el ID.' },
                reason: { type: 'string' },
                convertToCredit: { type: 'boolean', description: 'Si true, convierte la reserva en credito en vez de cancelar en efectivo.' }
            }
        }
    },
    {
        name: 'convert_reservation_to_credit',
        description: 'Convierte una reserva en credito hotelero (mock) aplicando politicas.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                email: { type: 'string', description: 'Email de la reserva cuando no se tiene el ID.' },
                reason: { type: 'string' }
            }
        }
    },
    {
        name: 'record_service_request',
        description: 'Registra un pedido de servicio durante la estadia.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                requestType: { type: 'string' },
                message: { type: 'string' }
            },
            required: ['reservationId']
        }
    },
    {
        name: 'schedule_reminder',
        description: 'Programa un recordatorio de servicio o seguimiento para un huesped.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                serviceType: { type: 'string' },
                message: { type: 'string' },
                when: { type: 'string', description: 'Fecha/hora ISO del recordatorio' },
                channel: { type: 'string', description: 'chat, whatsapp, email, phone' }
            },
            required: ['reservationId', 'message']
        }
    },
    {
        name: 'record_lead',
        description: 'Registra o actualiza un lead comercial.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                nombre: { type: 'string' },
                email: { type: 'string' },
                telefono: { type: 'string' },
                interes: { type: 'string' },
                origen: { type: 'string' },
                estado: { type: 'string' },
                notas: { type: 'string' }
            }
        }
    },
    {
        name: 'list_leads',
        description: 'Lista leads comerciales existentes.',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string' }
            }
        }
    },
    {
        name: 'notify_staff',
        description: 'Notifica al personal interno con un pedido o incidente.',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                message: { type: 'string' },
                reservationId: { type: 'string' },
                sede: { type: 'string' }
            }
        }
    },
    {
        name: 'generate_voucher',
        description: 'Genera o reemite un voucher de reserva.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' }
            },
            required: ['reservationId']
        }
    },
    {
        name: 'record_payment',
        description: 'Registra un pago simulado para una reserva.',
        parameters: {
            type: 'object',
            properties: {
                reservationId: { type: 'string' },
                amount: { type: 'number' },
                currency: { type: 'string' },
                method: { type: 'string' },
                paymentRef: { type: 'string' }
            },
            required: ['reservationId']
        }
    },
    {
        name: 'generate_report',
        description: 'Genera reporte de ocupacion, cancelaciones y upselling.',
        parameters: {
            type: 'object',
            properties: {
                start: { type: 'string' },
                end: { type: 'string' },
                sede: { type: 'string' }
            },
            required: ['start', 'end']
        }
    }
]

export const handleHotelChat = async (input: ManualAgentRequest): Promise<ManualAgentResponse> => {
    await ensureHotelSeed()

    const rules = await getHotelRules()
    const hotels = await getHotelInventory()
    let sessionMessages = await getSessionMessages(input.sessionId)
    const storedContext = await getSessionContext(input.sessionId)
    let sessionContext = { ...buildContextFromMessages(sessionMessages), ...storedContext }
    let language = (sessionContext?.language as 'es' | 'en' | undefined) || getSessionLanguage(sessionMessages, input.message || '')
    const message = input.message || ''
    const normalized = normalizeText(message)
    const explicitYearInMessage =
        /\b\d{4}-\d{2}-\d{2}\b/.test(message) || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(message)
    const inferredMonth = findMonthInText(message)
    const bookingIntent =
        normalized.includes('reserv') || normalized.includes('book') || normalized.includes('reserve') || normalized.includes('booking')
    const explicitDates = extractDates(message, { preferMonthFirst: language === 'en' })
    const stayLength = extractStayLengthDetails(message)
    const requestedNights = stayLength?.value
    const resolvedDates = explicitDates
    const dayRange = extractDayRange(message)
    const relativeRange = !explicitDates.length && !dayRange ? parseRelativeDateRange(message) : null
    const detectedHotel = detectHotelSelection(message, hotels)
    const detectedRoomType = detectRoomSelection(message, detectedHotel, hotels)
    const detectedGuests = extractGuests(message)
    const detectedPaymentMethod = extractPaymentMethod(message)
    const detectedEmail = extractEmail(message)
    const detectedName = extractName(message)
    const hasDateSignal = resolvedDates.length > 0 || Boolean(dayRange) || Boolean(relativeRange)
    const isShortAck = isShortAckOnly(message) || isPoliteAckOnly(message)
    const isShortNo = isShortNoOnly(message)
    const wantsFlexibleDates =
        normalized.includes('flexible') ||
        normalized.includes('cualquier') ||
        normalized.includes('cualquiera') ||
        normalized.includes('cuando tengan') ||
        normalized.includes('cualquier fecha')
    const wantsWeekendOnly =
        normalized.includes('fin de semana') ||
        normalized.includes('finde') ||
        normalized.includes('fines de semana') ||
        normalized.includes('weekend')
    const policySignal =
        normalized.includes('cancel') ||
        normalized.includes('cambiar') ||
        normalized.includes('modificar') ||
        normalized.includes('reembolso') ||
        normalized.includes('politica') ||
        normalized.includes('pago') ||
        normalized.includes('deposito') ||
        normalized.includes('tarjeta') ||
        normalized.includes('transferencia')
    const pricingSignal = normalized.includes('precio') || normalized.includes('tarifa') || normalized.includes('cost')
    const earlyCheckinSignal =
        normalized.includes('early check-in') ||
        normalized.includes('early check in') ||
        normalized.includes('early checkin') ||
        normalized.includes('check-in temprano') ||
        normalized.includes('ingreso temprano')
    const lateCheckoutSignal =
        normalized.includes('late check-out') ||
        normalized.includes('late check out') ||
        normalized.includes('late checkout') ||
        normalized.includes('check-out tarde') ||
        normalized.includes('salida tarde')
    const lateCheckinSignal =
        normalized.includes('late check-in') ||
        normalized.includes('late check in') ||
        normalized.includes('late checkin') ||
        normalized.includes('check-in tarde') ||
        normalized.includes('llego tarde') ||
        normalized.includes('llegamos tarde') ||
        normalized.includes('llegare tarde')
    const earlyCheckoutSignal =
        normalized.includes('early check-out') ||
        normalized.includes('early check out') ||
        normalized.includes('early checkout') ||
        normalized.includes('check-out temprano') ||
        normalized.includes('salida temprano')
    const quincenaMentioned = normalized.includes('quincena')
    const checkInOutSignal =
        earlyCheckinSignal ||
        lateCheckoutSignal ||
        lateCheckinSignal ||
        earlyCheckoutSignal ||
        normalized.includes('check-in') ||
        normalized.includes('check in') ||
        normalized.includes('check-out') ||
        normalized.includes('check out') ||
        normalized.includes('checkin') ||
        normalized.includes('checkout') ||
        normalized.includes('ingreso') ||
        normalized.includes('salida') ||
        normalized.includes('horario')
    const bookingSignal = bookingIntent || normalized.includes('confirmo') || normalized.includes('confirmar')
    const availabilitySignal = hasDateSignal || normalized.includes('dispon') || normalized.includes('availability')
    const preferenceNotes = [
        lateCheckinSignal ? (language === 'en' ? 'late check-in' : 'check-in tarde') : '',
        earlyCheckoutSignal ? (language === 'en' ? 'early check-out' : 'salida temprano') : ''
    ].filter(Boolean)
    const mergedPreferences = preferenceNotes.length ? mergePreferences(String(sessionContext?.preferences || ''), preferenceNotes) : ''
    const currentTopic = policySignal
        ? 'policy'
        : pricingSignal
        ? 'pricing'
        : bookingSignal
        ? 'booking'
        : availabilitySignal
        ? 'availability'
        : ''
    const previousTopic = String(sessionContext?.lastTopic || '')
    const confusionSignal =
        normalized.includes('no entiendo') ||
        normalized.includes('no entendi') ||
        normalized.includes('no me entendiste') ||
        normalized.includes('no me entendes') ||
        normalized.includes('no me entiendes') ||
        normalized.includes('no se entiende') ||
        normalized.includes('no comprendo') ||
        normalized.includes("don't understand") ||
        normalized.includes('dont understand') ||
        normalized.includes('what do you mean') ||
        normalized.includes("i'm confused") ||
        normalized.includes('im confused') ||
        normalized.includes('not clear')

    if (confusionSignal) {
        const nextCount = Number(sessionContext?.confusionCount || 0) + 1
        const contextUpdatePayload: Record<string, unknown> = { confusionCount: nextCount }
        if (currentTopic) {
            contextUpdatePayload.lastTopic = currentTopic
        }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        const base =
            language === 'en'
                ? 'Sorry, what should I clarify?'
                : 'Perdon, que parte queres que aclare?'
        const answer = nextCount >= 2 ? appendEscalationPrompt(base, language) : base
        return { answer, metadata: { context: sessionContext } }
    }

    if (isRestartRequest(message)) {
        await resetHotelSessionFlow(input.sessionId || '')
        const preservedContext: Record<string, unknown> = {}
        if (sessionContext?.language) preservedContext.language = sessionContext.language
        if (sessionContext?.name) preservedContext.name = sessionContext.name
        if (sessionContext?.email) preservedContext.email = sessionContext.email
        sessionContext = preservedContext
        const answer =
            language === 'en'
                ? 'Done, we can start from scratch. Share check-in/check-out dates and location and I will quote options.'
                : 'Listo, arrancamos de cero. Pasame fechas de check-in/check-out y sede y te cotizo opciones.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_dates',
            frictionAction: 'reset'
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isHumanHandoffRequest(message) && !hasDateSignal && !detectedHotel && !detectedRoomType && !detectedEmail) {
        const answer =
            language === 'en'
                ? 'Sure, I can hand this over to a human. If you want, share dates and location and I can leave everything ready.'
                : 'Claro, te puedo pasar con un humano. Si queres, pasame fechas y sede y dejo todo listo.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_details',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isDataScopeQuestion(message) && !hasDateSignal) {
        const result = await applyHotelReplySignals({
            answer: buildMockScopeAnswer(language),
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isUnsupportedMockDataQuestion(message) && !hasDateSignal) {
        const result = await applyHotelReplySignals({
            answer: buildUnsupportedMockDataAnswer(language),
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isSmallTalkOnly(message) && !hasDateSignal && !detectedEmail && !detectedHotel && !detectedRoomType) {
        const stayLabel =
            sessionContext?.start && sessionContext?.end
                ? formatStaySpan(String(sessionContext.start), String(sessionContext.end), language)
                : ''
        const answer = stayLabel
            ? language === 'en'
                ? `All good on my side. If you want, we can continue with ${stayLabel}.`
                : `Todo bien por aca. Si queres, seguimos con ${stayLabel}.`
            : language === 'en'
            ? "I'm doing great, thanks. If you want, we can start with dates and location."
            : 'Todo bien, gracias. Si queres, arrancamos con fechas y sede.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: stayLabel ? 'awaiting_intent' : 'awaiting_dates',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (
        isThanksOnly(message) &&
        !sessionContext?.pendingDateConfirm &&
        !sessionContext?.pendingReservationConfirm &&
        !hasDateSignal &&
        !detectedHotel &&
        !detectedRoomType &&
        !detectedEmail
    ) {
        const answer = language === 'en' ? "You're welcome. If you want, I can keep helping with your booking." : 'De nada. Si queres, seguimos con tu reserva.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isDeclineOnly(message) && !sessionContext?.pendingDateConfirm && !sessionContext?.pendingReservationConfirm && !hasDateSignal) {
        const answer =
            language === 'en'
                ? "All good. If you want to continue later, I'm here."
                : 'Todo bien. Si queres retomar despues, estoy aca.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (
        isGoodbyeOnly(message) &&
        !hasDateSignal &&
        !detectedEmail &&
        !detectedHotel &&
        !detectedRoomType &&
        !sessionContext?.pendingDateConfirm &&
        !sessionContext?.pendingReservationConfirm
    ) {
        const answer =
            language === 'en'
                ? 'Perfect, we can pause here. When you want to continue, share dates and I pick it up.'
                : 'Perfecto, lo dejamos aca. Cuando quieras seguir, pasame fechas y lo retomamos.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isGreetingOnly(message) && !hasDateSignal) {
        const stayLabel =
            sessionContext?.start && sessionContext?.end
                ? formatStaySpan(String(sessionContext.start), String(sessionContext.end), language)
                : ''
        const answer = stayLabel
            ? language === 'en'
                ? `Hi! I can keep helping with ${stayLabel}, or we can change dates if you prefer.`
                : `Hola! Podemos seguir con ${stayLabel}, o cambiar fechas si preferis.`
            : language === 'en'
            ? 'Hi! I can help with bookings, changes, cancellations, and services. Share dates and I will start.'
            : 'Hola! Te ayudo con reservas, cambios, cancelaciones y servicios. Pasame fechas y arrancamos.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: stayLabel ? 'awaiting_intent' : 'awaiting_dates',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isHelpOnly(message) && !hasDateSignal && !detectedEmail) {
        const result = await applyHotelReplySignals({
            answer: buildHelpAnswer(language),
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (isClearlyOffTopic(message) && !hasDateSignal && !detectedEmail && !detectedHotel && !detectedRoomType) {
        const answer =
            language === 'en'
                ? 'I can only help with hotel topics (reservations, changes, cancellations, and guest services). Share dates and I can continue.'
                : 'Solo puedo ayudar con hoteleria (reservas, cambios, cancelaciones y servicios al huesped). Pasame fechas y seguimos.'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_intent',
            frictionAction: 'reset',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (
        checkInOutSignal &&
        !hasDateSignal &&
        !bookingSignal &&
        !availabilitySignal &&
        !pricingSignal &&
        !policySignal
    ) {
        const checkInTime = rules.horarios?.checkin || '15:00'
        const checkOutTime = rules.horarios?.checkout || '11:00'
        const base =
            language === 'en'
                ? `Check-in is ${checkInTime}, check-out is ${checkOutTime}.`
                : `El check-in es a las ${checkInTime} y el check-out a las ${checkOutTime}.`
        const earlyInfo = rules.earlyLate?.earlyCheckin
            ? language === 'en'
                ? `Early check-in from ${rules.earlyLate.earlyCheckin.desde || '11:00'} with fee ${
                      rules.earlyLate.earlyCheckin.fee || 0
                  } ${rules.earlyLate.earlyCheckin.moneda || 'USD'}.`
                : `Ingreso temprano desde ${rules.earlyLate.earlyCheckin.desde || '11:00'} con fee ${
                      rules.earlyLate.earlyCheckin.fee || 0
                  } ${rules.earlyLate.earlyCheckin.moneda || 'USD'}.`
            : language === 'en'
            ? 'Early check-in is subject to availability.'
            : 'El ingreso temprano es sujeto a disponibilidad.'
        const lateInfo = rules.earlyLate?.lateCheckout
            ? language === 'en'
                ? `Late check-out until ${rules.earlyLate.lateCheckout.hasta || '14:00'} with fee ${
                      rules.earlyLate.lateCheckout.fee || 0
                  } ${rules.earlyLate.lateCheckout.moneda || 'USD'}.`
                : `Salida tarde hasta ${rules.earlyLate.lateCheckout.hasta || '14:00'} con fee ${
                      rules.earlyLate.lateCheckout.fee || 0
                  } ${rules.earlyLate.lateCheckout.moneda || 'USD'}.`
            : language === 'en'
            ? 'Late check-out is subject to availability.'
            : 'La salida tarde es sujeta a disponibilidad.'
        const lateArrivalQuestion =
            language === 'en'
                ? 'Late check-in is fine. What time do you expect to arrive?'
                : 'El check-in tarde esta bien. A que hora estimas llegar?'
        const earlyDepartureQuestion =
            language === 'en'
                ? 'Early check-out is ok. What time would you leave?'
                : 'La salida temprano esta ok. A que hora te irias?'
        const lines = [base]
        if (earlyCheckinSignal) lines.push(earlyInfo)
        if (lateCheckoutSignal) lines.push(lateInfo)
        if (lateCheckinSignal) lines.push(lateArrivalQuestion)
        if (earlyCheckoutSignal) lines.push(earlyDepartureQuestion)
        const answer = lines.join(' ')

        const contextUpdatePayload: Record<string, unknown> = {}
        if (earlyCheckinSignal) contextUpdatePayload.earlyCheckin = true
        if (lateCheckoutSignal) contextUpdatePayload.lateCheckout = true
        if (mergedPreferences) contextUpdatePayload.preferences = mergedPreferences
        if (Object.keys(contextUpdatePayload).length) {
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
        }

        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    const ambiguousShortDate = !explicitYearInMessage && !inferredMonth ? findAmbiguousShortDate(message) : null
    if (ambiguousShortDate) {
        const result = await applyHotelReplySignals({
            answer: buildAmbiguousDateQuestion(ambiguousShortDate, language),
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_dates',
            frictionAction: 'increase',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (quincenaMentioned && !inferredMonth && !dayRange && explicitDates.length === 0 && !relativeRange) {
        const answer =
            language === 'en'
                ? 'Which month is that for?'
                : 'Dale, de que mes hablamos para esa quincena?'
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_month',
            frictionAction: 'increase',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (explicitYearInMessage && resolvedDates.length) {
        const today = moment().startOf('day')
        const hasPastDates = resolvedDates.some((date) => date.isBefore(today, 'day'))
        if (hasPastDates) {
            const answer =
                language === 'en'
                    ? 'Those dates are in the past. Can you share new dates?'
                    : 'Esas fechas quedaron en el pasado. Me pasas nuevas fechas?'
            const result = await applyHotelReplySignals({
                answer,
                sessionId: input.sessionId || '',
                context: sessionContext,
                language,
                intentSummary: 'awaiting_dates',
                frictionAction: 'increase',
                topic: currentTopic
            })
            if (Object.keys(result.contextUpdate).length) {
                sessionContext = { ...sessionContext, ...result.contextUpdate }
            }
            return { answer: result.answer, metadata: { context: sessionContext } }
        }
    }

    if (explicitDates.length === 1 && stayLength) {
        const start = explicitDates[0].clone().startOf('day')
        const end = start.clone().add(stayLength.value, 'day')
        const startStr = start.format('YYYY-MM-DD')
        const endStr = end.format('YYYY-MM-DD')
        const rangeLabel = formatStaySpan(startStr, endStr, language)
        const unitLabel =
            stayLength.unit === 'nights'
                ? language === 'en'
                    ? 'nights'
                    : 'noches'
                : language === 'en'
                ? 'days'
                : 'dias'
        const answer =
            language === 'en'
                ? `Just to confirm ${stayLength.value} ${unitLabel}, do you mean ${rangeLabel}?`
                : `Para confirmar ${stayLength.value} ${unitLabel}, te referis a ${rangeLabel}?`
        const contextUpdatePayload = { start: startStr, end: endStr, pendingDateConfirm: true }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'confirm_dates',
            frictionAction: 'increase',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (!hasDateSignal && detectedEmail && (!sessionContext.start || !sessionContext.end)) {
        const restoredSession = await findRecentSessionByIdentity({
            sessionId: input.sessionId,
            name: detectedName || undefined,
            email: detectedEmail || undefined
        })
        if (restoredSession?.context) {
            const restoredContext = restoredSession.context as Record<string, unknown>
            sessionContext = { ...restoredContext, ...sessionContext }
            const restorePayload = buildContextRestorePayload(restoredContext, storedContext as Record<string, unknown>)
            if (Object.keys(restorePayload).length) {
                await updateSessionContext(input.sessionId, restorePayload)
                sessionContext = { ...sessionContext, ...restorePayload }
            }
        }
        if (restoredSession?.messages?.length) {
            sessionMessages = [...restoredSession.messages, ...sessionMessages]
        }
    }
    const contextUpdate: Record<string, unknown> = {}

    if (resolvedDates.length >= 2) {
        contextUpdate.start = resolvedDates[0].format('YYYY-MM-DD')
        contextUpdate.end = resolvedDates[1].format('YYYY-MM-DD')
    }
    if (detectedHotel?.hotelId) {
        contextUpdate.hotelId = detectedHotel.hotelId
        contextUpdate.sede = detectedHotel.sede
    }
    if (detectedRoomType) {
        contextUpdate.roomType = detectedRoomType
    }
    if (typeof detectedGuests === 'number') {
        contextUpdate.guests = detectedGuests
    }
    if (detectedPaymentMethod) {
        contextUpdate.paymentMethod = detectedPaymentMethod
    }
    if (detectedName) {
        contextUpdate.name = detectedName
    }
    if (detectedEmail) {
        contextUpdate.email = detectedEmail
    }
    if (earlyCheckinSignal) {
        contextUpdate.earlyCheckin = true
    }
    if (lateCheckoutSignal) {
        contextUpdate.lateCheckout = true
    }
    if (mergedPreferences) {
        contextUpdate.preferences = mergedPreferences
    }
    if (Object.keys(contextUpdate).length) {
        await updateSessionContext(input.sessionId, contextUpdate)
        sessionContext = { ...sessionContext, ...contextUpdate }
    }

    if (!sessionContext?.language && language) {
        await updateSessionContext(input.sessionId, { language })
        sessionContext = { ...sessionContext, language }
    }

    const isNameOnlyMessage =
        detectedName &&
        !detectedEmail &&
        !hasDateSignal &&
        !detectedHotel &&
        !detectedRoomType &&
        !bookingIntent &&
        !normalized.includes('precio') &&
        !normalized.includes('tarifa') &&
        !normalized.includes('habitacion') &&
        !normalized.includes('sede')
    if (isNameOnlyMessage) {
        const formatted = formatGuestName(detectedName)
        const answer =
            language === 'en'
                ? `Thanks ${formatted}. If you want me to pull a previous chat, share your email. Otherwise, share your dates.`
                : `Gracias ${formatted}. Si queres retomar una charla anterior, pasame tu email. Si no, contame fechas.`
        const result = await applyHotelReplySignals({
            answer,
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            intentSummary: 'awaiting_dates',
            frictionAction: 'increase',
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { answer: result.answer, metadata: { context: sessionContext } }
    }

    if (sessionContext?.pendingDateConfirm && explicitDates.length) {
        const clearPayload = { pendingDateConfirm: false }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }
    }

    if (
        sessionContext?.pendingReservationConfirm &&
        (resolvedDates.length >= 2 || detectedHotel || detectedRoomType || typeof detectedGuests === 'number' || detectedPaymentMethod)
    ) {
        const clearPayload = { pendingReservationConfirm: false }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }
    }

    const respondWith = async (
        response: ManualAgentResponse,
        options?: { replyKind?: string; intentSummary?: string; frictionAction?: 'increase' | 'reset' }
    ) => {
        const result = await applyHotelReplySignals({
            answer: response.answer || '',
            sessionId: input.sessionId || '',
            context: sessionContext,
            language,
            replyKind: options?.replyKind,
            intentSummary: options?.intentSummary,
            frictionAction: options?.frictionAction,
            topic: currentTopic
        })
        if (Object.keys(result.contextUpdate).length) {
            sessionContext = { ...sessionContext, ...result.contextUpdate }
        }
        return { ...response, answer: result.answer }
    }

    const respond = async (
        answer: string,
        metadata?: ManualAgentResponse['metadata'],
        options?: { replyKind?: string; intentSummary?: string; frictionAction?: 'increase' | 'reset' }
    ) => {
        return respondWith({ answer, metadata }, options)
    }

    const hasStoredDates = Boolean(sessionContext?.start && sessionContext?.end)
    const staleDateContext = isDateContextStale({
        start: sessionContext?.start as string | undefined,
        end: sessionContext?.end as string | undefined,
        dateContextUpdatedAt: sessionContext?.dateContextUpdatedAt as string | Date | null | undefined
    })
    if (
        staleDateContext &&
        hasStoredDates &&
        !hasDateSignal &&
        !sessionContext?.pendingDateConfirm &&
        !sessionContext?.pendingReservationConfirm
    ) {
        const stayLabel = formatStaySpan(String(sessionContext.start), String(sessionContext.end), language)
        const answer =
            language === 'en'
                ? `I have these dates on file (${stayLabel}). Want to keep them or change them?`
                : `Tengo estas fechas guardadas (${stayLabel}). Te sirven o las cambiamos?`
        const contextUpdatePayload = { pendingDateConfirm: true }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        return respond(answer, { context: sessionContext }, { intentSummary: 'confirm_dates', frictionAction: 'increase' })
    }

    const wantsMixedIntent = bookingSignal && (pricingSignal || policySignal)
    if (
        wantsMixedIntent &&
        !hasDateSignal &&
        !sessionContext?.pendingDateConfirm &&
        !sessionContext?.pendingReservationConfirm
    ) {
        const answer =
            language === 'en'
                ? pricingSignal && policySignal
                    ? 'Do you want a quote, policies, or to book?'
                    : pricingSignal
                    ? 'Do you want a quote first, or should I move forward with the booking?'
                    : 'Do you want the policies, or should I move forward with the booking?'
                : pricingSignal && policySignal
                ? 'Queres cotizacion, politicas o avanzar con la reserva?'
                : pricingSignal
                ? 'Queres cotizar primero o avanzo con la reserva?'
                : 'Queres ver politicas o avanzo con la reserva?'
        return respond(answer, { context: sessionContext }, { intentSummary: 'awaiting_intent', frictionAction: 'increase' })
    }

    if (sessionContext?.pendingDateConfirm && isShortNo && !explicitDates.length) {
        const clearPayload = { pendingDateConfirm: false }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }
        return respond(
            language === 'en' ? 'Ok, share the exact dates you want.' : 'Dale, pasame las fechas exactas.',
            { context: sessionContext },
            { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
        )
    }

    if (sessionContext?.pendingDateConfirm && isShortAck && !explicitDates.length && sessionContext.start && sessionContext.end) {
        const start = String(sessionContext.start)
        const end = String(sessionContext.end)
        const clearPayload = { pendingDateConfirm: false, dateContextUpdatedAt: new Date() }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }
        const availabilityScope = sessionContext?.hotelId || sessionContext?.sede ? 'sede' : 'global'
        const availability = await checkAvailability({
            start,
            end,
            sede: sessionContext?.sede as string | undefined,
            hotelId: sessionContext?.hotelId as string | undefined,
            roomType: sessionContext?.roomType as string | undefined,
            guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
        })
        if (!availability.ok) {
            const contextUpdatePayload = { availabilityOk: false, availabilityScope }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(buildNoAvailabilityAnswer(language), { context: sessionContext }, { replyKind: 'availability', frictionAction: 'reset' })
        }
        const okAvailability = availability as {
            available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
        }
        const options = (okAvailability.available || [])
            .slice(0, 4)
            .map((item) => formatAvailabilityOption(item, language))
        if (!options.length) {
            const minNightsAnswer = buildMinNightsAnswer(availability as { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> }, language)
            const contextUpdatePayload = { availabilityOk: false, availabilityScope }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            if (minNightsAnswer) {
                return respond(minNightsAnswer, { context: sessionContext }, { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' })
            }
            const suggestion = await buildNearbyAvailabilitySuggestion({
                start,
                nights: requestedNights,
                language,
                sede: sessionContext?.sede as string | undefined,
                hotelId: sessionContext?.hotelId as string | undefined,
                roomType: sessionContext?.roomType as string | undefined,
                guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
            })
            if (suggestion) {
                return respond(suggestion, { context: sessionContext }, { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' })
            }
            return respond(buildNoAvailabilityAnswer(language), { context: sessionContext }, { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' })
        }
        const contextUpdatePayload = { availabilityOk: true, availabilityScope }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        return respond(
            buildAvailabilityOptionsAnswer(options, language, sessionContext?.lastReplyKind === 'availability'),
            { context: sessionContext },
            { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
        )
    }

    if (
        bookingIntent &&
        !hasDateSignal &&
        !sessionContext?.pendingDateConfirm &&
        !sessionContext?.pendingReservationConfirm &&
        sessionContext?.start &&
        sessionContext?.end &&
        (previousTopic === 'policy' || previousTopic === 'pricing')
    ) {
        const startDate = parseDate(String(sessionContext.start))
        const endDate = parseDate(String(sessionContext.end))
        if (startDate.isValid() && endDate.isValid()) {
            const rangeLabel = formatStaySpan(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), language)
            const answer =
                language === 'en'
                    ? `Before booking, should I keep ${rangeLabel}?`
                    : `Antes de reservar, seguimos con ${rangeLabel}?`
            const contextUpdatePayload = { pendingDateConfirm: true }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(answer, { context: sessionContext }, { intentSummary: 'confirm_dates', frictionAction: 'increase' })
        }
    }

    if (relativeRange && !inferredMonth && explicitDates.length === 0 && !dayRange) {
        const startStr = relativeRange.start.format('YYYY-MM-DD')
        const endStr = relativeRange.end.format('YYYY-MM-DD')
        const contextUpdatePayload = { start: startStr, end: endStr, pendingDateConfirm: true }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        const rangeLabel = formatSuggestedRange(relativeRange.start, relativeRange.end, language)
        const answer =
            language === 'en'
                ? `Did you mean ${rangeLabel}?`
                : `Te referis a ${rangeLabel}?`
        return respond(answer, { context: { start: startStr, end: endStr } }, { intentSummary: 'confirm_dates', frictionAction: 'increase' })
    }

    if (inferredMonth && explicitDates.length === 0 && !dayRange && (wantsFlexibleDates || wantsWeekendOnly)) {
        const suggestion = await buildFlexibleAvailabilityMessage({
            month: inferredMonth.month,
            year: inferredMonth.year,
            nights: requestedNights,
            weekendOnly: wantsWeekendOnly,
            language,
            sede: sessionContext?.sede as string | undefined,
            hotelId: sessionContext?.hotelId as string | undefined,
            roomType: sessionContext?.roomType as string | undefined,
            guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
        })
        if (suggestion) {
            return respond(
                suggestion,
                { context: { month: inferredMonth.month, year: inferredMonth.year } },
                { intentSummary: 'availability_options', frictionAction: 'reset' }
            )
        }
        const monthName = formatMonthName(inferredMonth.month, inferredMonth.year, language)
        return respond(
            language === 'en'
                ? `I could not find options in ${monthName}. Want a different month?`
                : `No encontre opciones en ${monthName}. Queres otro mes?`,
            { context: { month: inferredMonth.month, year: inferredMonth.year } },
            { intentSummary: 'awaiting_month', frictionAction: 'increase' }
        )
    }

    if (sessionContext?.pendingReservationConfirm && isShortNo) {
        const clearPayload = { pendingReservationConfirm: false }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }
        return respond(
            language === 'en' ? 'Ok, what do you want to change?' : 'Dale, que queres cambiar?',
            { context: sessionContext },
            { intentSummary: 'awaiting_details' }
        )
    }

    if (sessionContext?.pendingReservationConfirm && isShortAck && sessionContext?.start && sessionContext?.end) {
        const name = String(sessionContext?.name || '')
        const email = String(sessionContext?.email || '')
        const paymentMethod = String(sessionContext?.paymentMethod || '')
        if (!name || !email || !paymentMethod) {
            const clearPayload = { pendingReservationConfirm: false }
            await updateSessionContext(input.sessionId, clearPayload)
            sessionContext = { ...sessionContext, ...clearPayload }
            return respond(
                language === 'en'
                    ? 'Share your full name, email, and payment method.'
                    : 'Pasame nombre completo, email y metodo de pago.',
                { context: sessionContext },
                { intentSummary: 'awaiting_contact' }
            )
        }

        const result = await createReservation({
            name,
            email,
            start: String(sessionContext.start),
            end: String(sessionContext.end),
            sede: String(sessionContext.sede || ''),
            hotelId: String(sessionContext.hotelId || ''),
            roomType: String(sessionContext.roomType || ''),
            guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined,
            paymentMethod,
            earlyCheckin: Boolean(sessionContext.earlyCheckin),
            lateCheckout: Boolean(sessionContext.lateCheckout),
            preferences: String(sessionContext.preferences || '')
        })

        const clearPayload = { pendingReservationConfirm: false }
        await updateSessionContext(input.sessionId, clearPayload)
        sessionContext = { ...sessionContext, ...clearPayload }

        if (!result.ok) {
            const reservationFailure = result as {
                reason?: string
                minNights?: number
                maxGuests?: number
                policyNote?: string
                lockDays?: number
            }
            const baseAnswer = buildReservationFailureAnswer({
                reason: reservationFailure.reason,
                minNights: reservationFailure.minNights,
                maxGuests: reservationFailure.maxGuests,
                policyNote: reservationFailure.policyNote,
                lockDays: reservationFailure.lockDays,
                language
            })
            const shouldSuggestAlternatives = ['sold_out', 'missing_dates', 'blocked'].includes(String(reservationFailure.reason || ''))
            const answer = shouldSuggestAlternatives
                ? `${baseAnswer} ${language === 'en' ? 'Want me to check nearby dates?' : 'Queres que busque fechas cercanas?'}`
                : baseAnswer
            return respond(
                answer,
                { context: sessionContext },
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }

        const reservationSummarySource = result.reservation as {
            hotelName?: string
            sede?: string
            habitacionTipo?: string
            checkIn?: string
            checkOut?: string
            huespedes?: number
            earlyCheckin?: boolean
            lateCheckout?: boolean
        } | null

        const summaryLine = buildReservationSummaryLine(
            {
                hotelName: reservationSummarySource?.hotelName,
                sede: reservationSummarySource?.sede,
                roomType: reservationSummarySource?.habitacionTipo,
                checkIn: reservationSummarySource?.checkIn,
                checkOut: reservationSummarySource?.checkOut,
                guests: reservationSummarySource?.huespedes,
                earlyCheckin: reservationSummarySource?.earlyCheckin,
                lateCheckout: reservationSummarySource?.lateCheckout
            },
            language
        )
        const confirmationLine =
            language === 'en'
                ? `All set, reservation confirmed. Your ID is ${result.reservation?.id}.`
                : `Listo, reserva confirmada. Tu ID es ${result.reservation?.id}.`
        return respondWith(
            {
                answer: summaryLine ? `${confirmationLine}\n\n${summaryLine}` : confirmationLine,
                metadata: {
                    ...(result as { confirmation?: any; reservation?: any; fees?: any; promos?: any }).confirmation
                        ? {
                              type: 'reservationCard',
                              reservation: result.reservation,
                              confirmation: result.confirmation,
                              fees: result.fees,
                              promos: result.promos,
                              context: sessionContext
                          }
                        : { context: sessionContext }
                }
            },
            { intentSummary: 'reservation_confirmed', frictionAction: 'reset' }
        )
    }

    if (inferredMonth && explicitDates.length === 0 && !dayRange) {
        const monthName = formatMonthName(inferredMonth.month, inferredMonth.year, language)
        await updateSessionContext(input.sessionId, { month: inferredMonth.month, year: inferredMonth.year })
        return respond(
            language === 'en'
                ? `Ok, for ${monthName} I need exact dates. For example: from 5 to 10.`
                : `Dale, para ${monthName} necesito fechas exactas. Por ejemplo: del 5 al 10.`,
            { context: { month: inferredMonth.month, year: inferredMonth.year } },
            { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
        )
    }

    if (dayRange && explicitDates.length === 0) {
        const month = inferredMonth?.month || sessionContext?.month
        const year = inferredMonth?.year || sessionContext?.year
        if (!month || !year) {
            return respond(
                language === 'en' ? 'Ok, which month is that for?' : 'Dale, de que mes hablamos?',
                { context: sessionContext || {} },
                { intentSummary: 'awaiting_month', frictionAction: 'increase' }
            )
        }
        const start = moment({ year, month: month - 1, day: dayRange.startDay })
        let endMonth = month - 1
        let endYear = year
        if (dayRange.endDay < dayRange.startDay) {
            const rollover = start.clone().add(1, 'month')
            endMonth = rollover.month()
            endYear = rollover.year()
        }
        const end = moment({ year: endYear, month: endMonth, day: dayRange.endDay })
        if (!start.isValid() || !end.isValid()) {
            return respond(
                language === 'en'
                    ? 'To check availability I need exact dates in YYYY-MM-DD format.'
                    : 'Para chequear necesito fechas exactas en formato YYYY-MM-DD.',
                undefined,
                { intentSummary: 'awaiting_dates', frictionAction: 'increase' }
            )
        }
        const startStr = start.format('YYYY-MM-DD')
        const endStr = end.format('YYYY-MM-DD')
        const availabilityScope = sessionContext?.hotelId || sessionContext?.sede ? 'sede' : 'global'
        const availability = await checkAvailability({
            start: startStr,
            end: endStr,
            sede: sessionContext?.sede as string | undefined,
            hotelId: sessionContext?.hotelId as string | undefined,
            roomType: sessionContext?.roomType as string | undefined,
            guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
        })
        if (!availability.ok) {
            const contextUpdatePayload = { month, year, start: startStr, end: endStr, availabilityOk: false, availabilityScope }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(
                buildNoAvailabilityAnswer(language),
                { context: { month, year, start: startStr, end: endStr } },
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }
        const okAvailability = availability as {
            available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
        }
        const options = (okAvailability.available || [])
            .slice(0, 4)
            .map((item) => formatAvailabilityOption(item, language))
        if (!options.length) {
            const contextUpdatePayload = { month, year, start: startStr, end: endStr, availabilityOk: false, availabilityScope }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            const minNightsAnswer = buildMinNightsAnswer(
                availability as { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> },
                language
            )
            if (minNightsAnswer) {
                return respond(
                    minNightsAnswer,
                    { context: { month, year, start: startStr, end: endStr } },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const suggestion = await buildNearbyAvailabilitySuggestion({
                start: startStr,
                nights: requestedNights,
                language,
                sede: sessionContext?.sede as string | undefined,
                hotelId: sessionContext?.hotelId as string | undefined,
                roomType: sessionContext?.roomType as string | undefined,
                guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
            })
            if (suggestion) {
                return respond(
                    suggestion,
                    { context: { month, year, start: startStr, end: endStr } },
                    { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
                )
            }
            return respond(
                buildNoAvailabilityAnswer(language),
                { context: { month, year, start: startStr, end: endStr } },
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }
        const contextUpdatePayload = { month, year, start: startStr, end: endStr, availabilityOk: true, availabilityScope }
        await updateSessionContext(input.sessionId, contextUpdatePayload)
        sessionContext = { ...sessionContext, ...contextUpdatePayload }
        return respond(
            buildAvailabilityOptionsAnswer(options, language, sessionContext?.lastReplyKind === 'availability'),
            { context: { month, year, start: startStr, end: endStr } },
            { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
        )
    }

    if (resolvedDates.length >= 2 && bookingIntent) {
        const needsLocation = !sessionContext?.hotelId && !sessionContext?.sede
        const needsRoomType = !sessionContext?.roomType
        const needsGuests = typeof sessionContext?.guests !== 'number'
        if (needsLocation || needsRoomType || needsGuests) {
            const question = buildMissingDetailsQuestion({ language, needsLocation, needsRoomType, needsGuests })
            if (question) {
                return respond(question, { context: sessionContext }, { intentSummary: 'awaiting_details', frictionAction: 'increase' })
            }
        }
    }

    if (!explicitDates.length && sessionContext?.start && sessionContext?.end) {
        if (normalized.includes('otra') || normalized.includes('otras') || normalized.includes('alternativa') || normalized.includes('opcion')) {
            const availability = await checkAvailability({ start: sessionContext.start, end: sessionContext.end })
            if (!availability.ok) {
                const contextUpdatePayload = { availabilityOk: false, availabilityScope: 'global' }
                await updateSessionContext(input.sessionId, contextUpdatePayload)
                sessionContext = { ...sessionContext, ...contextUpdatePayload }
                return respond(
                    buildNoAvailabilityAnswer(language),
                    { context: sessionContext },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const okAvailability = availability as {
                available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
            }
        const options = (okAvailability.available || [])
            .slice(0, 4)
            .map((item) => formatAvailabilityOption(item, language))
            if (!options.length) {
                const contextUpdatePayload = { availabilityOk: false, availabilityScope: 'global' }
                await updateSessionContext(input.sessionId, contextUpdatePayload)
                sessionContext = { ...sessionContext, ...contextUpdatePayload }
                const minNightsAnswer = buildMinNightsAnswer(
                    availability as { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> },
                    language
                )
                if (minNightsAnswer) {
                    return respond(
                        minNightsAnswer,
                        { context: sessionContext },
                        { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                    )
                }
                const suggestion = await buildNearbyAvailabilitySuggestion({
                    start: String(sessionContext.start),
                    nights: requestedNights,
                    language
                })
                if (suggestion) {
                    return respond(
                        suggestion,
                        { context: sessionContext },
                        { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
                    )
                }
                return respond(
                    buildNoAvailabilityAnswer(language),
                    { context: sessionContext },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const contextUpdatePayload = { availabilityOk: true, availabilityScope: 'global' }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(
                language === 'en'
                    ? `Other options:\n${formatBulletList(options)}`
                    : `Otras opciones:\n${formatBulletList(options)}`,
                { context: sessionContext },
                { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
            )
        }
    }

    const hasReservationContext =
        sessionContext?.start &&
        sessionContext?.end &&
        (sessionContext?.hotelId || sessionContext?.sede) &&
        sessionContext?.roomType

    const buildAckReply = (intentSummary?: string) => {
        if (!intentSummary) return ''
        if (intentSummary === 'awaiting_dates') {
            return language === 'en' ? 'Share the exact dates you want.' : 'Pasame las fechas exactas.'
        }
        if (intentSummary === 'awaiting_month') {
            return language === 'en' ? 'Which month is it for?' : 'De que mes hablamos?'
        }
        if (intentSummary === 'awaiting_location') {
            return language === 'en' ? 'Which location works best?' : 'Que sede te queda mejor?'
        }
        if (intentSummary === 'awaiting_room_type') {
            return language === 'en' ? 'Which room type do you want?' : 'Que tipo de habitacion queres?'
        }
        if (intentSummary === 'availability_options') {
            return language === 'en' ? 'Which option do you want to book?' : 'Decime cual opcion queres reservar.'
        }
        if (intentSummary === 'awaiting_contact') {
            return language === 'en'
                ? 'Share your full name, email, and payment method.'
                : 'Pasame nombre completo, email y metodo de pago.'
        }
        if (intentSummary === 'awaiting_details') {
            return language === 'en'
                ? 'Share location, room type, and guest count.'
                : 'Decime sede, tipo de habitacion y cantidad de personas.'
        }
        if (intentSummary === 'awaiting_intent') {
            return language === 'en'
                ? 'Do you want a quote, policies, or to book?'
                : 'Queres cotizacion, politicas o reservar?'
        }
        if (intentSummary === 'awaiting_confirm') {
            return language === 'en' ? 'Confirm it and I will book it.' : 'Confirmalo y lo reservo.'
        }
        return ''
    }

    const shortAckReply = isShortAck ? buildAckReply(String(sessionContext?.lastIntentSummary || '')) : ''
    if (
        shortAckReply &&
        !explicitDates.length &&
        !dayRange &&
        !relativeRange &&
        !detectedHotel &&
        !detectedRoomType &&
        !detectedEmail &&
        !detectedName
    ) {
        return respond(shortAckReply, { context: sessionContext })
    }

    if (
        sessionContext?.start &&
        sessionContext?.end &&
        isShortAck
    ) {
        const needsLocation = !sessionContext?.hotelId && !sessionContext?.sede
        const needsRoomType = !sessionContext?.roomType
        const needsGuests = typeof sessionContext?.guests !== 'number'
        if (sessionContext?.availabilityOk === false) {
            return respond(buildNoAvailabilityAnswer(language), { context: sessionContext }, { replyKind: 'availability', intentSummary: 'availability_none' })
        }
        if (needsLocation || needsRoomType || needsGuests) {
            const sedes = Array.from(new Set(hotels.map((hotel) => hotel.sede).filter(Boolean)))
            const question = buildMissingDetailsQuestion({ language, needsLocation, needsRoomType, needsGuests })
            const suffix = needsLocation && sedes.length ? ` ${language === 'en' ? 'Options:' : 'Opciones:'} ${sedes.join(', ')}.` : ''
            return respond(`${question}${suffix}`, { context: sessionContext }, { intentSummary: 'awaiting_details' })
        }
    }

    if (detectedRoomType && hasReservationContext && !detectedEmail && !detectedName) {
        if (sessionContext?.availabilityOk === false) {
            return respond(buildNoAvailabilityAnswer(language), { context: sessionContext }, { replyKind: 'availability', intentSummary: 'availability_none' })
        }
        if (sessionContext?.availabilityOk !== true) {
            const availability = await checkAvailability({
                start: String(sessionContext.start),
                end: String(sessionContext.end),
                sede: sessionContext?.sede as string | undefined,
                hotelId: sessionContext?.hotelId as string | undefined,
                roomType: sessionContext?.roomType as string | undefined,
                guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
            })
            const okAvailability = availability as {
                available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
            }
            if (!availability.ok || !(okAvailability.available || []).length) {
                const minNightsAnswer = buildMinNightsAnswer(
                    availability as { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> },
                    language
                )
                const contextUpdatePayload = {
                    availabilityOk: false,
                    availabilityScope: sessionContext?.hotelId || sessionContext?.sede ? 'sede' : 'global'
                }
                await updateSessionContext(input.sessionId, contextUpdatePayload)
                sessionContext = { ...sessionContext, ...contextUpdatePayload }
                return respond(
                    minNightsAnswer || buildNoAvailabilityAnswer(language),
                    { context: sessionContext },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const contextUpdatePayload = {
                availabilityOk: true,
                availabilityScope: sessionContext?.hotelId || sessionContext?.sede ? 'sede' : 'global'
            }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
        }
        if (!bookingIntent && !isShortAck) {
            const stayLabel = formatStaySpan(String(sessionContext.start), String(sessionContext.end), language)
            return respond(
                language === 'en'
                    ? `I can reserve ${sessionContext.roomType} with ${stayLabel}. Want me to book it?`
                    : `Puedo reservar ${sessionContext.roomType} con ${stayLabel}. Queres que lo reserve?`,
                { context: sessionContext },
                { intentSummary: 'awaiting_confirm', frictionAction: 'increase' }
            )
        }
        const stayLabel = formatStaySpan(String(sessionContext.start), String(sessionContext.end), language)
        return respond(
            language === 'en'
                ? `Great, I have ${sessionContext.roomType} with ${stayLabel}. Share your full name, email, and payment method and I will confirm.`
                : `Listo, tengo ${sessionContext.roomType} con ${stayLabel}. Pasame nombre completo, email y metodo de pago y lo confirmo.`,
            { context: sessionContext },
            { intentSummary: 'awaiting_contact', frictionAction: 'reset' }
        )
    }

    if (hasReservationContext && (detectedEmail || detectedName || sessionContext?.email || sessionContext?.name)) {
        const name = detectedName || String(sessionContext?.name || '')
        const email = detectedEmail || String(sessionContext?.email || '')
        if (!email) {
            return respond(
                language === 'en' ? 'Great, what email should I use for the reservation?' : 'Genial, pasame el email para la reserva.',
                { context: sessionContext },
                { intentSummary: 'awaiting_contact' }
            )
        }
        if (!name) {
            return respond(
                language === 'en' ? 'Ok, what name should I put on the reservation?' : 'Dale, a nombre de quien va la reserva?',
                { context: sessionContext },
                { intentSummary: 'awaiting_contact' }
            )
        }
        if (!detectedPaymentMethod && !sessionContext?.paymentMethod) {
            return respond(
                language === 'en'
                    ? 'Which payment method do you prefer? (card, transfer, cash)'
                    : 'Dale, que metodo de pago preferis? (tarjeta, transferencia, efectivo)',
                { context: sessionContext },
                { intentSummary: 'awaiting_contact' }
            )
        }

        const paymentMethod = detectedPaymentMethod || String(sessionContext?.paymentMethod || '')
        if (!sessionContext?.pendingReservationConfirm) {
            const recap = buildReservationRecap(
                {
                    start: String(sessionContext.start),
                    end: String(sessionContext.end),
                    sede: String(sessionContext.sede || ''),
                    hotelId: String(sessionContext.hotelId || ''),
                    roomType: String(sessionContext.roomType || ''),
                    guests: typeof detectedGuests === 'number' ? detectedGuests : Number(sessionContext.guests || 0) || undefined,
                    paymentMethod,
                    earlyCheckin: Boolean(sessionContext.earlyCheckin),
                    lateCheckout: Boolean(sessionContext.lateCheckout),
                    preferences: String(sessionContext.preferences || '')
                },
                language
            )
            const contextUpdatePayload = { pendingReservationConfirm: true }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(recap, { context: sessionContext }, { intentSummary: 'awaiting_confirm' })
        }

        const result = await createReservation({
            name,
            email,
            start: String(sessionContext.start),
            end: String(sessionContext.end),
            sede: String(sessionContext.sede || ''),
            hotelId: String(sessionContext.hotelId || ''),
            roomType: String(sessionContext.roomType || ''),
            guests: typeof detectedGuests === 'number' ? detectedGuests : Number(sessionContext.guests || 0) || undefined,
            paymentMethod,
            earlyCheckin: Boolean(sessionContext.earlyCheckin),
            lateCheckout: Boolean(sessionContext.lateCheckout),
            preferences: String(sessionContext.preferences || '')
        })
        if (sessionContext?.pendingReservationConfirm) {
            const clearPayload = { pendingReservationConfirm: false }
            await updateSessionContext(input.sessionId, clearPayload)
            sessionContext = { ...sessionContext, ...clearPayload }
        }

        if (!result.ok) {
            const reservationFailure = result as {
                reason?: string
                minNights?: number
                maxGuests?: number
                policyNote?: string
                lockDays?: number
            }
            const baseAnswer = buildReservationFailureAnswer({
                reason: reservationFailure.reason,
                minNights: reservationFailure.minNights,
                maxGuests: reservationFailure.maxGuests,
                policyNote: reservationFailure.policyNote,
                lockDays: reservationFailure.lockDays,
                language
            })
            const shouldSuggestAlternatives = ['sold_out', 'missing_dates', 'blocked'].includes(String(reservationFailure.reason || ''))
            const answer = shouldSuggestAlternatives
                ? `${baseAnswer} ${language === 'en' ? 'Want me to check nearby dates?' : 'Queres que busque fechas cercanas?'}`
                : baseAnswer
            return respond(
                answer,
                { context: sessionContext },
                { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
            )
        }

        const reservationSummarySource = result.reservation as {
            hotelName?: string
            sede?: string
            habitacionTipo?: string
            checkIn?: string
            checkOut?: string
            huespedes?: number
            earlyCheckin?: boolean
            lateCheckout?: boolean
        } | null

        const summaryLine = buildReservationSummaryLine(
            {
                hotelName: reservationSummarySource?.hotelName,
                sede: reservationSummarySource?.sede,
                roomType: reservationSummarySource?.habitacionTipo,
                checkIn: reservationSummarySource?.checkIn,
                checkOut: reservationSummarySource?.checkOut,
                guests: reservationSummarySource?.huespedes,
                earlyCheckin: reservationSummarySource?.earlyCheckin,
                lateCheckout: reservationSummarySource?.lateCheckout
            },
            language
        )
        const confirmationLine =
            language === 'en'
                ? `All set, reservation confirmed. Your ID is ${result.reservation?.id}.`
                : `Listo, reserva confirmada. Tu ID es ${result.reservation?.id}.`
        return respondWith(
            {
                answer: summaryLine ? `${confirmationLine}\n\n${summaryLine}` : confirmationLine,
                metadata: {
                    ...(result as { confirmation?: any; reservation?: any; fees?: any; promos?: any }).confirmation
                        ? {
                              type: 'reservationCard',
                              reservation: result.reservation,
                              confirmation: result.confirmation,
                              fees: result.fees,
                              promos: result.promos,
                              context: sessionContext
                          }
                        : { context: sessionContext }
                }
            },
            { intentSummary: 'reservation_confirmed', frictionAction: 'reset' }
        )
    }

    if (!bookingIntent && !explicitDates.length) {
        const wantsHotelCatalog =
            normalized.includes('catalogo') ||
            normalized.includes('lista') ||
            normalized.includes('hoteles') ||
            normalized.includes('sedes')
        if (wantsHotelCatalog) {
            const lines = hotels.map((hotel) => {
                const name = hotel.nombre || 'Hotel Gran Sol'
                const sede = hotel.sede ? ` (${hotel.sede})` : ''
                const location = hotel.ubicacion ? ` - ${hotel.ubicacion}` : ''
                return `- ${name}${sede}${location}`
            })
            if (lines.length) {
                return respond(
                    language === 'en' ? `Hotels:\n${formatBulletList(lines)}` : `Aca tenes hoteles:\n${formatBulletList(lines)}`,
                    undefined,
                    { intentSummary: 'awaiting_location', frictionAction: 'reset' }
                )
            }
        }

        const wantsRoomCatalog =
            normalized.includes('habitacion') ||
            normalized.includes('habitaciones') ||
            normalized.includes('tipo de habitacion') ||
            normalized.includes('tipos de habitacion') ||
            normalized.includes('room type') ||
            normalized.includes('room types')
        if (wantsRoomCatalog) {
            const reference = detectedHotel?.hotelId || detectedHotel?.sede || sessionContext?.hotelId || sessionContext?.sede || ''
            const targetHotel = reference ? findHotelByQuery(hotels, reference)[0] : hotels.length === 1 ? hotels[0] : null
            if (!targetHotel) {
                return respond(
                    language === 'en' ? 'Which location do you want room types for?' : 'De que sede queres ver las habitaciones?',
                    undefined,
                    { intentSummary: 'awaiting_location' }
                )
            }
            const perNightLabel = language === 'en' ? 'per night' : 'por noche'
            const capacityLabel = language === 'en' ? 'capacity' : 'capacidad'
            const rooms = (targetHotel.habitaciones || []).map((room) => {
                const name = room.tipo || (language === 'en' ? 'room' : 'habitacion')
                const capacity = room.capacidad ? `${capacityLabel} ${room.capacidad}` : ''
                const price = room.tarifaBase ? `${formatMoney(room.tarifaBase, room.moneda)} ${perNightLabel}` : ''
                const details = [capacity, price].filter(Boolean).join(' - ')
                return `- ${name}${details ? ` - ${details}` : ''}`
            })
            if (rooms.length) {
                return respond(
                    language === 'en'
                        ? `Room types at ${targetHotel.nombre || targetHotel.sede}:\n${formatBulletList(rooms)}`
                        : `Aca tenes tipos de habitaciones en ${targetHotel.nombre || targetHotel.sede}:\n${formatBulletList(rooms)}`,
                    undefined,
                    { intentSummary: 'awaiting_room_type', frictionAction: 'reset' }
                )
            }
        }
    }

    try {
        if (resolvedDates.length >= 2 && !bookingIntent) {
            const start = resolvedDates[0].format('YYYY-MM-DD')
            const end = resolvedDates[1].format('YYYY-MM-DD')
            const availabilityScope = sessionContext?.hotelId || sessionContext?.sede ? 'sede' : 'global'
            const availability = await checkAvailability({
                start,
                end,
                sede: sessionContext?.sede as string | undefined,
                hotelId: sessionContext?.hotelId as string | undefined,
                roomType: sessionContext?.roomType as string | undefined,
                guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
            })
            if (!availability.ok) {
                const contextUpdatePayload = { start, end, availabilityOk: false, availabilityScope }
                await updateSessionContext(input.sessionId, contextUpdatePayload)
                sessionContext = { ...sessionContext, ...contextUpdatePayload }
                return respond(
                    buildNoAvailabilityAnswer(language),
                    { context: { start, end } },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const okAvailability = availability as {
                available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
            }
            const options = (okAvailability.available || [])
                .slice(0, 4)
                .map((item) => formatAvailabilityOption(item, language))
            if (!options.length) {
                const contextUpdatePayload = { start, end, availabilityOk: false, availabilityScope }
                await updateSessionContext(input.sessionId, contextUpdatePayload)
                sessionContext = { ...sessionContext, ...contextUpdatePayload }
                const minNightsAnswer = buildMinNightsAnswer(
                    availability as { nights?: number; minNights?: number; minRule?: MinNightsRule; suggestedRanges?: Array<{ start: string; end: string }> },
                    language
                )
                if (minNightsAnswer) {
                    return respond(
                        minNightsAnswer,
                        { context: { start, end } },
                        { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                    )
                }
                const suggestion = await buildNearbyAvailabilitySuggestion({
                    start,
                    nights: requestedNights,
                    language,
                    sede: sessionContext?.sede as string | undefined,
                    hotelId: sessionContext?.hotelId as string | undefined,
                    roomType: sessionContext?.roomType as string | undefined,
                    guests: typeof sessionContext?.guests === 'number' ? (sessionContext.guests as number) : undefined
                })
                if (suggestion) {
                    return respond(
                        suggestion,
                        { context: { start, end } },
                        { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
                    )
                }
                return respond(
                    buildNoAvailabilityAnswer(language),
                    { context: { start, end } },
                    { replyKind: 'availability', intentSummary: 'availability_none', frictionAction: 'reset' }
                )
            }
            const contextUpdatePayload = { start, end, availabilityOk: true, availabilityScope }
            await updateSessionContext(input.sessionId, contextUpdatePayload)
            sessionContext = { ...sessionContext, ...contextUpdatePayload }
            return respond(
                buildAvailabilityOptionsAnswer(options, language, sessionContext?.lastReplyKind === 'availability'),
                { context: { start, end } },
                { replyKind: 'availability', intentSummary: 'availability_options', frictionAction: 'reset' }
            )
        }

        const response = await runLlmFlow(message, input.sessionId, rules, hotels, language, sessionMessages)
        const contextMetadata = inferredMonth
            ? { month: inferredMonth.month, year: inferredMonth.year }
            : resolvedDates.length >= 2
            ? { start: resolvedDates[0].format('YYYY-MM-DD'), end: resolvedDates[1].format('YYYY-MM-DD') }
            : undefined
        if (contextMetadata) {
            await updateSessionContext(input.sessionId, contextMetadata)
            return respondWith({ ...response, metadata: { ...(response.metadata || {}), context: contextMetadata } })
        }
        return respondWith(response)
    } catch (_error) {
        const fallback = await handleHotelFallback(input, language)
        return respondWith(fallback, { frictionAction: 'increase' })
    }
}

export const __test__ = {
    parseShortDate,
    findAmbiguousShortDate,
    extractDates,
    resolveActivitiesDate,
    buildDailyActivitiesAnswer,
    extractReservationId,
    extractReminderAt,
    extractStayLengthDetails,
    resolveCancellationLockDays,
    buildMinNightsAnswer,
    buildNoAvailabilityAnswer,
    buildReservationFailureAnswer,
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
    isUnsupportedMockDataQuestion
}

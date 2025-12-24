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

const parseDate = (value: string) => moment(value, 'YYYY-MM-DD', true)

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

const extractDayRange = (message: string) => {
    const text = normalizeText(message)
    const match =
        text.match(/\bdel?\s*(\d{1,2})\s*(al|hasta|-)\s*(\d{1,2})\b/) ||
        text.match(/\bfrom\s*(\d{1,2})\s*(to|-)\s*(\d{1,2})\b/)
    if (!match) return null
    const startDay = Number(match[1])
    const endDay = Number(match[3])
    if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return null
    return { startDay, endDay }
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

const buildContextFromMessages = (messages: Array<{ metadata?: Record<string, any> }>) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const context = messages[i]?.metadata?.context
        if (context) return context
    }
    return {}
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
        huespedes: input.guests || room.capacidad || 1,
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
        huespedes: input.guests ?? existing.huespedes,
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

const cancelReservation = async (input: { reservationId?: string; reason?: string }) => {
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
    const rateType = existing.tarifaTipo || 'refundable'
    const policy = findPolicyRule(rules.cancelacion, rateType, daysUntil)
    const penaltyPct = policy?.penalidadPorc || 0
    const penaltyAmount = (existing.precioTotal || 0) * (penaltyPct / 100)

    await reservations.updateOne(
        { agentId: HOTEL_AGENT_ID, id: input.reservationId },
        {
            $set: {
                status: 'cancelled',
                updatedAt: new Date(),
                cancelacion: {
                    motivo: input.reason || 'sin_detalle',
                    penalidadPorc: penaltyPct,
                    penalidadMonto: penaltyAmount,
                    fecha: new Date()
                }
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
            id: existing.id,
            status: 'cancelled',
            penaltyPct,
            penaltyAmount,
            currency: existing.moneda || 'USD',
            note: policy?.nota || ''
        }
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
    const englishHits = ['hello', 'hi', 'please', 'book', 'reserve', 'reservation', 'room', 'price', 'cancel', 'change']
    const spanishHits = ['hola', 'por favor', 'reserva', 'reservar', 'habitacion', 'precio', 'cancelar', 'cambiar', 'desayuno']
    const hasEnglish = englishHits.some((word) => text.includes(word))
    const hasSpanish = spanishHits.some((word) => text.includes(word))
    if (hasEnglish && !hasSpanish) return 'en'
    if (hasSpanish && !hasEnglish) return 'es'
    return 'es'
}

const formatBulletList = (items: string[]) => items.join('\n\n')

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
        'Referencia temporal: hoy es 2025-12-24.',
        `Sedes: ${sedes.join(', ') || 'Centro, Palermo, Aeropuerto'}.`,
        `Check-in ${checkIn}. Check-out ${checkOut}.`,
        early,
        late,
        minRules ? `Reglas de estadia minima: ${minRules}.` : '',
        'Gestionas reservas, cambios, cancelaciones, leads, vouchers, pagos y pedidos de servicio.',
        language === 'en'
            ? 'If info is missing (dates, location, room type, guest count), ask only what is needed.'
            : 'Si faltan datos (fechas, sede, habitacion, cantidad de huespedes), pregunta solo lo necesario.',
        language === 'en'
            ? 'Stay on hotel topics only. Decline off-topic requests and redirect to reservations or guest support.'
            : 'No te desvias del rol hotelero: rechaza temas fuera de hoteleria (deportes, medicina, finanzas, etc.) y redirigi a reservas o atencion al huesped.',
        language === 'en'
            ? 'Use tools for availability, rules, info, services, profiles, support, promos, and reservations. Do not invent data.'
            : 'Usa herramientas para disponibilidad, reglas, info, servicios, perfiles, soporte, promos y reservas. No inventes datos.',
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
                const result = await cancelReservation({ reservationId: args.reservationId, reason: args.reason })
                if (result.ok) {
                    return { output: result, metadata: { type: 'reservationCancel', cancellation: result.cancellation } }
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
                    return { output: result, metadata: { type: 'serviceRequest', reservationId: args.reservationId } }
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
                answer: (assistant.content || '').trim() || 'No pude procesar tu consulta.',
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

    return { answer: 'No pude procesar tu consulta.', metadata }
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

    const [rules, faqDoc, hotels] = await Promise.all([getHotelRules(), getHotelFaq(), getHotelInventory()])
    const faqAnswer = findFaqAnswer(faqDoc.faq || [], message)
    if (faqAnswer) {
        return { answer: faqAnswer }
    }

    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch) {
        const profile = await getGuestProfile({ email: emailMatch[0] })
        if (profile) {
            const prefs = profile.preferencias?.join(', ') || 'sin preferencias registradas'
            return {
                answer:
                    language === 'en'
                        ? `I have your profile. Preferences: ${prefs}. Want me to apply them to the booking?`
                        : `Tengo tu perfil. Preferencias: ${prefs}. Queres que las aplique a la reserva?`
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
                        ? `${info.nombre || 'Hotel Gran Sol'}: ${info.ubicacion || ''}. Map: ${info.mapaUrl || ''}`.trim()
                        : `${info.nombre || 'Hotel Gran Sol'}: ${info.ubicacion || ''}. Mapa: ${info.mapaUrl || ''}`.trim()
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
                        ? `Available services:\n${formatBulletList(lines)}`
                        : `Servicios disponibles:\n${formatBulletList(lines)}`
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
                        ? `Internal protocols available:\n${formatBulletList(protocols)}`
                        : `Protocolos internos disponibles:\n${formatBulletList(protocols)}`
            }
        }
    }

    if (lower.includes('precio') || lower.includes('tarifa')) {
        const hotel = hotels[0]
        const rooms = (hotel?.habitaciones || []).slice(0, 3).map((room) => {
            return `- ${room.tipo || 'habitacion'}: ${formatMoney(room.tarifaBase, room.moneda)}`
        })
        return {
            answer:
                language === 'en'
                    ? rooms.length
                        ? `Base nightly rates:\n${formatBulletList(rooms)}`
                        : 'I can quote prices if you share dates and location.'
                    : rooms.length
                    ? `Tarifas base por noche:\n${formatBulletList(rooms)}`
                    : 'Puedo cotizar si me indicas fechas y sede.'
        }
    }

    const dates = extractDates(message)
    if (dates.length) {
        const startStr = dates[0].format('YYYY-MM-DD')
        const endStr = dates[1]?.format('YYYY-MM-DD')
        const availability = await checkAvailability({ start: startStr, end: endStr, sede: input.metadata?.sede as string | undefined })
        if (!availability.ok) {
            return {
                answer:
                    language === 'en'
                        ? 'No availability for those dates. Want to try another location or nearby dates?'
                        : 'No tengo disponibilidad para esas fechas. Queres probar otra sede o fechas cercanas?'
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
            return {
                answer:
                    language === 'en'
                        ? `Those dates require at least ${okAvailability.minNights} nights. Options: ${
                              ranges.join(' | ') || 'adjust dates'
                          }.`
                        : `Para esas fechas se requieren al menos ${okAvailability.minNights} noches. Opciones: ${
                              ranges.join(' | ') || 'ajustar fechas'
                          }.`
            }
        }
        if (!okAvailability.available?.length) {
            const alternativeLines = (okAvailability.alternatives || []).map((alt: any) => {
                return `- ${alt.hotelName || alt.sede} ${alt.roomType || ''}`.trim()
            })
            if (alternativeLines.length) {
                return {
                    answer:
                        language === 'en'
                            ? `No availability in that location. Options in other locations:\n${formatBulletList(alternativeLines)}`
                            : `No hay disponibilidad en esa sede. Opciones en otras sedes:\n${formatBulletList(alternativeLines)}`
                }
            }
            return {
                answer:
                    language === 'en'
                        ? 'No availability for those dates. I can suggest other options.'
                        : 'No hay disponibilidad en esas fechas. Puedo sugerirte otras opciones.'
            }
        }
        const options = okAvailability.available
            .slice(0, 4)
            .map((item: any) => `- ${item.hotelName || item.sede} ${item.roomType}: desde ${formatMoney(item.baseRate, item.currency)}`)
        return {
            answer:
                language === 'en'
                    ? `Availability for those dates:\n${formatBulletList(options)}`
                    : `Hay disponibilidad para esas fechas:\n${formatBulletList(options)}`
        }
    }

    if (lower.includes('reserv')) {
        return {
            answer:
                language === 'en'
                    ? 'To book I need dates, location, room type, and guest count.'
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
                    ? 'To reissue a voucher I need the reservation ID.'
                    : 'Para reemitir el voucher necesito el ID de la reserva.'
        }
    }

    if (lower.includes('cancel')) {
        return {
            answer:
                language === 'en'
                    ? 'I can help cancel. I need the reservation ID or email.'
                    : 'Puedo ayudarte a cancelar. Necesito el ID de reserva o el email.'
        }
    }

    if (lower.includes('cambiar') || lower.includes('modificar')) {
        return {
            answer:
                language === 'en'
                    ? 'I can modify your booking. I need the ID and the new dates or room type.'
                    : 'Puedo modificar tu reserva. Necesito el ID y las nuevas fechas o habitacion.'
        }
    }

    if (lower.includes('toalla') || lower.includes('limpieza') || lower.includes('amenit') || lower.includes('room service')) {
        return {
            answer:
                language === 'en'
                    ? 'Got it. I can register the request. Share the reservation ID and service details.'
                    : 'Listo, puedo registrar el pedido. Decime el ID de reserva y el detalle del servicio.'
        }
    }

    const checkIn = rules.horarios?.checkin || '15:00'
    const checkOut = rules.horarios?.checkout || '11:00'
    const summary =
        language === 'en'
            ? `I'm Freia, Hotel Gran Sol assistant. I handle bookings, changes, cancellations, and services. Check-in ${checkIn}, check-out ${checkOut}.`
            : `Soy Freia, asistente de Hotel Gran Sol. Gestiono reservas, cambios, cancelaciones y servicios. Check-in ${checkIn}, check-out ${checkOut}.`
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
                reason: { type: 'string' }
            },
            required: ['reservationId']
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
    const sessionMessages = await getSessionMessages(input.sessionId)
    const sessionContext = buildContextFromMessages(sessionMessages)
    const language = getSessionLanguage(sessionMessages, input.message || '')
    const message = input.message || ''
    const normalized = normalizeText(message)
    const bookingIntent =
        normalized.includes('reserv') || normalized.includes('book') || normalized.includes('reserve') || normalized.includes('booking')
    const explicitDates = extractDates(message)
    const inferredMonth = findMonthInText(message)
    const dayRange = extractDayRange(message)

    if (inferredMonth && explicitDates.length === 0 && !dayRange) {
        return {
            answer:
                language === 'en'
                    ? `Got it. For ${moment({ year: inferredMonth.year, month: inferredMonth.month - 1, day: 1 }).format('MMMM')} I need exact dates. For example: from 5 to 10.`
                    : `Dale. Para ${moment({ year: inferredMonth.year, month: inferredMonth.month - 1, day: 1 }).format('MMMM')} necesito fechas exactas. Por ejemplo: del 5 al 10.`,
            metadata: { context: { month: inferredMonth.month, year: inferredMonth.year } }
        }
    }

    if (dayRange && explicitDates.length === 0) {
        const month = inferredMonth?.month || sessionContext?.month
        const year = inferredMonth?.year || sessionContext?.year
        if (!month || !year) {
            return {
                answer: language === 'en' ? 'Which month is that for?' : 'De que mes hablamos?',
                metadata: { context: sessionContext || {} }
            }
        }
        const start = moment({ year, month: month - 1, day: dayRange.startDay })
        const end = moment({ year, month: month - 1, day: dayRange.endDay })
        if (!start.isValid() || !end.isValid()) {
            return {
                answer: language === 'en' ? 'I need exact dates in YYYY-MM-DD format.' : 'Necesito fechas exactas en formato YYYY-MM-DD.'
            }
        }
        const availability = await checkAvailability({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') })
        if (!availability.ok) {
            return {
                answer:
                    language === 'en'
                        ? 'No availability for those dates. Want to try another location or nearby dates?'
                        : 'No tengo disponibilidad para esas fechas. Queres probar otra sede o fechas cercanas?',
                metadata: { context: { month, year, start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') } }
            }
        }
        const okAvailability = availability as {
            available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
        }
        const options = (okAvailability.available || [])
            .slice(0, 4)
            .map((item) => `- ${item.hotelName || item.sede} ${item.roomType}: desde ${formatMoney(item.baseRate, item.currency)}`)
        return {
            answer:
                language === 'en'
                    ? `Availability for those dates:\n${formatBulletList(options)}`
                    : `Hay disponibilidad para esas fechas:\n${formatBulletList(options)}`,
            metadata: { context: { month, year, start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') } }
        }
    }

    if (!explicitDates.length && sessionContext?.start && sessionContext?.end) {
        if (normalized.includes('otra') || normalized.includes('otras') || normalized.includes('alternativa') || normalized.includes('opcion')) {
            const availability = await checkAvailability({ start: sessionContext.start, end: sessionContext.end })
            if (availability.ok) {
                const okAvailability = availability as {
                    available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
                }
                const options = (okAvailability.available || [])
                    .slice(0, 4)
                    .map((item) => `- ${item.hotelName || item.sede} ${item.roomType}: desde ${formatMoney(item.baseRate, item.currency)}`)
                return {
                    answer:
                        language === 'en'
                            ? `Other options for those dates:\n${formatBulletList(options)}`
                            : `Otras opciones para esas fechas:\n${formatBulletList(options)}`,
                    metadata: { context: sessionContext }
                }
            }
        }
    }

    try {
        if (explicitDates.length >= 2 && !bookingIntent) {
            const start = explicitDates[0].format('YYYY-MM-DD')
            const end = explicitDates[1].format('YYYY-MM-DD')
            const availability = await checkAvailability({ start, end })
            if (!availability.ok) {
                return {
                    answer:
                        language === 'en'
                            ? 'No availability for those dates. Want to try another location or nearby dates?'
                            : 'No tengo disponibilidad para esas fechas. Queres probar otra sede o fechas cercanas?',
                    metadata: { context: { start, end } }
                }
            }
            const okAvailability = availability as {
                available?: Array<{ hotelName?: string; sede?: string; roomType?: string; baseRate?: number; currency?: string }>
            }
            const options = (okAvailability.available || [])
                .slice(0, 4)
                .map((item) => `- ${item.hotelName || item.sede} ${item.roomType}: desde ${formatMoney(item.baseRate, item.currency)}`)
            return {
                answer:
                    language === 'en'
                        ? `Availability for those dates:\n${formatBulletList(options)}`
                        : `Hay disponibilidad para esas fechas:\n${formatBulletList(options)}`,
                metadata: { context: { start, end } }
            }
        }

        const response = await runLlmFlow(message, input.sessionId, rules, hotels, language, sessionMessages)
        const contextMetadata = inferredMonth
            ? { month: inferredMonth.month, year: inferredMonth.year }
            : explicitDates.length >= 2
            ? { start: explicitDates[0].format('YYYY-MM-DD'), end: explicitDates[1].format('YYYY-MM-DD') }
            : undefined
        if (contextMetadata) {
            return { ...response, metadata: { ...(response.metadata || {}), context: contextMetadata } }
        }
        return response
    } catch (_error) {
        return handleHotelFallback(input, language)
    }
}

import fs from 'fs'
import path from 'path'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'

const HOTEL_AGENT_ID = 'gran-sol'

type HotelInventorySeed = {
    hoteles?: Array<Record<string, any>>
}

type HotelAvailabilitySeed = {
    disponibilidad?: Array<Record<string, any>>
    calendario?: Array<Record<string, any>>
}

type HotelRulesSeed = Record<string, any>
type HotelFaqSeed = Record<string, any>
type HotelReservationsSeed = { reservas?: Array<Record<string, any>> }
type HotelInfoSeed = { hoteles?: Array<Record<string, any>> }
type HotelServicesSeed = { servicios?: Array<Record<string, any>>; amenities?: Array<Record<string, any>> }
type HotelGuestSeed = { huespedes?: Array<Record<string, any>> }
type HotelSupportSeed = { protocolos?: Array<Record<string, any>>; manuales?: Array<Record<string, any>> }
type HotelPromosSeed = { promociones?: Array<Record<string, any>> }
type HotelLeadsSeed = { leads?: Array<Record<string, any>> }

type ImportCounter = {
    inserted: number
    updated: number
    skipped: number
}

type ImportResult = {
    ok: boolean
    counts: {
        inventory: ImportCounter
        availability: ImportCounter
        rules: ImportCounter
        faq: ImportCounter
        reservations: ImportCounter
        info: ImportCounter
        services: ImportCounter
        guests: ImportCounter
        support: ImportCounter
        promos: ImportCounter
        leads: ImportCounter
        total: ImportCounter
    }
}

const resolveSeedPath = (filename: string) => {
    return path.resolve(__dirname, '../../../../docs/developments/hotel/data', filename)
}

const readJson = <T>(filename: string): T => {
    const filePath = resolveSeedPath(filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
}

const SEED_MODE = String(process.env.MANUAL_AGENTS_SEED_MODE || 'smart').toLowerCase()
const IGNORED_COMPARE_KEYS = new Set(['_id', 'updatedAt'])

const createCounter = (): ImportCounter => ({ inserted: 0, updated: 0, skipped: 0 })

const normalizeForCompare = (value: any): any => {
    if (value === null || value === undefined) return value
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((item) => normalizeForCompare(item))
    if (typeof value === 'object') {
        if (typeof value.toHexString === 'function') return value.toHexString()
        const keys = Object.keys(value)
            .filter((key) => !IGNORED_COMPARE_KEYS.has(key))
            .sort()
        const normalized: Record<string, any> = {}
        for (const key of keys) {
            const child = normalizeForCompare(value[key])
            if (typeof child !== 'undefined') {
                normalized[key] = child
            }
        }
        return normalized
    }
    return value
}

const pickByShape = (source: any, shape: any): any => {
    if (shape === null || shape === undefined) return shape
    if (Array.isArray(shape)) return source
    if (typeof shape !== 'object') return source
    const output: Record<string, any> = {}
    for (const key of Object.keys(shape)) {
        output[key] = pickByShape(source ? source[key] : undefined, shape[key])
    }
    return output
}

const applyUpsert = async (collection: any, filter: Record<string, unknown>, update: Record<string, any>, counter: ImportCounter) => {
    const updateDoc = update.$set ?? update
    const existing = await collection.findOne(filter)

    if (existing) {
        if (SEED_MODE === 'insert-only' || SEED_MODE === 'skip') {
            counter.skipped += 1
            return
        }
        if (SEED_MODE !== 'force') {
            const existingComparable = pickByShape(existing, updateDoc)
            const normalizedExisting = normalizeForCompare(existingComparable)
            const normalizedUpdate = normalizeForCompare(updateDoc)
            if (JSON.stringify(normalizedExisting) === JSON.stringify(normalizedUpdate)) {
                counter.skipped += 1
                return
            }
        }
    }

    const result = await collection.updateOne(filter, update, { upsert: true })
    if (result.upsertedCount) {
        counter.inserted += result.upsertedCount
        return
    }
    if (result.modifiedCount) {
        counter.updated += result.modifiedCount
        return
    }
    if (result.matchedCount) {
        counter.skipped += result.matchedCount
    }
}

const mergeCounters = (...counters: ImportCounter[]): ImportCounter => {
    return counters.reduce(
        (acc, counter) => ({
            inserted: acc.inserted + counter.inserted,
            updated: acc.updated + counter.updated,
            skipped: acc.skipped + counter.skipped
        }),
        createCounter()
    )
}

const deriveAvailabilitySede = (hotel: Record<string, any>) => {
    const sede = String(hotel.sede || '').trim()
    const id = String(hotel.id || '').trim()
    const match = id.match(/-(x\d+)$/)
    if (match && sede) {
        return `${sede}-${match[1]}`
    }
    return sede
}

export const importHotelSeed = async (): Promise<ImportResult> => {
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()

    const inventoryCollection = db.collection(collections.hotelInventory)
    const availabilityCollection = db.collection(collections.hotelAvailability)
    const rulesCollection = db.collection(collections.hotelRules)
    const faqCollection = db.collection(collections.hotelFaq)
    const reservationsCollection = db.collection(collections.hotelReservations)
    const infoCollection = db.collection(collections.hotelInfo)
    const servicesCollection = db.collection(collections.hotelServices)
    const guestsCollection = db.collection(collections.hotelGuestProfiles)
    const supportCollection = db.collection(collections.hotelSupport)
    const promosCollection = db.collection(collections.hotelPromos)
    const leadsCollection = db.collection(collections.hotelLeads)

    const inventoryCount = createCounter()
    const availabilityCount = createCounter()
    const rulesCount = createCounter()
    const faqCount = createCounter()
    const reservationsCount = createCounter()
    const infoCount = createCounter()
    const servicesCount = createCounter()
    const guestsCount = createCounter()
    const supportCount = createCounter()
    const promosCount = createCounter()
    const leadsCount = createCounter()

    const inventorySeed = readJson<HotelInventorySeed>('hoteles-inventario.json')
    for (const hotel of inventorySeed.hoteles || []) {
        const hotelId = String(hotel.id || '')
        if (!hotelId) continue
        const availabilitySede = deriveAvailabilitySede(hotel)
        await applyUpsert(
            inventoryCollection,
            { agentId: HOTEL_AGENT_ID, hotelId },
            {
                $set: {
                    ...hotel,
                    agentId: HOTEL_AGENT_ID,
                    hotelId,
                    availabilitySede,
                    updatedAt: new Date()
                }
            },
            inventoryCount
        )
    }

    const availabilitySeed = readJson<HotelAvailabilitySeed>('hoteles-disponibilidad.json')
    const availabilityRows =
        (availabilitySeed.disponibilidad && availabilitySeed.disponibilidad.length
            ? availabilitySeed.disponibilidad
            : availabilitySeed.calendario) || []

    for (const row of availabilityRows) {
        const sede = String(row.sede || '')
        const fecha = String(row.fecha || '')
        const tipo = String(row.tipo || '')
        if (!sede || !fecha || !tipo) continue
        await applyUpsert(
            availabilityCollection,
            { agentId: HOTEL_AGENT_ID, sede, fecha, tipo },
            {
                $set: {
                    agentId: HOTEL_AGENT_ID,
                    sede,
                    fecha,
                    tipo,
                    cupo: Number(row.cupo || 0),
                    overbooking: Boolean(row.overbooking),
                    updatedAt: new Date()
                }
            },
            availabilityCount
        )
    }

    const rulesSeed = readJson<HotelRulesSeed>('hoteles-reglas.json')
    await applyUpsert(
        rulesCollection,
        { agentId: HOTEL_AGENT_ID, rulesVersion: rulesSeed.rulesVersion || 'default' },
        { $set: { ...rulesSeed, agentId: HOTEL_AGENT_ID, updatedAt: new Date() } },
        rulesCount
    )

    const faqSeed = readJson<HotelFaqSeed>('hoteles-faq.json')
    await applyUpsert(
        faqCollection,
        { agentId: HOTEL_AGENT_ID, type: 'faq' },
        { $set: { ...faqSeed, agentId: HOTEL_AGENT_ID, type: 'faq', updatedAt: new Date() } },
        faqCount
    )

    const reservationsSeed = readJson<HotelReservationsSeed>('hoteles-reservas-mock.json')
    for (const reservation of reservationsSeed.reservas || []) {
        const reservationId = String(reservation.id || '')
        if (!reservationId) continue
        const createdAt = reservation.createdAt ? new Date(reservation.createdAt) : new Date()
        await applyUpsert(
            reservationsCollection,
            { agentId: HOTEL_AGENT_ID, id: reservationId },
            {
                $set: {
                    ...reservation,
                    agentId: HOTEL_AGENT_ID,
                    id: reservationId,
                    status: reservation.status || 'confirmed',
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt
                }
            },
            reservationsCount
        )
    }

    const infoSeed = readJson<HotelInfoSeed>('hoteles-info.json')
    for (const hotel of infoSeed.hoteles || []) {
        const hotelId = String(hotel.id || '')
        if (!hotelId) continue
        await applyUpsert(
            infoCollection,
            { agentId: HOTEL_AGENT_ID, hotelId },
            {
                $set: {
                    ...hotel,
                    agentId: HOTEL_AGENT_ID,
                    hotelId,
                    type: 'info',
                    updatedAt: new Date()
                }
            },
            infoCount
        )
    }

    const servicesSeed = readJson<HotelServicesSeed>('hoteles-servicios.json')
    const serviceRows: Array<Record<string, any>> = [
        ...(servicesSeed.servicios || []).map((item) => ({ ...item, kind: 'service' })),
        ...(servicesSeed.amenities || []).map((item) => ({ ...item, kind: 'amenity' }))
    ]
    for (const service of serviceRows) {
        const serviceId = String(service.id || '')
        if (!serviceId) continue
        await applyUpsert(
            servicesCollection,
            { agentId: HOTEL_AGENT_ID, serviceId },
            {
                $set: {
                    ...service,
                    agentId: HOTEL_AGENT_ID,
                    serviceId,
                    updatedAt: new Date()
                }
            },
            servicesCount
        )
    }

    const guestsSeed = readJson<HotelGuestSeed>('hoteles-huespedes.json')
    for (const guest of guestsSeed.huespedes || []) {
        const guestId = String(guest.id || '')
        const email = String(guest.email || '')
        if (!guestId && !email) continue
        await applyUpsert(
            guestsCollection,
            { agentId: HOTEL_AGENT_ID, guestId: guestId || email },
            {
                $set: {
                    ...guest,
                    agentId: HOTEL_AGENT_ID,
                    guestId: guestId || email,
                    email,
                    updatedAt: new Date()
                }
            },
            guestsCount
        )
    }

    const supportSeed = readJson<HotelSupportSeed>('hoteles-soporte.json')
    await applyUpsert(
        supportCollection,
        { agentId: HOTEL_AGENT_ID, type: 'support' },
        { $set: { ...supportSeed, agentId: HOTEL_AGENT_ID, type: 'support', updatedAt: new Date() } },
        supportCount
    )

    const promosSeed = readJson<HotelPromosSeed>('hoteles-promos.json')
    for (const promo of promosSeed.promociones || []) {
        const promoId = String(promo.id || '')
        if (!promoId) continue
        const range = Array.isArray(promo.rango) ? promo.rango : []
        const start = range[0] || ''
        const end = range[1] || ''
        await applyUpsert(
            promosCollection,
            { agentId: HOTEL_AGENT_ID, promoId },
            {
                $set: {
                    ...promo,
                    agentId: HOTEL_AGENT_ID,
                    promoId,
                    start,
                    end,
                    updatedAt: new Date()
                }
            },
            promosCount
        )
    }

    const leadsSeed = readJson<HotelLeadsSeed>('hoteles-leads.json')
    await applyUpsert(
        leadsCollection,
        { agentId: HOTEL_AGENT_ID, type: 'seed' },
        { $set: { ...leadsSeed, agentId: HOTEL_AGENT_ID, type: 'seed', updatedAt: new Date() } },
        leadsCount
    )

    const total = mergeCounters(
        inventoryCount,
        availabilityCount,
        rulesCount,
        faqCount,
        reservationsCount,
        infoCount,
        servicesCount,
        guestsCount,
        supportCount,
        promosCount,
        leadsCount
    )

    return {
        ok: true,
        counts: {
            inventory: inventoryCount,
            availability: availabilityCount,
            rules: rulesCount,
            faq: faqCount,
            reservations: reservationsCount,
            info: infoCount,
            services: servicesCount,
            guests: guestsCount,
            support: supportCount,
            promos: promosCount,
            leads: leadsCount,
            total
        }
    }
}

let hotelSeedPromise: Promise<void> | null = null

export const ensureHotelSeed = async () => {
    if (hotelSeedPromise) return hotelSeedPromise

    hotelSeedPromise = (async () => {
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const inventoryCollection = db.collection(collections.hotelInventory)
        const existing = await inventoryCollection.findOne({ agentId: HOTEL_AGENT_ID })
        if (existing) return
        await importHotelSeed()
    })()

    return hotelSeedPromise
}

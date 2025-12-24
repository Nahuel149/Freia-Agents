import fs from 'fs'
import path from 'path'
import { getManualAgentsCollections, getManualAgentsDb } from './mongo'

type CalendarSeed = {
    lastUpdated?: string
    timezone?: string
    defaultCheckInTime?: string
    defaultCheckOutTime?: string
    blackoutDates?: Array<{ start: string; end: string; reason?: string }>
    properties: Array<{
        id: string
        name: string
        location?: string
        defaultMinNights?: number
        holdsHours?: number
        checkInTime?: string
        checkOutTime?: string
        visitSlots?: Array<{ day: string; slots: string[] }>
        events?: Array<{
            start: string
            end: string
            status: string
            source?: string
            holdExpires?: string
            notes?: string
        }>
        blockedDates?: string[]
    }>
}

type CatalogSeed = {
    catalogLink?: string
    catalogText?: string
    catalogSummary?: string
    address?: string
    contact?: { email?: string }
    generalAmenities?: string[]
    policies?: Record<string, unknown>
    paymentSummary?: Record<string, unknown>
    discountPolicy?: Record<string, unknown>
    visitPolicy?: Record<string, unknown>
    properties?: Array<Record<string, unknown>>
}

type RestrictionsSeed = Record<string, unknown>
type CompetitorsSeed = Record<string, unknown>
type LeadsSeed = Record<string, unknown>

type ImportCounter = {
    inserted: number
    updated: number
    skipped: number
}

type ImportResult = {
    ok: boolean
    counts: {
        calendar: ImportCounter
        catalog: ImportCounter
        restrictions: ImportCounter
        competitors: ImportCounter
        leads: ImportCounter
        total: ImportCounter
    }
}

const resolveSeedPath = (filename: string) => {
    return path.resolve(__dirname, '../../../../docs/developments/quintas/data', filename)
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

export const importQuintasSeed = async (): Promise<ImportResult> => {
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()

    const calendarCollection = db.collection(collections.quintasCalendar)
    const catalogCollection = db.collection(collections.quintasCatalog)
    const restrictionsCollection = db.collection(collections.quintasRestrictions)
    const competitorsCollection = db.collection(collections.quintasCompetitors)
    const leadsCollection = db.collection(collections.quintasLeads)

    const calendarCount = createCounter()
    const catalogCount = createCounter()
    const restrictionsCount = createCounter()
    const competitorsCount = createCounter()
    const leadsCount = createCounter()

    const calendarSeed = readJson<CalendarSeed>('quintas-calendario.json')
    const timezone = calendarSeed.timezone || 'America/Argentina/Buenos_Aires'

    for (const property of calendarSeed.properties || []) {
        const events = (property.events || []).map((event) => ({
            ...event,
            start: event.start,
            end: event.end,
            holdExpires: event.holdExpires ? new Date(event.holdExpires) : undefined
        }))

        const years = new Set<number>()
        for (const event of events) {
            const year = new Date(event.start).getFullYear()
            if (!Number.isNaN(year)) years.add(year)
        }
        for (const blocked of property.blockedDates || []) {
            const year = new Date(blocked).getFullYear()
            if (!Number.isNaN(year)) years.add(year)
        }
        if (years.size === 0) years.add(new Date().getFullYear())

        for (const year of years) {
            const eventsForYear = events.filter((event) => new Date(event.start).getFullYear() === year)
            const blockedForYear = (property.blockedDates || []).filter((blocked) => new Date(blocked).getFullYear() === year)

            await applyUpsert(
                calendarCollection,
                { propertyId: property.id, year },
                {
                    $set: {
                        propertyId: property.id,
                        propertyName: property.name,
                        location: property.location,
                        year,
                        timezone,
                        checkInTime: property.checkInTime || calendarSeed.defaultCheckInTime || '',
                        checkOutTime: property.checkOutTime || calendarSeed.defaultCheckOutTime || '',
                        visitSlots: property.visitSlots || [],
                        defaultMinNights: property.defaultMinNights || 0,
                        holdsHours: property.holdsHours || 0,
                        events: eventsForYear,
                        blockedDates: blockedForYear,
                        globalBlackoutDates: calendarSeed.blackoutDates || [],
                        seedUpdatedAt: calendarSeed.lastUpdated || null,
                        updatedAt: new Date()
                    }
                },
                calendarCount
            )
        }
    }

    const catalogSeed = readJson<CatalogSeed>('quintas-catalogo.json')
    await applyUpsert(
        catalogCollection,
        { type: 'meta' },
        {
            $set: {
                type: 'meta',
                catalogLink: catalogSeed.catalogLink || '',
                catalogText: catalogSeed.catalogText || '',
                catalogSummary: catalogSeed.catalogSummary || '',
                address: catalogSeed.address || '',
                contact: catalogSeed.contact || {},
                generalAmenities: catalogSeed.generalAmenities || [],
                policies: catalogSeed.policies || {},
                paymentSummary: catalogSeed.paymentSummary || {},
                discountPolicy: catalogSeed.discountPolicy || {},
                visitPolicy: catalogSeed.visitPolicy || {},
                updatedAt: new Date()
            }
        },
        catalogCount
    )

    for (const property of catalogSeed.properties || []) {
        const propertyId = property.id as string
        if (!propertyId) continue
        await applyUpsert(
            catalogCollection,
            { type: 'property', propertyId },
            {
                $set: {
                    ...property,
                    type: 'property',
                    propertyId,
                    updatedAt: new Date()
                }
            },
            catalogCount
        )
    }

    const restrictionsSeed = readJson<RestrictionsSeed>('quintas-restricciones.json')
    await applyUpsert(
        restrictionsCollection,
        { rulesVersion: restrictionsSeed.rulesVersion || 'default' },
        { $set: { ...restrictionsSeed, updatedAt: new Date() } },
        restrictionsCount
    )

    const competitorsSeed = readJson<CompetitorsSeed>('quintas-competencia.json')
    await applyUpsert(
        competitorsCollection,
        { referenceDate: competitorsSeed.referenceDate || 'default' },
        { $set: { ...competitorsSeed, updatedAt: new Date() } },
        competitorsCount
    )

    const leadsSeed = readJson<LeadsSeed>('quintas-leads.json')
    await applyUpsert(leadsCollection, { type: 'seed' }, { $set: { ...leadsSeed, updatedAt: new Date(), type: 'seed' } }, leadsCount)

    const total = mergeCounters(calendarCount, catalogCount, restrictionsCount, competitorsCount, leadsCount)

    return {
        ok: true,
        counts: {
            calendar: calendarCount,
            catalog: catalogCount,
            restrictions: restrictionsCount,
            competitors: competitorsCount,
            leads: leadsCount,
            total
        }
    }
}

let seedPromise: Promise<void> | null = null

export const ensureQuintasSeed = async () => {
    if (seedPromise) return seedPromise

    seedPromise = (async () => {
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const calendarCollection = db.collection(collections.quintasCalendar)

        const existingCalendar = await calendarCollection.findOne({})
        if (existingCalendar) return

        await importQuintasSeed()
    })()

    return seedPromise
}

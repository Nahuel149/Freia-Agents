import { Db, MongoClient } from 'mongodb'

let clientPromise: Promise<MongoClient> | null = null
let indexesPromise: Promise<void> | null = null

const getMongoUri = () => process.env.MONGODB_URI || ''
const getMongoDbName = () => process.env.MONGODB_DATABASE || 'freia'

export const getMongoClient = async (): Promise<MongoClient> => {
    const mongoUri = getMongoUri()
    if (!mongoUri) {
        throw new Error('MONGODB_URI is required for manual agents')
    }

    if (!clientPromise) {
        clientPromise = new MongoClient(mongoUri).connect()
    }

    return clientPromise
}

export const getManualAgentsDb = async (): Promise<Db> => {
    const client = await getMongoClient()
    return client.db(getMongoDbName())
}

export const getManualAgentsCollections = () => {
    return {
        manualAgents: process.env.MANUAL_AGENTS_COLLECTION || 'manual_agents',
        manualAgentSessions: process.env.MANUAL_AGENT_SESSIONS_COLLECTION || 'manual_agent_sessions',
        manualAgentShareTokens: process.env.MANUAL_AGENT_SHARE_TOKENS_COLLECTION || 'manual_agent_share_tokens',
        manualAgentMetrics: process.env.MANUAL_AGENT_METRICS_COLLECTION || 'manual_agent_metrics',
        manualAgentCalendarLogs: process.env.MANUAL_AGENT_CALENDAR_LOGS_COLLECTION || 'manual_agent_calendar_logs',
        manualAgentOutboundRuns: process.env.MANUAL_AGENT_OUTBOUND_RUNS_COLLECTION || 'manual_agent_outbound_runs',
        manualAgentChatLogs: process.env.MANUAL_AGENT_CHAT_LOGS_COLLECTION || 'store_clients_chat',
        hotelInventory: process.env.HOTEL_INVENTORY_COLLECTION || 'hotel_inventory',
        hotelAvailability: process.env.HOTEL_AVAILABILITY_COLLECTION || 'hotel_availability',
        hotelRules: process.env.HOTEL_RULES_COLLECTION || 'hotel_rules',
        hotelFaq: process.env.HOTEL_FAQ_COLLECTION || 'hotel_faq',
        hotelReservations: process.env.HOTEL_RESERVATIONS_COLLECTION || 'hotel_reservations',
        hotelInfo: process.env.HOTEL_INFO_COLLECTION || 'hotel_info',
        hotelServices: process.env.HOTEL_SERVICES_COLLECTION || 'hotel_services',
        hotelGuestProfiles: process.env.HOTEL_GUEST_PROFILES_COLLECTION || 'hotel_guest_profiles',
        hotelSupport: process.env.HOTEL_SUPPORT_COLLECTION || 'hotel_support',
        hotelPromos: process.env.HOTEL_PROMOS_COLLECTION || 'hotel_promos',
        hotelLeads: process.env.HOTEL_LEADS_COLLECTION || 'hotel_leads',
        hotelNotifications: process.env.HOTEL_NOTIFICATIONS_COLLECTION || 'hotel_notifications',
        quintasCalendar: process.env.QUINTAS_CALENDAR_COLLECTION || 'quintas_calendario',
        quintasCatalog: process.env.QUINTAS_CATALOG_COLLECTION || 'quintas_catalogo',
        quintasRestrictions: process.env.QUINTAS_RESTRICTIONS_COLLECTION || 'quintas_restricciones',
        quintasCompetitors: process.env.QUINTAS_COMPETITORS_COLLECTION || 'quintas_competencia',
        quintasLeads: process.env.QUINTAS_LEADS_COLLECTION || 'quintas_leads'
    }
}

export const ensureManualAgentsIndexes = async () => {
    if (indexesPromise) return indexesPromise

    indexesPromise = (async () => {
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()

        await db
            .collection(collections.manualAgents)
            .createIndexes([{ key: { status: 1 } }, { key: { updatedAt: -1 } }, { key: { createdBy: 1 } }])

        await db
            .collection(collections.manualAgentSessions)
            .createIndexes([{ key: { agentId: 1, sessionId: 1 } }, { key: { shareTokenId: 1 } }, { key: { updatedAt: -1 } }])

        await db
            .collection(collections.manualAgentShareTokens)
            .createIndexes([
                { key: { agentId: 1 } },
                { key: { tokenHash: 1 }, unique: true },
                { key: { status: 1 } },
                { key: { createdAt: -1 } }
            ])

        await db
            .collection(collections.manualAgentMetrics)
            .createIndexes([{ key: { agentId: 1, createdAt: -1 } }, { key: { sessionId: 1 } }])

        await db
            .collection(collections.manualAgentCalendarLogs)
            .createIndexes([{ key: { propertyId: 1, start: 1, end: 1 } }, { key: { createdAt: -1 } }])

        await db.collection(collections.manualAgentOutboundRuns).createIndexes([{ key: { agentId: 1, createdAt: -1 } }])

        await db
            .collection(collections.manualAgentChatLogs)
            .createIndexes([{ key: { agentId: 1, sessionId: 1 } }, { key: { createdAt: -1 } }])

        await db
            .collection(collections.hotelInventory)
            .createIndexes([{ key: { agentId: 1 } }, { key: { hotelId: 1 } }, { key: { sede: 1 } }])

        await db
            .collection(collections.hotelReservations)
            .createIndexes([{ key: { id: 1 }, unique: true }, { key: { sede: 1, checkIn: 1 } }, { key: { email: 1 } }])

        await db.collection(collections.hotelAvailability).createIndexes([{ key: { agentId: 1, sede: 1, fecha: 1, tipo: 1 } }])

        await db.collection(collections.hotelRules).createIndexes([{ key: { agentId: 1, rulesVersion: 1 } }, { key: { updatedAt: -1 } }])

        await db.collection(collections.hotelFaq).createIndexes([{ key: { agentId: 1, type: 1 } }])

        await db.collection(collections.hotelInfo).createIndexes([{ key: { agentId: 1, hotelId: 1 } }, { key: { sede: 1 } }])

        await db.collection(collections.hotelServices).createIndexes([{ key: { agentId: 1, serviceId: 1 } }, { key: { categoria: 1 } }])

        await db.collection(collections.hotelGuestProfiles).createIndexes([{ key: { agentId: 1, email: 1 } }, { key: { guestId: 1 } }])

        await db.collection(collections.hotelSupport).createIndexes([{ key: { agentId: 1, tema: 1 } }, { key: { type: 1 } }])

        await db.collection(collections.hotelPromos).createIndexes([{ key: { agentId: 1, promoId: 1 } }, { key: { start: 1, end: 1 } }])

        await db.collection(collections.hotelLeads).createIndexes([{ key: { agentId: 1, type: 1 } }, { key: { 'leads.email': 1 } }])

        await db.collection(collections.hotelNotifications).createIndexes([{ key: { agentId: 1, createdAt: -1 } }])
    })()

    return indexesPromise
}

import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer'
import { init as initDataSource, getDataSource } from '../DataSource'
import { AgentEvent } from '../database/entities/AgentEvent'
import logger from '../utils/logger'
import { Repository } from 'typeorm'

interface HistoryMessage {
    type?: string
    data?: Record<string, any>
    timestamp?: string | Date
}

interface HistoryDocument {
    _id?: { toString(): string }
    sessionId?: string
    agentId?: string
    updatedAt?: string | Date
    messages?: HistoryMessage[]
    metadata?: Record<string, any>
}

const MONGO_URI = process.env.MONGO_HISTORY_URI
const MONGO_DB = process.env.MONGO_HISTORY_DB || 'eternum'
const MONGO_COLLECTION = process.env.MONGO_HISTORY_COLLECTION || 'chat_history'
const BATCH_LIMIT = parseInt(process.env.MONGO_HISTORY_BATCH_LIMIT || '0', 10)

const PHONE_REGEX = /\+?\d[\d\s-]{6,}\d/g

type UpsertResult = 'inserted' | 'updated' | 'skipped'

const extractDigits = (value: string | null | undefined): string | null => {
    if (!value) return null
    const digits = value.replace(/[^\d]/g, '')
    return digits.length >= 7 ? digits : null
}

const parseNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const normalized = normalizeString(value)
    if (!normalized) return null
    if (!/^\d+$/.test(normalized)) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

const normalizeString = (value: unknown): string | null => {
    if (value === null || value === undefined) return null
    const str = typeof value === 'string' ? value : String(value)
    const trimmed = str.trim()
    return trimmed.length ? trimmed : null
}

const normalizePhone = (value: string): string | null => {
    const trimmed = value.replace(/[^\d+]/g, '')
    return trimmed.length >= 7 ? trimmed : null
}

const toDateOrUndefined = (value: unknown): Date | undefined => {
    if (!value) return undefined
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value
    }
    const candidate = new Date(value as any)
    return Number.isNaN(candidate.getTime()) ? undefined : candidate
}

const coerceDate = (value: unknown): string | null => {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value as any)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const pickText = (message: HistoryMessage | undefined): string | null => {
    if (!message || !message.data) return null
    const candidates = ['content', 'text', 'answer', 'message', 'reply']
    for (const key of candidates) {
        const value = message.data[key]
        const normalized = normalizeString(value)
        if (normalized) return normalized
    }
    return null
}

const extractPhoneFromMessages = (messages: HistoryMessage[]): string | null => {
    for (const message of messages) {
        const text = pickText(message)
        if (!text) continue
        const match = text.match(PHONE_REGEX)
        if (!match) continue
        for (const candidate of match) {
            const normalized = normalizePhone(candidate)
            if (normalized) return normalized
        }
    }
    return null
}

const summarizeHistory = (doc: HistoryDocument) => {
    const messages = Array.isArray(doc.messages) ? doc.messages : []
    const sortedMessages = messages
        .map((message) => ({
            message,
            time: toDateOrUndefined(message.timestamp)
        }))
        .sort((a, b) => {
            const aTime = a.time?.getTime() ?? 0
            const bTime = b.time?.getTime() ?? 0
            return aTime - bTime
        })

    const firstEntry = sortedMessages[0]?.message
    const lastEntry = sortedMessages[sortedMessages.length - 1]?.message
    const lastAi = [...sortedMessages]
        .reverse()
        .map((entry) => entry.message)
        .find((message) => message?.type === 'ai')

    const messagePreview = normalizeString(pickText(lastAi) || pickText(lastEntry) || pickText(firstEntry))
    const startedAt = coerceDate(sortedMessages[0]?.time)
    const lastMessageAt = coerceDate(sortedMessages[sortedMessages.length - 1]?.time)
    const customerPhone = extractPhoneFromMessages(messages)

    return {
        agentId: normalizeString(doc.agentId),
        lastMessage: messagePreview?.slice(0, 240) || 'Conversation imported from chat_history',
        metadata: {
            sessionId: doc.sessionId,
            messageCount: messages.length,
            startedAt,
            lastMessageAt: lastMessageAt || coerceDate(doc.updatedAt),
            lastSpeaker: lastEntry?.type,
            lastMessagePreview: messagePreview,
            customerPhone,
            rawMetadata: doc.metadata ?? null
        }
    }
}

const upsertConversationEvent = async (sessionKey: string, summary: ReturnType<typeof summarizeHistory>, agentEventRepo: Repository<AgentEvent>): Promise<UpsertResult> => {
    const existing = await agentEventRepo.findOne({ where: { type: 'conversation', clientId: sessionKey } })
    const metadataJSON = JSON.stringify(summary.metadata)

    if (existing) {
        const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {}
        const mergedMetadata = { ...existingMetadata, ...summary.metadata }
        const mergedJSON = JSON.stringify(mergedMetadata)

        if (existing.message === summary.lastMessage && existing.metadata === mergedJSON) {
            return 'skipped'
        }

        existing.message = summary.lastMessage
        existing.metadata = mergedJSON
        existing.agentId = summary.agentId || existing.agentId
        await agentEventRepo.save(existing)
        return 'updated'
    }

    const event = agentEventRepo.create({
        type: 'conversation',
        agentId: summary.agentId || undefined,
        clientId: sessionKey,
        clientName: undefined,
        message: summary.lastMessage,
        metadata: metadataJSON
    })
    await agentEventRepo.save(event)
    return 'inserted'
}

async function main() {
    if (!MONGO_URI) {
        logger.error('[chat-history] MONGO_HISTORY_URI is required to backfill chat history')
        process.exit(1)
    }

    await initDataSource()
    const dataSource = getDataSource()
    if (!dataSource.isInitialized) {
        await dataSource.initialize()
    }

    const mongoClient = new MongoClient(MONGO_URI)
    await mongoClient.connect()

    const collection = mongoClient.db(MONGO_DB).collection<HistoryDocument>(MONGO_COLLECTION)
    const cursor = collection.find({}, { sort: { updatedAt: 1 } })
    const counters: Record<UpsertResult, number> = { inserted: 0, updated: 0, skipped: 0 }
    let scanned = 0
    const agentEventRepo = dataSource.getRepository(AgentEvent)

    while (await cursor.hasNext()) {
        if (BATCH_LIMIT && scanned >= BATCH_LIMIT) break
        const doc = await cursor.next()
        if (!doc) break

        scanned += 1
        const sessionKey = normalizeString(doc.sessionId) || doc._id?.toString()
        if (!sessionKey) {
            counters.skipped += 1
            continue
        }

        const summary = summarizeHistory(doc)
        const result = await upsertConversationEvent(sessionKey, summary, agentEventRepo)
        counters[result] += 1
    }

    await cursor.close()
    await mongoClient.close()
    if (dataSource.isInitialized) {
        await dataSource.destroy()
    }

    logger.info('[chat-history] Backfill summary => ' + JSON.stringify({ scanned, ...counters }))
}

main().catch((error) => {
    logger.error('[chat-history] Failed to backfill chat history', error)
    process.exit(1)
})

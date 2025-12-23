import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { Repository } from 'typeorm'
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer'
import { init as initDataSource, getDataSource } from '../DataSource'
import { AgentEvent } from '../database/entities/AgentEvent'
import { ChatMessage } from '../database/entities/ChatMessage'
import { ProductInventory } from '../database/entities/ProductInventory'
import { SaleRecord } from '../database/entities/SaleRecord'
import { PriceApprovalRequest } from '../database/entities/PriceApprovalRequest'
import { ToolAlert } from '../database/entities/ToolAlert'
import logger from '../utils/logger'

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

interface InventoryEntry {
    productId: string
    normalizedName: string
    normalizedSku: string
    tokens: string[]
    brand?: string | null
}

interface TopWordEntry {
    word: string
    count: number
}

type UpsertResult = 'inserted' | 'updated' | 'skipped'

type FunnelStage = 'lead' | 'qualified' | 'proposal' | 'sale'

const MONGO_URI = process.env.MONGO_HISTORY_URI
const MONGO_DB = process.env.MONGO_HISTORY_DB || 'eternum'
const MONGO_COLLECTION = process.env.MONGO_HISTORY_COLLECTION || 'chat_history'
const BATCH_LIMIT = parseInt(process.env.MONGO_HISTORY_BATCH_LIMIT || '0', 10)

const PHONE_REGEX = /\+?\d[\d\s-]{6,}\d/g
const STOP_WORDS = new Set<string>([
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'unos',
    'unas',
    'lo',
    'al',
    'del',
    'de',
    'y',
    'o',
    'u',
    'es',
    'soy',
    'era',
    'fue',
    'será',
    'para',
    'por',
    'con',
    'sin',
    'sobre',
    'entre',
    'desde',
    'hasta',
    'donde',
    'como',
    'qué',
    'que',
    'quien',
    'quién',
    'cual',
    'cuál',
    'cuales',
    'cuáles',
    'cuanto',
    'cuánto',
    'cuantos',
    'cuántos',
    'cuanta',
    'cuánta',
    'mi',
    'mis',
    'tu',
    'tus',
    'su',
    'sus',
    'nuestro',
    'nuestra',
    'nuestros',
    'nuestras',
    'vuestro',
    'vuestra',
    'vuestros',
    'vuestras',
    'este',
    'esta',
    'estos',
    'estas',
    'ese',
    'esa',
    'esos',
    'esas',
    'aquel',
    'aquella',
    'aquellos',
    'aquellas',
    'eso',
    'esto',
    'aquello',
    'muy',
    'más',
    'menor',
    'mayor',
    'poco',
    'poca',
    'pocos',
    'pocas',
    'mucho',
    'mucha',
    'muchos',
    'muchas',
    'ya',
    'todavía',
    'aún',
    'hoy',
    'ayer',
    'mañana',
    'entonces',
    'también',
    'tampoco',
    'solo',
    'solamente',
    'tal',
    'tales',
    'cada',
    'cualquier',
    'cualesquiera',
    'ningún',
    'ninguna',
    'ninguno',
    'ningunos',
    'ningunas',
    'algunos',
    'algunas',
    'alguno',
    'alguna',
    'algún',
    'porque',
    'pero',
    'aunque',
    'además',
    'asi',
    'así',
    'si',
    'sí',
    'no',
    'sea',
    'tengo',
    'tenemos',
    'tienen',
    'tenés',
    'quiero',
    'quieres',
    'quiere',
    'queremos',
    'quieren',
    'pagar',
    'pago',
    'cliente',
    'clientes',
    'hola',
    'gracias',
    'favor',
    'saludos',
    'buen',
    'buenas',
    'bueno',
    'buena',
    'día',
    'dias',
    'tarde',
    'tardes',
    'noche',
    'noches',
    'hola',
    'listo',
    'ok',
    'dale',
    'perfecto',
    'gracias',
    'favor',
    'puedo',
    'podemos',
    'necesito',
    'necesitamos',
    'quiero',
    'queremos',
    'tenes',
    'tienes',
    'tienen',
    'hay',
    'habrá',
    'hoy',
    'mañana',
    'ahora',
    'luego',
    'después',
    'entonces',
    'mientras',
    'cuando',
    'donde',
    'sobre',
    'precio',
    'precios',
    'unidad',
    'unidades',
    'total',
    'stock',
    'pagar',
    'pago',
    'cliente',
    'consumidor',
    'final',
    'empresa',
    'retiro',
    'retiros',
    'retiro',
    'gomeria',
    'gomería',
    'neumático',
    'neumatico',
    'neumáticos',
    'neumaticos',
    'auto',
    'autos',
    'vehiculo',
    'vehículo',
    'hola',
    'buenas',
    'gracias',
    'saludos',
    'ninguno',
    'ninguna',
    'ningunos',
    'ningunas',
    'nada',
    'todo',
    'todos',
    'todas',
    'algo',
    'alguien',
    'sin',
    'con',
    'segun',
    'según',
    'aprox',
    'aproximado',
    'aproximada',
    'aproximados',
    'aproximadas',
    'etc',
    'etcetera',
    'etcétera',
    'usd',
    'ars'
])

const POSITIVE_WORDS = [
    'excelente',
    'perfecto',
    'genial',
    'buen',
    'buena',
    'buenas',
    'buenísimo',
    'increíble',
    'fantástico',
    'barato',
    'económico',
    'rápido',
    'rapido',
    'fácil',
    'facil',
    'gracias',
    'vale',
    'ok',
    'listo',
    'mejor',
    'ideal',
    'sirve',
    'sirven',
    'sirvió',
    'sirvio',
    'satisfecho',
    'satisfecha',
    'bien',
    'okey',
    'dale'
]
const NEGATIVE_WORDS = [
    'malo',
    'mala',
    'mal',
    'caro',
    'caros',
    'caras',
    'carísimo',
    'carisimo',
    'problema',
    'problemas',
    'tarde',
    'demora',
    'demoras',
    'lento',
    'lenta',
    'no',
    'nunca',
    'jamás',
    'duda',
    'dudas',
    'error',
    'errores',
    'fallo',
    'fallos',
    'falla',
    'fallas',
    'defecto',
    'defectos',
    'queja',
    'quejas',
    'reclamo',
    'reclamos',
    'cancelar',
    'cancelado'
]

const PROPOSAL_KEYWORDS = ['descu', 'cotiz', 'presup', 'propuest', 'reserva', 'pedido', 'orden', 'precio final']
const SALE_KEYWORDS = [
    'confirmo',
    'confirmamos',
    'compro',
    'comprar',
    'compré',
    'compre',
    'pago',
    'pagamos',
    'pagé',
    'pague',
    'retiro',
    'retiro',
    'retirar',
    'retiramos',
    'listo',
    'cerramos',
    'adelanto',
    'transferencia',
    'efectivo'
]
const TOOL_ERROR_KEYWORDS = ['error', 'fallo', 'falló', 'no se pudo', 'problema', 'inconveniente', 'bloqueo', 'fallando']

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

const normalizeForSearch = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()

const tokenize = (text: string): string[] =>
    text
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word))

const computeTopWords = (tokens: string[], limit = 10): TopWordEntry[] => {
    const counts = new Map<string, number>()
    tokens.forEach((token) => {
        counts.set(token, (counts.get(token) ?? 0) + 1)
    })
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word, count]) => ({ word, count }))
}

const scoreSentiment = (text: string): 'positive' | 'negative' | 'neutral' => {
    const lower = text.toLowerCase()
    let score = 0
    POSITIVE_WORDS.forEach((word) => {
        if (lower.includes(word)) score += 1
    })
    NEGATIVE_WORDS.forEach((word) => {
        if (lower.includes(word)) score -= 1
    })
    if (score > 0) return 'positive'
    if (score < 0) return 'negative'
    return 'neutral'
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

const computeResponseTimeSeconds = (entries: { message?: HistoryMessage; time?: Date }[]): number | null => {
    const firstHuman = entries.find((entry) => {
        const type = entry.message?.type?.toLowerCase()
        return type === 'human' || type === 'user'
    })
    if (!firstHuman?.time) return null
    const humanTime = firstHuman.time
    const firstAi = entries.find((entry) => {
        if (!entry.time) return false
        if (entry.time.getTime() < humanTime.getTime()) return false
        const type = entry.message?.type?.toLowerCase()
        return type === 'ai'
    })
    if (!firstAi?.time) return null
    return Math.max(0, Math.round((firstAi.time.getTime() - humanTime.getTime()) / 1000))
}

const buildInventoryIndex = (products: ProductInventory[]): InventoryEntry[] =>
    products.map((product) => {
        const normalizedName = normalizeForSearch(product.name || product.productId)
        const tokens = tokenize(normalizedName)
        return {
            productId: product.productId,
            normalizedName,
            normalizedSku: normalizeForSearch(product.productId),
            tokens,
            brand: product.brand
        }
    })

const findProductMatch = (
    textNormalized: string,
    tokenSet: Set<string>,
    inventory: InventoryEntry[]
): { productId: string | null; confidence: number } => {
    let best: { productId: string | null; confidence: number } = { productId: null, confidence: 0 }

    for (const entry of inventory) {
        if (textNormalized.includes(entry.normalizedSku)) {
            return { productId: entry.productId, confidence: 1 }
        }
        if (textNormalized.includes(entry.normalizedName) && entry.normalizedName.length > 4) {
            return { productId: entry.productId, confidence: 0.9 }
        }
        const matchedTokens = entry.tokens.filter((token) => tokenSet.has(token))
        if (matchedTokens.length >= Math.ceil(entry.tokens.length * 0.6) && matchedTokens.length >= 2) {
            const confidence = matchedTokens.length / entry.tokens.length
            if (confidence > best.confidence) {
                best = { productId: entry.productId, confidence }
            }
        }
    }

    return best
}

interface ConversationSummary {
    agentId?: string | null
    lastMessage: string
    productId: string | null
    confidence: number
    normalizedText: string
    tokens: string[]
    metadata: {
        sessionId?: string
        messageCount: number
        startedAt?: string | null
        lastMessageAt?: string | null
        lastSpeaker?: string
        lastMessagePreview?: string | null
        customerPhone?: string | null
        topWords: TopWordEntry[]
        sentiment: 'positive' | 'negative' | 'neutral'
        responseTimeSeconds: number | null
        productMatchConfidence: number
        rawMetadata?: Record<string, any> | null
    }
}

const summarizeHistory = (doc: HistoryDocument, inventoryIndex: InventoryEntry[]): ConversationSummary => {
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
    const customerPhoneRaw = extractPhoneFromMessages(messages)
    const combinedText = messages
        .map((message) => pickText(message))
        .filter((text): text is string => Boolean(text))
        .join(' ')

    const normalizedText = normalizeForSearch(combinedText)
    const tokens = tokenize(normalizedText)
    const tokenSet = new Set(tokens)
    const topWords = computeTopWords(tokens)
    const sentiment = scoreSentiment(normalizedText)
    const responseTimeSeconds = computeResponseTimeSeconds(sortedMessages)
    const productMatch = findProductMatch(normalizedText, tokenSet, inventoryIndex)

    let normalizedPhone: string | null = null
    if (customerPhoneRaw) {
        const trimmed = customerPhoneRaw.trim()
        normalizedPhone = normalizePhoneNumber(trimmed)
        if (!normalizedPhone || !isValidPhoneNumber(normalizedPhone)) {
            normalizedPhone = normalizePhone(trimmed) ?? extractDigits(trimmed)
        }
    }

    return {
        agentId: normalizeString(doc.agentId),
        lastMessage: messagePreview?.slice(0, 240) || 'Conversación importada desde chat_history',
        productId: productMatch.productId,
        confidence: productMatch.confidence,
        normalizedText,
        tokens,
        metadata: {
            sessionId: doc.sessionId,
            messageCount: messages.length,
            startedAt,
            lastMessageAt: lastMessageAt || coerceDate(doc.updatedAt),
            lastSpeaker: lastEntry?.type,
            lastMessagePreview: messagePreview,
            customerPhone: normalizedPhone,
            topWords,
            sentiment,
            responseTimeSeconds,
            productMatchConfidence: productMatch.confidence,
            rawMetadata: doc.metadata ?? null
        }
    }
}

const upsertConversationEvent = async (
    sessionKey: string,
    summary: ConversationSummary,
    agentEventRepo: Repository<AgentEvent>
): Promise<UpsertResult> => {
    const existing = await agentEventRepo.findOne({ where: { type: 'conversation', clientId: sessionKey } })
    const metadataJSON = JSON.stringify(summary.metadata)

    if (existing) {
        const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {}
        const mergedMetadata = { ...existingMetadata, ...summary.metadata }
        const mergedJSON = JSON.stringify(mergedMetadata)

        const existingProductId = existing.productId ?? null
        const newProductId = summary.productId || existingProductId

        if (existing.message === summary.lastMessage && existing.metadata === mergedJSON && existingProductId === newProductId) {
            return 'skipped'
        }

        existing.message = summary.lastMessage
        existing.metadata = mergedJSON
        existing.agentId = summary.agentId || existing.agentId
        existing.productId = newProductId || undefined
        await agentEventRepo.save(existing)
        return 'updated'
    }

    const event = agentEventRepo.create({
        type: 'conversation',
        agentId: summary.agentId || undefined,
        clientId: sessionKey,
        clientName: undefined,
        message: summary.lastMessage,
        metadata: metadataJSON,
        productId: summary.productId || undefined
    })
    await agentEventRepo.save(event)
    return 'inserted'
}

const ensureFunnelEvent = async (
    type: FunnelStage,
    sessionKey: string,
    summary: ConversationSummary,
    agentEventRepo: Repository<AgentEvent>
) => {
    const clientId = summary.metadata.customerPhone || sessionKey
    const existing = await agentEventRepo.findOne({ where: { type, clientId } })
    if (existing) return

    const metadata = {
        sessionId: summary.metadata.sessionId,
        customerPhone: summary.metadata.customerPhone,
        importedFrom: 'chat_history'
    }

    const event = agentEventRepo.create({
        type,
        agentId: summary.agentId || undefined,
        clientId,
        clientName: undefined,
        message: `Evento ${type} importado desde historial`,
        metadata: JSON.stringify(metadata)
    })
    await agentEventRepo.save(event)
}

const ensureSaleRecord = async (sessionKey: string, summary: ConversationSummary, saleRepo: Repository<SaleRecord>) => {
    const clientId = summary.metadata.customerPhone || sessionKey
    const existing = await saleRepo.findOne({ where: { clientId }, order: { ts: 'DESC' } })
    if (existing) return

    const record = saleRepo.create({
        agentId: summary.agentId || undefined,
        clientId,
        clientName: undefined,
        totalAmount: 0,
        items: summary.productId ? JSON.stringify([{ productId: summary.productId, qty: 1 }]) : undefined
    })
    await saleRepo.save(record)
}

const ensurePriceRequest = async (
    sessionKey: string,
    summary: ConversationSummary,
    discountPercentage: number,
    priceRepo: Repository<PriceApprovalRequest>
) => {
    const quoteId = `chat-${sessionKey}`
    const existing = await priceRepo.findOne({ where: { quoteId } })
    if (existing) return

    const request = priceRepo.create({
        quoteId,
        clientId: summary.metadata.customerPhone || null,
        requestedDiscount: discountPercentage,
        requestedTotal: null,
        reason: 'Importado desde historial (descuento detectado en conversación)',
        clientPhone: summary.metadata.customerPhone || null,
        priority: discountPercentage >= 10 ? 'high' : 'medium',
        estimatedResponseTime: 48,
        status: 'pending'
    })
    await priceRepo.save(request)
}

const upsertChatMessages = async (sessionKey: string, summary: ConversationSummary, chatMessageRepo: Repository<ChatMessage>) => {
    const isUuid = (value: string | null | undefined) =>
        typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

    const chatflowId = isUuid(summary.metadata.sessionId) ? summary.metadata.sessionId : isUuid(summary.agentId) ? summary.agentId : null

    if (!chatflowId) return

    const existingMessages = await chatMessageRepo.find({ where: { chatId: sessionKey }, take: 1 })
    if (existingMessages.length) return

    const entries = [
        { role: 'userMessage', content: summary.metadata.lastMessagePreview || 'Importado desde historial' },
        { role: 'apiMessage', content: summary.lastMessage }
    ]

    for (const entry of entries) {
        const message = chatMessageRepo.create({
            chatflowid: chatflowId,
            chatId: sessionKey,
            role: entry.role as 'userMessage' | 'apiMessage',
            content: entry.content,
            chatType: 'EXTERNAL',
            createdDate: new Date()
        })
        await chatMessageRepo.save(message)
    }
}

const ensureToolAlert = async (sessionKey: string, summary: ConversationSummary, message: string, toolRepo: Repository<ToolAlert>) => {
    const existing = await toolRepo.findOne({ where: { toolName: 'conversation_ingest', errorMessage: message, status: 'open' } })
    if (existing) {
        existing.occurrences += 1
        existing.lastSeen = new Date()
        existing.chatId = sessionKey
        await toolRepo.save(existing)
        return
    }

    const alert = toolRepo.create({
        toolName: 'conversation_ingest',
        errorMessage: message,
        status: 'open',
        occurrences: 1,
        chatId: sessionKey,
        metadata: {
            sessionId: summary.metadata.sessionId,
            sentiment: summary.metadata.sentiment,
            productId: summary.productId,
            source: 'chat_history_backfill'
        }
    })
    await toolRepo.save(alert)
}

const detectStages = (
    summary: ConversationSummary
): {
    stages: FunnelStage[]
    discountPercent: number | null
    toolErrors: string[]
    probableAgentId: string | null
} => {
    const stages: FunnelStage[] = []
    const normalizedText = summary.normalizedText

    if (summary.tokens.length >= 3) {
        stages.push('lead')
    }
    if (summary.productId || summary.metadata.productMatchConfidence >= 0.6) {
        stages.push('qualified')
    }
    if (PROPOSAL_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
        stages.push('proposal')
    }
    if (SALE_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
        stages.push('sale')
    }

    const discountMatch = normalizedText.match(/(\d{1,2})\s*%/)
    const discountPercent = discountMatch ? Number(discountMatch[1]) : null

    const toolErrors: string[] = []
    TOOL_ERROR_KEYWORDS.forEach((keyword) => {
        if (normalizedText.includes(keyword)) {
            toolErrors.push(`Posible incidencia mencionada: ${keyword}`)
        }
    })

    const mentionMatch = normalizedText.match(/agente\s+([a-z0-9._-]+)/)
    const probableAgentId = summary.agentId || (mentionMatch ? mentionMatch[1] : null)

    return { stages: [...new Set(stages)], discountPercent, toolErrors, probableAgentId }
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

    const productRepo = dataSource.getRepository(ProductInventory)
    const saleRepo = dataSource.getRepository(SaleRecord)
    const priceRepo = dataSource.getRepository(PriceApprovalRequest)
    const toolRepo = dataSource.getRepository(ToolAlert)
    const agentEventRepo = dataSource.getRepository(AgentEvent)

    const inventoryProducts = await productRepo.find()
    const inventoryIndex = buildInventoryIndex(inventoryProducts)
    const inventoryUsage = new Map<string, number>()

    const chatMessageRepo = dataSource.getRepository(ChatMessage)

    const mongoClient = new MongoClient(MONGO_URI)
    await mongoClient.connect()

    const collection = mongoClient.db(MONGO_DB).collection<HistoryDocument>(MONGO_COLLECTION)
    const cursor = collection.find({}, { sort: { updatedAt: 1 } })
    const counters: Record<UpsertResult, number> = { inserted: 0, updated: 0, skipped: 0 }
    let scanned = 0

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

        const summary = summarizeHistory(doc, inventoryIndex)
        const result = await upsertConversationEvent(sessionKey, summary, agentEventRepo)
        counters[result] += 1
        await upsertChatMessages(sessionKey, summary, chatMessageRepo)
        await upsertChatMessages(sessionKey, summary, chatMessageRepo)

        const { stages, discountPercent, toolErrors, probableAgentId } = detectStages(summary)
        if (!summary.agentId && probableAgentId) {
            summary.agentId = probableAgentId
        }
        const stagePromises: Promise<void>[] = []
        stages.forEach((stage) => {
            stagePromises.push(ensureFunnelEvent(stage, sessionKey, summary, agentEventRepo))
        })
        await Promise.all(stagePromises)

        if (stages.includes('sale')) {
            await ensureSaleRecord(sessionKey, summary, saleRepo)
        }

        if (summary.productId) {
            inventoryUsage.set(summary.productId, (inventoryUsage.get(summary.productId) ?? 0) + 1)
        }

        if (discountPercent !== null && discountPercent > 5) {
            await ensurePriceRequest(sessionKey, summary, discountPercent, priceRepo)
        }

        for (const message of toolErrors.slice(0, 2)) {
            await ensureToolAlert(sessionKey, summary, message, toolRepo)
        }
    }

    await cursor.close()
    await mongoClient.close()

    if (inventoryUsage.size > 0) {
        for (const [productId, hits] of inventoryUsage.entries()) {
            const product = inventoryProducts.find((item) => item.productId === productId)
            if (!product) continue
            const currentStock = Number(product.stock || 0)
            const newStock = Math.max(1, Math.min(currentStock || 50, currentStock - hits * 2))
            await productRepo.update({ productId }, { stock: newStock, updatedDate: new Date() })
        }
    }

    if (dataSource.isInitialized) {
        await dataSource.destroy()
    }

    logger.info('[chat-history] Backfill summary => ' + JSON.stringify({ scanned, ...counters }))
}

main().catch((error) => {
    logger.error('[chat-history] Failed to backfill chat history', error)
    process.exit(1)
})

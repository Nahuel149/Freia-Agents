import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { nanoid } from 'nanoid'
import { createHash } from 'crypto'
import { ObjectId } from 'mongodb'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { manualAgents, getManualAgentById } from '../../manual-agents/registry'
import { ManualAgentResponse } from '../../manual-agents/types'
import { ensureManualAgentsIndexes, getManualAgentsCollections, getManualAgentsDb } from '../../manual-agents/mongo'
import { createHold, confirmPayment } from '../../manual-agents/quintasOps'
import { runOutbound } from '../../manual-agents/outbound'
import { importHotelSeed } from '../../manual-agents/hotelData'
import { ensureQuintasSeed, importQuintasSeed } from '../../manual-agents/quintasData'
import { getManualAgentModel } from '../../manual-agents/config'

const syncManualAgentsMetadata = async (options: { userId?: string; page: number; limit: number }) => {
    await ensureManualAgentsIndexes()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const manualAgentsCollection = db.collection(collections.manualAgents)

    const defaultModel = getManualAgentModel()
    const updatedBy = options.userId || 'system'

    for (const agent of manualAgents) {
        const existing = await manualAgentsCollection.findOne({ id: agent.id })
        const status = existing?.status === 'archived' ? 'archived' : agent.status
        await manualAgentsCollection.updateOne(
            { id: agent.id },
            {
                $set: {
                    id: agent.id,
                    name: agent.name,
                    description: agent.description,
                    status,
                    version: agent.version,
                    llmModel: agent.llmModel || defaultModel,
                    tools: agent.tools || [],
                    source: 'code',
                    updatedAt: new Date(),
                    updatedBy
                },
                $setOnInsert: { createdAt: new Date(), createdBy: updatedBy }
            },
            { upsert: true }
        )
    }

    const query = { status: { $ne: 'archived' } }
    const total = await manualAgentsCollection.countDocuments(query)
    const page = Math.max(1, options.page)
    const limit = Math.max(1, options.limit)
    const skip = (page - 1) * limit

    const data = await manualAgentsCollection.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray()
    return { data, total, page, limit }
}

const ensureAgentAccess = (agentId: string, op: 'read' | 'write', collections: string[]) => {
    const agent = getManualAgentById(agentId)
    if (!agent) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
    }
    if (!agent.allowedOps.includes(op)) {
        throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Operation not allowed')
    }
    const missing = collections.filter((collection) => !agent.allowedCollections.includes(collection))
    if (missing.length) {
        throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Collection access not allowed')
    }
}

const appendSessionMessages = async (params: {
    sessionId: string
    agentId: string
    messages: Array<{ role: string; content: string; timestamp: Date; metadata?: Record<string, unknown> }>
    userId?: string
    shareTokenId?: ObjectId
}) => {
    await ensureManualAgentsIndexes()
    const db = await getManualAgentsDb()
    const collections = getManualAgentsCollections()
    const sessionsCollection = db.collection(collections.manualAgentSessions)
    const chatLogsCollection = db.collection(collections.manualAgentChatLogs)

    await sessionsCollection.updateOne(
        { sessionId: params.sessionId, agentId: params.agentId },
        {
            $setOnInsert: {
                sessionId: params.sessionId,
                agentId: params.agentId,
                startedAt: new Date(),
                userId: params.userId,
                shareTokenId: params.shareTokenId
            },
            $push: { messages: { $each: params.messages } },
            $set: { updatedAt: new Date() }
        },
        { upsert: true }
    )

    if (params.messages.length) {
        await chatLogsCollection.insertMany(
            params.messages.map((message) => ({
                agentId: params.agentId,
                sessionId: params.sessionId,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp,
                metadata: message.metadata || null,
                userId: params.userId || null,
                shareTokenId: params.shareTokenId || null,
                createdAt: new Date()
            }))
        )
    }
}

const getAllManualAgents = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt((_req.query?.page as string) || '1', 10)
        const limit = parseInt((_req.query?.limit as string) || '12', 10)
        const list = await syncManualAgentsMetadata({ userId: (_req.user as any)?.id, page, limit })
        return res.json(list)
    } catch (error) {
        return next(error)
    }
}

const getManualAgentByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const agent = getManualAgentById(req.params.id)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }

        return res.json({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            status: agent.status,
            version: agent.version,
            llmModel: agent.llmModel || getManualAgentModel(),
            tools: agent.tools || [],
            allowedCollections: agent.allowedCollections,
            allowedOps: agent.allowedOps
        })
    } catch (error) {
        return next(error)
    }
}

const getManualAgentSessionsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const agentId = req.params.id
        const agent = getManualAgentById(agentId)
        if (!agent) {
            return res.json({ data: [] })
        }

        const limit = Math.min(parseInt((req.query?.limit as string) || '20', 10), 100)
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const sessionsCollection = db.collection(collections.manualAgentSessions)

        const sessions = await sessionsCollection.find({ agentId }).sort({ updatedAt: -1 }).limit(limit).toArray()

        const data = sessions.map((session) => {
            const messages = session.messages || []
            const lastMessage = messages.length ? messages[messages.length - 1] : null
            return {
                sessionId: session.sessionId,
                startedAt: session.startedAt,
                updatedAt: session.updatedAt,
                userId: session.userId || null,
                shareTokenId: session.shareTokenId || null,
                lastMessage: lastMessage ? { role: lastMessage.role, content: lastMessage.content } : null
            }
        })

        return res.json({ data })
    } catch (error) {
        return next(error)
    }
}

const getManualAgentSessionHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const agentId = req.params.id
        const sessionId = req.params.sessionId
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const sessionsCollection = db.collection(collections.manualAgentSessions)
        const session = await sessionsCollection.findOne({ agentId, sessionId })
        if (!session) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Session not found')
        }
        return res.json({
            sessionId,
            messages: session.messages || []
        })
    } catch (error) {
        return next(error)
    }
}

const runManualAgentChat = async (
    req: Request,
    res: Response,
    next: NextFunction,
    options: { isPublic?: boolean; shareTokenId?: ObjectId } = {}
) => {
    try {
        await ensureManualAgentsIndexes()
        const agentId = req.params.id
        const agent = getManualAgentById(agentId)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }

        const message = req.body?.message || ''
        if (!message) {
            throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Message is required')
        }

        const sessionId = req.body?.sessionId || nanoid(12)
        const userId = options.isPublic ? undefined : (req.user as any)?.id
        const timestamp = new Date()
        const startedAt = Date.now()

        await appendSessionMessages({
            sessionId,
            agentId,
            userId,
            shareTokenId: options.shareTokenId,
            messages: [{ role: 'user', content: message, timestamp }]
        })

        const response: ManualAgentResponse = await agent.handler({
            message,
            sessionId,
            locale: 'es-AR',
            metadata: req.body?.metadata
        })

        await appendSessionMessages({
            sessionId,
            agentId,
            userId,
            shareTokenId: options.shareTokenId,
            messages: [
                {
                    role: 'assistant',
                    content: response.answer,
                    timestamp: new Date(),
                    metadata: response.metadata
                }
            ]
        })

        const logManualAgentUsage = async () => {
            try {
                const db = await getManualAgentsDb()
                const collections = getManualAgentsCollections()
                await db.collection(collections.manualAgentMetrics).insertOne({
                    agentId,
                    sessionId,
                    userId,
                    isPublic: options.isPublic || false,
                    messageLength: message.length,
                    responseLength: response.answer?.length || 0,
                    durationMs: Date.now() - startedAt,
                    createdAt: new Date()
                })
            } catch (_error) {
                // ignore metrics failures
            }
        }
        void logManualAgentUsage()

        return res.json({
            answer: response.answer,
            sessionId,
            metadata: response.metadata
        })
    } catch (error) {
        return next(error)
    }
}

const chatManualAgent = async (req: Request, res: Response, next: NextFunction) => {
    const collections = getManualAgentsCollections()
    const agent = getManualAgentById(req.params.id)
    if (!agent) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
    }
    const readCollections = agent.allowedCollections.filter(
        (collection) =>
            ![
                collections.manualAgentSessions,
                collections.manualAgentShareTokens,
                collections.manualAgentMetrics,
                collections.manualAgentCalendarLogs,
                collections.manualAgentOutboundRuns,
                collections.manualAgentChatLogs
            ].includes(collection)
    )
    if (readCollections.length) {
        ensureAgentAccess(req.params.id, 'read', readCollections)
    }
    ensureAgentAccess(req.params.id, 'write', [collections.manualAgentSessions])
    return runManualAgentChat(req, res, next, { isPublic: false })
}

const chatManualAgentPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.params.token
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        const tokenHash = createHash('sha256').update(token).digest('hex')
        const tokenDoc = await shareCollection.findOne({ tokenHash, status: 'active' })
        if (!tokenDoc) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Invalid share token')
        }

        req.params.id = tokenDoc.agentId
        const agent = getManualAgentById(req.params.id)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }
        const readCollections = agent.allowedCollections.filter(
            (collection) =>
                ![
                    collections.manualAgentSessions,
                    collections.manualAgentShareTokens,
                    collections.manualAgentMetrics,
                    collections.manualAgentCalendarLogs,
                    collections.manualAgentOutboundRuns,
                    collections.manualAgentChatLogs
                ].includes(collection)
        )
        if (readCollections.length) {
            ensureAgentAccess(req.params.id, 'read', readCollections)
        }
        ensureAgentAccess(req.params.id, 'write', [collections.manualAgentSessions])

        await shareCollection.updateOne({ _id: tokenDoc._id }, { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } })
        return runManualAgentChat(req, res, next, { isPublic: true, shareTokenId: tokenDoc._id })
    } catch (error) {
        return next(error)
    }
}

const getPublicSessionHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.params.token
        const sessionId = req.params.sessionId
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        const tokenHash = createHash('sha256').update(token).digest('hex')
        const tokenDoc = await shareCollection.findOne({ tokenHash, status: 'active' })
        if (!tokenDoc) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Invalid share token')
        }

        const sessionsCollection = db.collection(collections.manualAgentSessions)
        const session = await sessionsCollection.findOne({
            sessionId,
            agentId: tokenDoc.agentId,
            shareTokenId: tokenDoc._id
        })

        if (!session) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Session not found')
        }

        return res.json({
            sessionId,
            messages: session.messages || []
        })
    } catch (error) {
        return next(error)
    }
}

const getPublicAgentInfoHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.params.token
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        const tokenHash = createHash('sha256').update(token).digest('hex')
        const tokenDoc = await shareCollection.findOne({ tokenHash, status: 'active' })
        if (!tokenDoc) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Invalid share token')
        }

        const agent = getManualAgentById(tokenDoc.agentId)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }

        return res.json({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            chatbotConfig: tokenDoc.chatbotConfig || null
        })
    } catch (error) {
        return next(error)
    }
}

const getManualAgentsHealthHandler = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const db = await getManualAgentsDb()
        await db.command({ ping: 1 })
        return res.json({ ok: true, database: 'connected' })
    } catch (error) {
        return next(new InternalFlowiseError(StatusCodes.SERVICE_UNAVAILABLE, 'MongoDB health check failed'))
    }
}

const seedManualAgentDataHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.params.id === 'quintas') {
            const result = await importQuintasSeed()
            return res.json(result)
        }
        if (req.params.id === 'gran-sol') {
            const result = await importHotelSeed()
            return res.json(result)
        }
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Seed not supported for this agent')
    } catch (error) {
        return next(error)
    }
}

const createHoldHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'write', [collections.quintasCalendar])
        const { propertyId, start, end, leadId, holdHours, notes } = req.body
        if (!propertyId || !start || !end) {
            throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'propertyId, start, and end are required')
        }

        const result = await createHold({ propertyId, start, end, leadId, holdHours, notes })
        if (!result.ok) {
            const message =
                result.reason === 'date_blocked'
                    ? 'Requested dates are blocked'
                    : result.reason === 'invalid_date'
                    ? 'Invalid date range'
                    : 'Requested dates are unavailable'
            throw new InternalFlowiseError(StatusCodes.CONFLICT, message)
        }

        return res.json({
            status: 'hold',
            holdExpires: result.holdExpires?.toISOString()
        })
    } catch (error) {
        return next(error)
    }
}

const confirmPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const collections = getManualAgentsCollections()
        if (req.params.id === 'gran-sol') {
            ensureAgentAccess(req.params.id, 'write', [collections.hotelReservations])
            const { reservationId, paymentRef, amount, currency, sessionId, followUpMessage, followUpType } = req.body
            const reservationKey = reservationId || req.body?.propertyId
            if (!reservationKey) {
                throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'reservationId is required')
            }
            const db = await getManualAgentsDb()
            const reservations = db.collection(collections.hotelReservations)
            const existing = await reservations.findOne({ agentId: req.params.id, id: reservationKey })
            if (!existing) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Reservation not found')
            }
            await reservations.updateOne(
                { agentId: req.params.id, id: reservationKey },
                {
                    $set: { status: 'paid', updatedAt: new Date() },
                    $push: {
                        pagos: {
                            amount: amount ?? existing.precioTotal ?? 0,
                            currency: currency || existing.moneda || 'USD',
                            method: 'manual',
                            paymentRef: paymentRef || '',
                            createdAt: new Date()
                        }
                    }
                }
            )

            if (sessionId && followUpMessage) {
                const sessionsCollection = db.collection(collections.manualAgentSessions)
                const existingSession = await sessionsCollection.findOne({ sessionId, agentId: req.params.id })
                if (existingSession) {
                    await appendSessionMessages({
                        sessionId,
                        agentId: req.params.id,
                        userId: (req.user as any)?.id,
                        shareTokenId: existingSession.shareTokenId,
                        messages: [
                            {
                                role: 'assistant',
                                content: String(followUpMessage),
                                timestamp: new Date(),
                                metadata: { type: followUpType || 'paymentConfirmed' }
                            }
                        ]
                    })
                }
            }

            return res.json({ status: 'paid' })
        }

        ensureAgentAccess(req.params.id, 'write', [collections.quintasCalendar])
        const { propertyId, start, end, leadId, paymentRef, amount, currency, sessionId, followUpMessage, followUpType } = req.body
        if (!propertyId || !start || !end) {
            throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'propertyId, start, and end are required')
        }

        const result = await confirmPayment({ propertyId, start, end, leadId, paymentRef, amount, currency })
        if (!result.ok) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Hold expired or not found')
        }

        if (sessionId && followUpMessage) {
            const db = await getManualAgentsDb()
            const sessionsCollection = db.collection(collections.manualAgentSessions)
            const existingSession = await sessionsCollection.findOne({ sessionId, agentId: req.params.id })
            if (existingSession) {
                await appendSessionMessages({
                    sessionId,
                    agentId: req.params.id,
                    userId: (req.user as any)?.id,
                    shareTokenId: existingSession.shareTokenId,
                    messages: [
                        {
                            role: 'assistant',
                            content: String(followUpMessage),
                            timestamp: new Date(),
                            metadata: { type: followUpType || 'paymentConfirmed' }
                        }
                    ]
                })
            }
        }

        return res.json({ status: 'booked' })
    } catch (error) {
        return next(error)
    }
}

const confirmPaymentPublicHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.params.token
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        const tokenHash = createHash('sha256').update(token).digest('hex')
        const tokenDoc = await shareCollection.findOne({ tokenHash, status: 'active' })
        if (!tokenDoc) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Invalid share token')
        }

        const agentId = tokenDoc.agentId
        const { sessionId, followUpMessage, followUpType } = req.body
        if (agentId === 'gran-sol') {
            ensureAgentAccess(agentId, 'write', [collections.hotelReservations])
            const { reservationId, paymentRef, amount, currency } = req.body
            const reservationKey = reservationId || req.body?.propertyId
            if (!reservationKey) {
                throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'reservationId is required')
            }
            const reservations = db.collection(collections.hotelReservations)
            const existing = await reservations.findOne({ agentId, id: reservationKey })
            if (!existing) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Reservation not found')
            }
            await reservations.updateOne(
                { agentId, id: reservationKey },
                {
                    $set: { status: 'paid', updatedAt: new Date() },
                    $push: {
                        pagos: {
                            amount: amount ?? existing.precioTotal ?? 0,
                            currency: currency || existing.moneda || 'USD',
                            method: 'manual',
                            paymentRef: paymentRef || '',
                            createdAt: new Date()
                        }
                    }
                }
            )
        } else {
            ensureAgentAccess(agentId, 'write', [collections.quintasCalendar])
            const { propertyId, start, end, leadId, paymentRef, amount, currency } = req.body
            if (!propertyId || !start || !end) {
                throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'propertyId, start, and end are required')
            }

            const result = await confirmPayment({ propertyId, start, end, leadId, paymentRef, amount, currency })
            if (!result.ok) {
                throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Hold expired or not found')
            }
        }

        if (sessionId && followUpMessage) {
            const sessionsCollection = db.collection(collections.manualAgentSessions)
            const existingSession = await sessionsCollection.findOne({
                sessionId,
                agentId,
                shareTokenId: tokenDoc._id
            })
            if (existingSession) {
                await appendSessionMessages({
                    sessionId,
                    agentId,
                    shareTokenId: tokenDoc._id,
                    messages: [
                        {
                            role: 'assistant',
                            content: String(followUpMessage),
                            timestamp: new Date(),
                            metadata: { type: followUpType || 'paymentConfirmed' }
                        }
                    ]
                })
            }
        }

        return res.json({ status: 'booked' })
    } catch (error) {
        return next(error)
    }
}
const createShareTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const agentId = req.params.id
        const agent = getManualAgentById(agentId)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }

        const collections = getManualAgentsCollections()
        ensureAgentAccess(agentId, 'write', [collections.manualAgentShareTokens])
        const db = await getManualAgentsDb()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        const token = nanoid(32)
        const tokenHash = createHash('sha256').update(token).digest('hex')
        const createdBy = (req.user as any)?.id
        const chatbotConfig =
            req.body && typeof req.body.chatbotConfig === 'object' && req.body.chatbotConfig !== null ? req.body.chatbotConfig : undefined

        const result = await shareCollection.insertOne({
            agentId,
            tokenHash,
            status: 'active',
            createdAt: new Date(),
            createdBy,
            usageCount: 0,
            lastUsedAt: null,
            chatbotConfig
        })

        const publicUrl = `${req.protocol}://${req.get('host')}/manual-agent/${token}`

        return res.json({
            tokenId: result.insertedId,
            token,
            url: publicUrl,
            chatbotConfig: chatbotConfig || null
        })
    } catch (error) {
        return next(error)
    }
}

const revokeShareTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'write', [collections.manualAgentShareTokens])
        const tokenId = req.params.tokenId
        const db = await getManualAgentsDb()
        const shareCollection = db.collection(collections.manualAgentShareTokens)

        await shareCollection.updateOne({ _id: new ObjectId(tokenId) }, { $set: { status: 'revoked', revokedAt: new Date() } })

        return res.json({ status: 'revoked' })
    } catch (error) {
        return next(error)
    }
}

const getShareTokensHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'read', [collections.manualAgentShareTokens])
        const db = await getManualAgentsDb()
        const shareCollection = db.collection(collections.manualAgentShareTokens)
        const tokens = await shareCollection.find({ agentId: req.params.id }).sort({ createdAt: -1 }).project({ tokenHash: 0 }).toArray()
        return res.json(tokens)
    } catch (error) {
        return next(error)
    }
}

const archiveManualAgentHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const agent = getManualAgentById(req.params.id)
        if (!agent) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Manual agent not found')
        }
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        const manualAgentsCollection = db.collection(collections.manualAgents)
        await manualAgentsCollection.updateOne({ id: agent.id }, { $set: { status: 'archived', updatedAt: new Date() } })
        return res.json({ status: 'archived' })
    } catch (error) {
        return next(error)
    }
}

const sendOutboundHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await ensureQuintasSeed()
        const { leadId, templateId } = req.body || {}
        if (!leadId || !templateId) {
            throw new InternalFlowiseError(StatusCodes.UNPROCESSABLE_ENTITY, 'leadId and templateId are required')
        }
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'write', [collections.quintasLeads])
        const db = await getManualAgentsDb()
        const leadsCollection = db.collection(collections.quintasLeads)
        const result = await leadsCollection.updateOne(
            { type: 'seed', 'leads.id': leadId },
            {
                $set: {
                    'leads.$.lastOutboundAt': new Date(),
                    'leads.$.outboundTemplateId': templateId,
                    'leads.$.outboundStatus': 'sent'
                }
            }
        )
        if (!result.matchedCount) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Lead not found')
        }
        return res.json({ status: 'sent' })
    } catch (error) {
        return next(error)
    }
}

const getManualAgentKpi = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.params.id !== 'quintas') {
            return res.json({
                avgCompetitorPrice: 0,
                avgOurPrice: 0,
                deltaPct: 0,
                currency: 'USD',
                zone: null,
                date: (req.query?.date as string) || null,
                referenceDate: null,
                dataStale: true
            })
        }
        await ensureQuintasSeed()
        const db = await getManualAgentsDb()
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'read', [collections.quintasCatalog, collections.quintasCompetitors])
        const zone = (req.query?.zone as string) || ''
        const date = (req.query?.date as string) || ''

        const competitorDoc = await db.collection(collections.quintasCompetitors).findOne({})
        const competitors = (competitorDoc?.competitors || []) as Array<{ pricePerNight?: number; location?: string; currency?: string }>
        const referenceDate = competitorDoc?.referenceDate || null
        const dateMatches = !date || !referenceDate || date === referenceDate
        if (!dateMatches) {
            return res.json({
                avgCompetitorPrice: 0,
                avgOurPrice: 0,
                deltaPct: 0,
                currency: competitorDoc?.competitors?.[0]?.currency || 'USD',
                zone: zone || null,
                date,
                referenceDate,
                dataStale: true
            })
        }
        const filteredCompetitors = zone
            ? competitors.filter((item) => item.location?.toLowerCase().includes(zone.toLowerCase()))
            : competitors
        const competitorPrices = filteredCompetitors.map((item) => item.pricePerNight || 0).filter((price) => price > 0)
        const avgCompetitorPrice = competitorPrices.length
            ? competitorPrices.reduce((sum, price) => sum + price, 0) / competitorPrices.length
            : 0

        const catalogProperties = await db.collection(collections.quintasCatalog).find({ type: 'property' }).toArray()
        const filteredCatalog = zone
            ? catalogProperties.filter((item) => (item.location || '').toLowerCase().includes(zone.toLowerCase()))
            : catalogProperties
        const ourPrices = filteredCatalog
            .map((item) => item.basePricePerNight || 0)
            .filter((price) => typeof price === 'number' && price > 0)
        const avgOurPrice = ourPrices.length ? ourPrices.reduce((sum, price) => sum + price, 0) / ourPrices.length : 0

        const deltaPct = avgCompetitorPrice ? ((avgOurPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100 : 0

        return res.json({
            avgCompetitorPrice,
            avgOurPrice,
            deltaPct,
            currency: competitorDoc?.competitors?.[0]?.currency || 'USD',
            zone: zone || null,
            date: date || null,
            referenceDate
        })
    } catch (error) {
        return next(error)
    }
}

const getManualAgentOutbound = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.params.id !== 'quintas') {
            return res.json({ ok: true, data: [], note: 'Outbound not configured for this agent.' })
        }
        const collections = getManualAgentsCollections()
        ensureAgentAccess(req.params.id, 'read', [collections.quintasCalendar, collections.quintasLeads])
        const outbound = await runOutbound({ agentId: req.params.id, source: 'manual' })
        return res.json(outbound)
    } catch (error) {
        return next(error)
    }
}

export default {
    getAllManualAgents,
    getManualAgentById: getManualAgentByIdHandler,
    getManualAgentSessions: getManualAgentSessionsHandler,
    getManualAgentSession: getManualAgentSessionHandler,
    chatManualAgent,
    chatManualAgentPublic,
    getPublicAgentInfo: getPublicAgentInfoHandler,
    getPublicSession: getPublicSessionHandler,
    createHold: createHoldHandler,
    confirmPayment: confirmPaymentHandler,
    confirmPaymentPublic: confirmPaymentPublicHandler,
    createShareToken: createShareTokenHandler,
    revokeShareToken: revokeShareTokenHandler,
    getManualAgentKpi,
    getManualAgentOutbound,
    getManualAgentsHealth: getManualAgentsHealthHandler,
    getShareTokens: getShareTokensHandler,
    archiveManualAgent: archiveManualAgentHandler,
    sendOutbound: sendOutboundHandler,
    seedManualAgentData: seedManualAgentDataHandler
}

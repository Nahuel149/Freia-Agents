import { DataSource } from 'typeorm'
import { AgentEvent } from '../database/entities/AgentEvent'
import { ChatMessage } from '../database/entities/ChatMessage'
import { SaleRecord } from '../database/entities/SaleRecord'
import { ChatType } from '../Interface'
import logger from '../utils/logger'

const MESSAGE_PREVIEW_LIMIT = 240

const parseMetadata = (raw?: string | null): Record<string, any> => {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

const buildPreview = (content?: string | null): string => {
    if (!content) return ''
    const trimmed = content.trim()
    return trimmed.length <= MESSAGE_PREVIEW_LIMIT ? trimmed : `${trimmed.slice(0, MESSAGE_PREVIEW_LIMIT - 3)}...`
}

export const recordConversationAnalyticsFromMessage = async (
    message: ChatMessage,
    dataSource: DataSource
): Promise<void> => {
    try {
        if (!message) return
        if (message.chatType && message.chatType !== ChatType.EXTERNAL) return
        const sessionKey = message.sessionId || `${message.chatflowid}:${message.chatId}`
        if (!sessionKey) return

        const agentEventRepo = dataSource.getRepository(AgentEvent)
        const preview = buildPreview(message.content)
        const baseMetadata = {
            chatId: message.chatId,
            sessionId: message.sessionId,
            chatflowId: message.chatflowid,
            lastMessageRole: message.role,
            lastMessagePreview: preview,
            updatedAt: new Date().toISOString()
        }

        const existing = await agentEventRepo.findOne({ where: { type: 'conversation', clientId: sessionKey } })

        if (!existing) {
            if (message.role !== 'userMessage') return
            const newEvent = new AgentEvent()
            newEvent.type = 'conversation'
            newEvent.agentId = message.chatflowid
            newEvent.clientId = sessionKey
            newEvent.clientName = undefined
            newEvent.message = preview
            newEvent.metadata = JSON.stringify({
                ...baseMetadata,
                firstMessageRole: message.role,
                firstMessagePreview: preview,
                messageCount: 1
            })
            await agentEventRepo.save(newEvent)
            return
        }

        const existingMetadata = parseMetadata(existing.metadata)
        const updatedMetadata = {
            ...existingMetadata,
            ...baseMetadata,
            messageCount: (existingMetadata.messageCount || 1) + 1
        }

        existing.message = preview
        existing.metadata = JSON.stringify(updatedMetadata)
        await agentEventRepo.save(existing)
    } catch (error) {
        logger.warn('Failed to record conversation analytics from message', { error })
    }
}

interface SaleAnalyticsProductInfo {
    sku?: string
    brand?: string
    model?: string
    wheelSize?: string
    unitPrice?: number
    quantity?: number
    totalPrice?: number
}

interface SaleAnalyticsInput {
    saleId: number | string
    agentId?: string | null
    clientId?: string | null
    clientName?: string | null
    contactPhone?: string | null
    totalAmount: number
    discountPercentage?: number | null
    quantity?: number | null
    paymentMethod?: string | null
    deliveryMethod?: string | null
    deliveryAddress?: string | null
    notes?: string | null
    sessionId?: string | null
    chatId?: string | null
    chatflowId?: string | null
    products: SaleAnalyticsProductInfo[]
}

const normaliseContactId = (clientId?: string | null, contactPhone?: string | null): string | undefined => {
    return clientId || contactPhone || undefined
}

export const recordSaleAnalytics = async (input: SaleAnalyticsInput, dataSource: DataSource): Promise<void> => {
    try {
        const saleRecordRepo = dataSource.getRepository(SaleRecord)
        const agentEventRepo = dataSource.getRepository(AgentEvent)
        const clientIdentifier = normaliseContactId(input.clientId, input.contactPhone)

        const saleRecord = new SaleRecord()
        saleRecord.agentId = input.agentId || undefined
        saleRecord.clientId = clientIdentifier
        saleRecord.clientName = input.clientName || undefined
        saleRecord.totalAmount = input.totalAmount
        saleRecord.items = JSON.stringify(input.products)
        await saleRecordRepo.save(saleRecord)

        const saleEvent = new AgentEvent()
        saleEvent.type = 'sale'
        saleEvent.agentId = input.agentId || undefined
        saleEvent.clientId = clientIdentifier
        saleEvent.clientName = input.clientName || undefined
        saleEvent.amount = input.totalAmount
        saleEvent.metadata = JSON.stringify({
            saleId: input.saleId,
            discountPercentage: input.discountPercentage ?? undefined,
            quantity: input.quantity ?? undefined,
            paymentMethod: input.paymentMethod || undefined,
            deliveryMethod: input.deliveryMethod || undefined,
            deliveryAddress: input.deliveryAddress || undefined,
            notes: input.notes || undefined,
            sessionId: input.sessionId || undefined,
            chatId: input.chatId || undefined,
            chatflowId: input.chatflowId || input.agentId || undefined,
            products: input.products
        })
        await agentEventRepo.save(saleEvent)
    } catch (error) {
        logger.warn('Failed to record sale analytics event', { error, saleId: input.saleId })
    }
}

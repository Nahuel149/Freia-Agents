import { DataSource } from 'typeorm'
import { ChatMessage } from '../database/entities/ChatMessage'
import { IChatMessage } from '../Interface'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { recordConversationAnalyticsFromMessage } from '../services/agent-events'
import logger from './logger'

/**
 * Method that add chat messages.
 * @param {Partial<IChatMessage>} chatMessage
 */
export const utilAddChatMessage = async (chatMessage: Partial<IChatMessage>, appDataSource?: DataSource): Promise<ChatMessage> => {
    const dataSource = appDataSource ?? getRunningExpressApp().AppDataSource
    const newChatMessage = new ChatMessage()
    if ((chatMessage as any).workspaceId && (chatMessage as any).workspaceId === 'oss-mode') {
    delete (chatMessage as any).workspaceId
}
    Object.assign(newChatMessage, chatMessage)
    if (!newChatMessage.createdDate) {
        newChatMessage.createdDate = new Date()
    }
    const chatmessage = await dataSource.getRepository(ChatMessage).create(newChatMessage)
    const dbResponse = await dataSource.getRepository(ChatMessage).save(chatmessage)

    try {
        await recordConversationAnalyticsFromMessage(dbResponse, dataSource)
    } catch (error) {
        logger.warn('Failed to pipe chat message into analytics events', { error, chatMessageId: dbResponse.id })
    }

    return dbResponse
}

import { Between } from 'typeorm'
import { ChatMessageFeedback } from '../database/entities/ChatMessageFeedback'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'

/**
 * Method that get chat messages.
 * @param {string} chatflowid
 * @param {string} sortOrder
 * @param {string} chatId
 * @param {string} startDate
 * @param {string} endDate
 */
export const utilGetChatMessageFeedback = async (
    chatflowid: string,
    chatId?: string,
    sortOrder: string = 'ASC',
    startDate?: string,
    endDate?: string,
    workspaceId?: string
): Promise<ChatMessageFeedback[]> => {
    const appServer = getRunningExpressApp()
    let fromDate
    if (startDate) fromDate = new Date(startDate)

    let toDate
    if (endDate) toDate = new Date(endDate)
    const where: { [key: string]: any } = {
        chatflowid,
        chatId,
        createdDate: toDate && fromDate ? Between(fromDate, toDate) : undefined
    }
    if (workspaceId && workspaceId !== 'bypass-workspace') {
        where.workspaceId = workspaceId
    }

    return await appServer.AppDataSource.getRepository(ChatMessageFeedback).find({
        where,
        order: {
            createdDate: sortOrder === 'DESC' ? 'DESC' : 'ASC'
        }
    })
}

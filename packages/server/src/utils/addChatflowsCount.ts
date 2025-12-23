import { StatusCodes } from 'http-status-codes'
import { ChatFlow } from '../database/entities/ChatFlow'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { getErrorMessage } from '../errors/utils'
import { isOssMode } from './ossMode'

// Augment each API key object with:
// - chatflows: number of linked chatflows
// - chatFlows: array of minimal metadata for linked chatflows
export const addChatflowsCount = async (keys: any[]) => {
    try {
        const appServer = getRunningExpressApp()
        let tmpResult = keys
        if (Array.isArray(keys) && keys.length > 0) {
            const updatedKeys: any[] = []
            for (const key of keys) {
                const qb = appServer.AppDataSource.getRepository(ChatFlow)
                    .createQueryBuilder('cf')
                    .where('cf.apikeyid = :apikeyid', { apikeyid: key.id })

                // In OSS mode or when workspaceId is not provided/bypassed, skip workspace filtering
                if (!isOssMode() && key.workspaceId && key.workspaceId !== 'oss-mode') {
                    qb.andWhere('cf.workspaceId = :workspaceId', { workspaceId: key.workspaceId })
                }

                const chatflows = await qb.getMany()
                key.chatflows = chatflows.length
                key.chatFlows = chatflows.map((cf: { name: string; category: string; updatedDate: Date }) => ({
                    flowName: cf.name,
                    category: cf.category,
                    updatedDate: cf.updatedDate
                }))

                updatedKeys.push(key)
            }
            tmpResult = updatedKeys
        }
        return tmpResult
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: addChatflowsCount - ${getErrorMessage(error)}`)
    }
}

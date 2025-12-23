import { v4 as uuidv4 } from 'uuid'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { Lead } from '../../database/entities/Lead'
import { ILead } from '../../Interface'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const getAllLeads = async (chatflowid: string, workspaceId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({
            id: chatflowid
        })
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow with id ${chatflowid} not found`)
        }
        if (workspaceId !== 'oss-mode' && chatflow.workspaceId !== workspaceId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `You don't have access to this chatflow`)
        }
        const dbResponse = await appServer.AppDataSource.getRepository(Lead).find({
            where: {
                chatflowid
            }
        })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: leadsService.getAllLeads - ${getErrorMessage(error)}`)
    }
}

const createLead = async (body: Partial<ILead>) => {
    try {
        const chatId = body.chatId ?? uuidv4()

        const newLead = new Lead()
        Object.assign(newLead, body)
        Object.assign(newLead, { chatId })

        const appServer = getRunningExpressApp()
        const lead = appServer.AppDataSource.getRepository(Lead).create(newLead)
        const dbResponse = await appServer.AppDataSource.getRepository(Lead).save(lead)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: leadsService.createLead - ${getErrorMessage(error)}`)
    }
}

export default {
    createLead,
    getAllLeads
}

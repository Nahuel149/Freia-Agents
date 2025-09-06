import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { desc, WasenderSendMessageTool, WasenderParams } from './core'

class WasenderSendMessage_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'Wasender Send Message'
        this.name = 'wasenderSendMessage'
        this.version = 1.0
        this.type = 'WasenderSendMessage'
        this.icon = 'send.png'
        this.category = 'Tools'
        this.description = 'Send WhatsApp message using Wasender API'
        this.baseClasses = [this.type, ...getBaseClasses(WasenderSendMessageTool), 'Tool']
        this.inputs = [
            {
                label: 'Phone Number ID',
                name: 'phone_number_id',
                type: 'string',
                description: 'WhatsApp Business phone number ID registered in Wasender',
                acceptVariable: true
            },
            {
                label: 'Recipient Number',
                name: 'to_number',
                type: 'string',
                description: 'Destination phone number including country code',
                acceptVariable: true
            },
            {
                label: 'Message',
                name: 'message',
                type: 'string',
                rows: 4,
                description: 'Text message content',
                acceptVariable: true
            },
            {
                label: 'Delay (seconds)',
                name: 'delay',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Schedule (ISO 8601)',
                name: 'schedule',
                type: 'string',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Name',
                name: 'toolName',
                type: 'string',
                default: 'wasender_send_message',
                description: 'Name of the tool',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Description',
                name: 'toolDescription',
                type: 'string',
                rows: 4,
                default: desc,
                description: 'Describe to LLM when it should use this tool',
                additionalParams: true,
                optional: true
            },
            {
                label: 'Max Output Length',
                name: 'maxOutputLength',
                type: 'number',
                description: 'Max length of the API response to return',
                default: '2000',
                step: 1,
                optional: true,
                additionalParams: true
            }
        ]
    }

    async init(nodeData: INodeData): Promise<any> {
        const phone_number_id = nodeData.inputs?.phone_number_id as string
        const to_number = nodeData.inputs?.to_number as string
        const message = nodeData.inputs?.message as string
        const delayInput = nodeData.inputs?.delay as string
        const schedule = nodeData.inputs?.schedule as string
        const name = (nodeData.inputs?.name as string) || (nodeData.inputs?.toolName as string)
        const description = (nodeData.inputs?.description as string) || (nodeData.inputs?.toolDescription as string)
        const maxOutputLength = (nodeData.inputs?.maxOutputLength as string) || (nodeData.inputs?.wasenderMaxOutputLength as string)

        const body: Partial<any> = {}
        if (phone_number_id) body.phone_number_id = phone_number_id
        if (to_number) body.to_number = to_number
        if (message) body.message = message
        body.type = 'text'
        if (delayInput) body.delay = parseInt(delayInput, 10)
        if (schedule) body.schedule = schedule

        const params: WasenderParams = {
            body,
            name,
            description,
            maxOutputLength: maxOutputLength ? parseInt(maxOutputLength, 10) : undefined
        }

        return new WasenderSendMessageTool(params)
    }
}

module.exports = { nodeClass: WasenderSendMessage_Tools }
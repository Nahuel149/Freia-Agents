import { z } from 'zod'
import { DynamicStructuredTool } from '../OpenAPIToolkit/core'
import { secureFetch } from '../../../src/httpSecurity'

export const desc = `Send WhatsApp text messages through Wasender API.`

export interface WasenderHeaders {
    [key: string]: string
}

export interface WasenderBody {
    phone_number_id: string
    to_number: string
    type: string
    message: string
    delay?: number
    schedule?: string
}

export interface WasenderParams {
    token?: string
    body?: Partial<WasenderBody>
    description?: string
    name?: string
    maxOutputLength?: number
}

const createWasenderSchema = () =>
    z.object({
        phone_number_id: z.string().describe('WhatsApp Business phone number ID registered in Wasender'),
        to_number: z.string().describe('Destination phone number including country code'),
        type: z.enum(['text']).default('text').describe('Message type, currently only "text" is supported'),
        message: z.string().describe('Text message content'),
        delay: z.number().optional().describe('Delay time in seconds before sending the message'),
        schedule: z.string().optional().describe('ISO-8601 timestamp to schedule the message')
    })

export class WasenderSendMessageTool extends DynamicStructuredTool {
    maxOutputLength = Infinity
    token = ''
    body: Partial<WasenderBody> = {}

    constructor(args?: WasenderParams) {
        const schema = createWasenderSchema()
        const authToken = args?.token || process.env.WASENDER_API_TOKEN || ''
        const toolInput = {
            name: args?.name || 'wasender_send_message',
            description: args?.description || desc,
            schema,
            baseUrl: 'https://api.wasender.live/v1/messages/send-text',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`
            }
        }
        super(toolInput)
        this.token = authToken
        this.body = args?.body || {}
        this.maxOutputLength = args?.maxOutputLength ?? this.maxOutputLength
    }

    /** @ignore */
    async _call(input: WasenderBody): Promise<string> {
        const requestBody = {
            phone_number_id: input.phone_number_id,
            to_number: input.to_number,
            type: input.type || 'text',
            message: input.message,
            ...(input.delay ? { delay: input.delay } : {}),
            ...(input.schedule ? { schedule: input.schedule } : {})
        }

        const res = await secureFetch('https://api.wasender.live/v1/messages/send-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.token}`
            },
            body: JSON.stringify(requestBody)
        })

        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}: ${res.statusText}`)
        }

        const text = await res.text()
        return text.slice(0, this.maxOutputLength)
    }
}
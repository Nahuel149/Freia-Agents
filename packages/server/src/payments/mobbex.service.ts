import crypto from 'crypto'
import fetch from 'node-fetch'
import { IPaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookResult } from './IPaymentProvider'
import { z } from 'zod'
import { logInfo, logWarn } from '../utils/redactLogger'

const mobbexWebhookSchema = z.object({
    data: z.object({
        payment: z.object({
            id: z.string(),
            status: z.number(),
            total: z.number(),
            currency: z.string(),
            description: z.string().optional()
        }),
        checkout: z
            .object({
                uid: z.string()
            })
            .optional()
    })
})

export class MobbexService implements IPaymentProvider {
    private apiKey = process.env.MOBBEX_API_KEY || ''
    private accessToken = process.env.MOBBEX_ACCESS_TOKEN || ''
    private webhookSecret = process.env.MOBBEX_WEBHOOK_SECRET || ''

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
        const body = {
            total: input.amountCents / 100,
            currency: input.currency,
            reference: input.orderId,
            description: `Order ${input.orderId}`,
            return_url: process.env.CHECKOUT_RETURN_URL,
            installments: [{ description: 'Cuota Simple', type: 'installment' }],
            sources: ['binance'],
            customer: { email: input.customerEmail }
        }
        const res = await fetch('https://api.mobbex.com/p/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'x-access-token': this.accessToken
            },
            body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error(`Mobbex error ${res.status}`)
        const json: any = await res.json()
        logInfo('mobbex.createCheckout', { checkoutId: json?.data?.id, orderId: input.orderId })
        return { checkoutId: json?.data?.id }
    }

    async handleWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<WebhookResult> {
        const signature = (headers['x-signature'] || headers['X-Signature']) as string | undefined
        if (!signature) throw new Error('Missing signature')
        const computed = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
        if (computed !== signature) {
            logWarn('mobbex.signature_mismatch')
            throw new Error('Invalid signature')
        }

        const parsed = mobbexWebhookSchema.parse(JSON.parse(rawBody.toString()))
        const pay = parsed.data.payment
        const status = pay.status === 200 ? 'COMPLETED' : 'FAILED'
        return {
            externalRef: pay.id,
            status,
            amountCents: Math.round(pay.total * 100),
            currency: pay.currency,
            metadata: parsed
        }
    }
}

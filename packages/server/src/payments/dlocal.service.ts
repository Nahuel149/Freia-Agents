import crypto from 'crypto'
import fetch from 'node-fetch'
import { IPaymentProvider, CreateCheckoutInput, CreateCheckoutResult, WebhookResult } from './IPaymentProvider'
import { z } from 'zod'
import { logInfo, logWarn } from '../utils/redactLogger'

const dlocalWebhookSchema = z.object({
    id: z.string(),
    order_id: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.string()
})

export class DLocalService implements IPaymentProvider {
    private webhookSecret = process.env.DLOCAL_WEBHOOK_SECRET || ''
    private apiKey = process.env.DLOCAL_API_KEY || ''
    private apiSecret = process.env.DLOCAL_API_SECRET || ''

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
        const body = {
            amount: input.amountCents / 100,
            currency: input.currency,
            country: input.countryCode,
            external_id: input.orderId,
            callback_url: process.env.DLOCAL_CALLBACK_URL,
            redirect_url: process.env.CHECKOUT_RETURN_URL,
            payment_method_flow: 'REDIRECT'
        }
        const res = await fetch('https://sandbox.dlocal.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Login': this.apiKey,
                'X-Trans-Key': this.apiSecret
            },
            body: JSON.stringify(body)
        })
        const json: any = await res.json()
        logInfo('dlocal.createCheckout', { external_id: input.orderId, redirect: json?.redirect_url })
        if (!json?.redirect_url) throw new Error('Missing redirect_url')
        return { redirectUrl: json.redirect_url }
    }

    async handleWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<WebhookResult> {
        const signature = (headers['x-dlocal-signature'] || headers['X-Dlocal-Signature']) as string | undefined
        if (!signature) throw new Error('Missing signature')
        const computed = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
        if (computed !== signature) {
            logWarn('dlocal.signature_mismatch')
            throw new Error('Invalid signature')
        }

        const parsed = dlocalWebhookSchema.parse(JSON.parse(rawBody.toString()))
        const status = parsed.status.toUpperCase() === 'PAID' ? 'COMPLETED' : 'FAILED'
        return {
            externalRef: parsed.id,
            status,
            amountCents: Math.round(parsed.amount * 100),
            currency: parsed.currency,
            metadata: parsed
        }
    }
}

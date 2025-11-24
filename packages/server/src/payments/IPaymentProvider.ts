import { PaymentTransaction } from '../database/entities/PaymentTransaction'

export interface CreateCheckoutInput {
    amountCents: number
    currency: string
    countryCode: string
    orderId: string
    customerEmail: string
}

export interface CreateCheckoutResult {
    redirectUrl?: string
    checkoutId?: string
}

export interface WebhookResult {
    externalRef: string
    status: PaymentTransaction['status']
    amountCents: number
    currency: string
    metadata: any
}

export interface IPaymentProvider {
    createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>
    handleWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<WebhookResult>
}

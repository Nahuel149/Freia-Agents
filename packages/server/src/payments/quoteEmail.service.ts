import nodemailer from 'nodemailer'
import { PaymentQuote } from '../database/entities/PaymentQuote'

export class QuoteEmailService {
    private isConfigured() {
        return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD
    }

    private async getTransporter() {
        const host = process.env.SMTP_HOST
        const port = Number(process.env.SMTP_PORT || 465)
        const secure = process.env.SMTP_SECURE === 'true' || port === 465
        const user = process.env.SMTP_USER
        const pass = process.env.SMTP_PASSWORD
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass }
        })
    }

    async sendQuoteEmail(email: string, quote: PaymentQuote) {
        if (!this.isConfigured()) return
        try {
            const transporter = await this.getTransporter()
            const subject = 'Tu pago está listo'
            const amount = (quote.amountCents / 100).toFixed(2)
            const body = `
Hola,

Tienes un pago pendiente:
- Monto: ${amount} ${quote.currency}
- Código de pago (quote): ${quote.id}
- Descripción: ${quote.description || '—'}

Para completar el pago, ingresa a la app y ve a la sección Payments, elige "Pagar un código asignado" e ingresa el código.

Gracias.
`
            await transporter.sendMail({
                to: email,
                from: process.env.SENDER_EMAIL || process.env.SMTP_USER || email,
                subject,
                text: body
            })
        } catch (err) {
            // No bloquear el flujo por fallo de email
            console.warn('No se pudo enviar el email de quote', err)
        }
    }
}

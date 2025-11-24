import express from 'express'
import rateLimit from 'express-rate-limit'
import { PaymentService } from '../../payments/payment.service'
import { MobbexService } from '../../payments/mobbex.service'
import { DLocalService } from '../../payments/dlocal.service'

const router = express.Router()
const paymentService = new PaymentService()
const mobbex = new MobbexService()
const dlocal = new DLocalService()

const webhookLimiter = rateLimit({
    windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '120', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many webhook requests'
})

router.post('/mobbex', webhookLimiter, async (req, res) => {
    try {
        const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}))
        const result = await mobbex.handleWebhook(rawBody, req.headers as any)
        await paymentService.upsertFromWebhook({
            provider: 'MOBBEX',
            externalRef: result.externalRef,
            status: result.status,
            amountCents: result.amountCents,
            currency: result.currency,
            metadata: result.metadata
        })
        return res.status(200).send('ok')
    } catch (err) {
        return res.status(400).send('invalid')
    }
})

router.post('/dlocal', webhookLimiter, async (req, res) => {
    try {
        const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}))
        const result = await dlocal.handleWebhook(rawBody, req.headers as any)
        await paymentService.upsertFromWebhook({
            provider: 'DLOCAL_GO',
            externalRef: result.externalRef,
            status: result.status,
            amountCents: result.amountCents,
            currency: result.currency,
            metadata: result.metadata
        })
        return res.status(200).send('ok')
    } catch (err) {
        return res.status(400).send('invalid')
    }
})

export default router

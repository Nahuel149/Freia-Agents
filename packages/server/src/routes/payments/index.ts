import express from 'express'
import rateLimit from 'express-rate-limit'
import { PaymentStrategyFactory } from '../../payments/PaymentStrategyFactory'
import { z } from 'zod'
import { OrderValidationService } from '../../payments/orderValidation.service'

const router = express.Router()
const orderValidation = new OrderValidationService()

const checkoutLimiter = rateLimit({
    windowMs: parseInt(process.env.PAYMENTS_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.PAYMENTS_RATE_LIMIT_MAX || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many checkout attempts, please try again later.'
})

const checkoutSchema = z.object({
    amountCents: z.number().int().positive(),
    currency: z.string().min(3).max(4),
    countryCode: z.string().length(2),
    orderId: z.string().min(1),
    customerEmail: z.string().email()
})

router.post('/checkout', checkoutLimiter, async (req, res) => {
    try {
        const data = checkoutSchema.parse(req.body)
        await orderValidation.validateAmount(data.orderId, data.amountCents)
        const provider = PaymentStrategyFactory.forCountry(data.countryCode)
        const result = await provider.createCheckout(data)
        return res.json(result)
    } catch (err: any) {
        return res.status(400).json({ error: err?.message || 'Invalid payload' })
    }
})

export default router

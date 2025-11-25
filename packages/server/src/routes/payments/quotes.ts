import express from 'express'
import { z } from 'zod'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { PaymentQuote } from '../../database/entities/PaymentQuote'
import { QuoteEmailService } from '../../payments/quoteEmail.service'

const router = express.Router()
const quoteEmailService = new QuoteEmailService()

const allowedCurrencies = ['USD', 'ARS'] as const

const createSchema = z.object({
    amountCents: z.number().int().positive(),
    currency: z.enum(allowedCurrencies),
    userEmail: z.string().email().optional(),
    description: z.string().optional()
})

router.post('/', async (req, res, next) => {
    try {
        // Solo super-admin
        const role = (req.user as any)?.role || (req.user as any)?.roleId
        const permissions = Array.isArray((req.user as any)?.permissions) ? (req.user as any).permissions : []
        const isAdmin = role === 'super-admin' || permissions.includes('*')
        if (!isAdmin) throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Solo admin')

        const data = createSchema.parse(req.body)
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(PaymentQuote)

        let userId: string | null = null
        if (data.userEmail) {
            const userRows = await app.AppDataSource.query(`SELECT id FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [
                data.userEmail
            ])
            userId = userRows?.[0]?.id || null
        }

        const quote = await repo.save(
            repo.create({
                amountCents: data.amountCents,
                currency: data.currency,
                userEmail: data.userEmail ?? null,
                userId,
                description: data.description ?? null
            })
        )
        if (quote.userEmail) {
            quoteEmailService.sendQuoteEmail(quote.userEmail, quote as any)
        }
        return res.status(201).json({ quoteId: quote?.id, quote })
    } catch (err) {
        next(err)
    }
})

router.get('/', async (req, res, next) => {
    try {
        const role = (req.user as any)?.role || (req.user as any)?.roleId
        const permissions = Array.isArray((req.user as any)?.permissions) ? (req.user as any).permissions : []
        const isAdmin = role === 'super-admin' || permissions.includes('*')
        if (!isAdmin) throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Solo admin')

        const { userEmail } = req.query as { userEmail?: string }
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(PaymentQuote)
        const qb = repo.createQueryBuilder('quote').orderBy('quote.createdAt', 'DESC').limit(200)
        if (userEmail) {
            qb.where('quote.userEmail = :userEmail', { userEmail })
        }
        const quotes = await qb.getMany()
        return res.json({ quotes })
    } catch (err) {
        next(err)
    }
})

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        if (!id) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Id requerido')
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(PaymentQuote)
        const quote = await repo.findOne({ where: { id } })
        if (!quote) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Quote no encontrado')

        // Si tiene user_email asignado, permitir solo al mismo email o admin
        const role = (req.user as any)?.role || (req.user as any)?.roleId
        const permissions = Array.isArray((req.user as any)?.permissions) ? (req.user as any).permissions : []
        const isAdmin = role === 'super-admin' || permissions.includes('*')
        const reqEmail = (req.user as any)?.email
        if (quote.userEmail && !isAdmin && quote.userEmail !== reqEmail) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'No autorizado para este quote')
        }
        if (quote.userId && !isAdmin && quote.userId !== (req.user as any)?.id) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'No autorizado para este quote')
        }

        return res.json({ quote })
    } catch (err) {
        next(err)
    }
})

export default router

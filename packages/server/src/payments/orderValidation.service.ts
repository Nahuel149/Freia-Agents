import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

export class OrderValidationService {
    private skuFixed: Record<string, { amountCents: number; currency: string }> = {
        'subscription-monthly': { amountCents: 50000, currency: 'USD' } // $500
    }

    private skuVariablePrefix: Record<string, { unitCents: number; currency: string }> = {
        'add-agent': { unitCents: 20000, currency: 'USD' } // $200 cada agente
    }

    async validateAmount(orderId: string, amountCents: number, currency: string, userCtx?: any) {
        const normalizedId = (orderId || '').toLowerCase()
        const role = userCtx?.role || userCtx?.roleId
        const permissions = Array.isArray(userCtx?.permissions) ? userCtx.permissions : []
        const isAdmin = role === 'super-admin' || permissions.includes('*')
        const currentUserId = userCtx?.id
        const currentEmail = userCtx?.email
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

        // SKU fijo
        for (const key of Object.keys(this.skuFixed)) {
            if (!normalizedId.startsWith(key)) continue
            const sku = this.skuFixed[key]
            if (sku.currency !== currency) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Moneda no permitida para este SKU')
            if (sku.amountCents !== amountCents) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto no coincide con SKU')
            return
        }

        // SKU variable (multiplicador)
        for (const prefix of Object.keys(this.skuVariablePrefix)) {
            if (normalizedId.startsWith(prefix)) {
                const sku = this.skuVariablePrefix[prefix]
                if (sku.currency !== currency) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Moneda no permitida para este SKU')
                if (amountCents <= 0 || amountCents % sku.unitCents !== 0) {
                    throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto inválido para SKU variable')
                }
                return
            }
        }

        // Payment quote
        if (normalizedId.startsWith('quote:')) {
            const quoteId = orderId.split(':')[1]
            if (!quoteId) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Quote inválido')
            const app = getRunningExpressApp()
            const quoteRows = await app.AppDataSource.query(`SELECT * FROM payment_quote WHERE id = $1 LIMIT 1`, [quoteId])
            const quote = quoteRows?.[0]
            if (!quote) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Quote no encontrado')
            if (quote.currency !== currency) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Moneda no coincide con el quote')
            if (quote.amount_cents !== amountCents)
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto no coincide con el quote')
            if (!isAdmin) {
                if (quote.user_email && quote.user_email !== currentEmail) {
                    throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Quote asignado a otro usuario')
                }
                if (quote.user_id && quote.user_id !== currentUserId) {
                    throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Quote asignado a otro usuario')
                }
            }
            return
        }

        // Buscar por UUID (nuevo identificador de sales)
        if (uuidPattern.test(orderId)) {
            const app = getRunningExpressApp()
            const saleRows = await app.AppDataSource.query(
                `SELECT sale_uuid, amount_cents, currency, final_price, total_price, unit_price, quantity FROM sales WHERE sale_uuid = $1 LIMIT 1`,
                [orderId]
            )
            const sale = saleRows?.[0]
            if (!sale) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Orden no encontrada')
            }
            const resolvedCurrency = sale.currency || currency
            if (resolvedCurrency && resolvedCurrency !== currency) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Moneda no coincide con la orden')
            }
            const resolvedCents = this.resolveAmountCents(sale)
            if (resolvedCents !== amountCents) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto no coincide con la orden')
            }
            return
        }

        // Fallback: validar contra tabla sales
        const numericId = Number(orderId)
        if (!Number.isFinite(numericId)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'orderId inválido')
        }
        const app = getRunningExpressApp()
        const saleRows = await app.AppDataSource.query(
            `SELECT sale_uuid, amount_cents, currency, final_price, total_price, unit_price, quantity FROM sales WHERE id = $1 LIMIT 1`,
            [numericId]
        )
        const sale = saleRows?.[0]

        if (!sale) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Orden no encontrada')
        }

        const resolvedCurrency = sale.currency || currency
        if (resolvedCurrency && resolvedCurrency !== currency) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Moneda no coincide con la orden')
        }

        const resolvedCents = this.resolveAmountCents(sale)
        if (resolvedCents !== amountCents) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto no coincide con la orden')
        }
    }

    private resolveAmountCents(row: any): number {
        const finalPrice = row?.final_price ?? row?.finalPrice
        const totalPrice = row?.total_price ?? row?.totalPrice
        const unitPrice = row?.unit_price ?? row?.unitPrice
        const quantity = row?.quantity ?? 1
        const amountCents = row?.amount_cents ?? row?.amountCents

        if (typeof amountCents === 'number' && Number.isFinite(amountCents) && amountCents > 0) {
            return Math.round(amountCents)
        }

        const resolved =
            finalPrice !== null && finalPrice !== undefined
                ? Number(finalPrice)
                : totalPrice !== null && totalPrice !== undefined
                ? Number(totalPrice)
                : Number(unitPrice || 0) * Number(quantity || 1)

        if (!Number.isFinite(resolved)) return 0
        return Math.round(resolved * 100)
    }
}

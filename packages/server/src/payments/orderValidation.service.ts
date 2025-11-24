import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

export class OrderValidationService {
    async validateAmount(orderId: string, amountCents: number) {
        const numericId = Number(orderId)
        if (!Number.isFinite(numericId)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'orderId inválido')
        }
        const app = getRunningExpressApp()
        const saleRows = await app.AppDataSource.query(`SELECT * FROM sales WHERE id = $1 LIMIT 1`, [numericId])
        const sale = saleRows?.[0]

        if (!sale) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Orden no encontrada')
        }

        // Preferimos final_price, luego total_price, luego unit_price * quantity
        const finalPrice = sale.final_price ?? sale.finalPrice
        const totalPrice = sale.total_price ?? sale.totalPrice
        const unitPrice = sale.unit_price ?? sale.unitPrice
        const quantity = sale.quantity ?? 1

        const resolved =
            finalPrice !== null && finalPrice !== undefined
                ? Number(finalPrice)
                : totalPrice !== null && totalPrice !== undefined
                ? Number(totalPrice)
                : Number(unitPrice || 0) * Number(quantity || 1)

        if (!Number.isFinite(resolved)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto de orden inválido')
        }

        const resolvedCents = Math.round(resolved * 100)
        if (resolvedCents !== amountCents) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Monto no coincide con la orden')
        }
    }
}

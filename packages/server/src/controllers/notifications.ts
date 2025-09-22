import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import logger from '../utils/logger'

type NotificationPayload = {
    customerId?: number | null
    phoneNumber?: string | null
    followUpType: string
    status?: string
    message?: string | null
    nextAction?: string | null
    saleId?: number | null
    scheduledAt?: string | null
    metadata?: any
}

const resolveCustomerContext = async (clientId?: string, phoneNumber?: string) => {
    let resolvedCustomerId: number | null = null
    let resolvedPhone = phoneNumber ?? null

    if (!clientId && resolvedPhone) {
        return { customerId: null, phone: resolvedPhone }
    }

    if (clientId) {
        const trimmed = clientId.trim()
        const isNumeric = /^\d+$/.test(trimmed)
        const appServer = getRunningExpressApp()

        if (isNumeric) {
            const result = await appServer.AppDataSource.query('SELECT id, phone_number FROM customers WHERE id = $1', [parseInt(trimmed)])
            if (result.length > 0) {
                resolvedCustomerId = result[0].id
                resolvedPhone = resolvedPhone ?? result[0].phone_number ?? null
            }
        }

        if (resolvedCustomerId === null) {
            const byPhone = await appServer.AppDataSource.query('SELECT id, phone_number FROM customers WHERE phone_number = $1', [trimmed])
            if (byPhone.length > 0) {
                resolvedCustomerId = byPhone[0].id
                resolvedPhone = resolvedPhone ?? byPhone[0].phone_number ?? null
            }
        }
    }

    return { customerId: resolvedCustomerId, phone: resolvedPhone }
}

const insertNotificationFollowUp = async (payload: NotificationPayload) => {
    const {
        customerId = null,
        phoneNumber = 'internal',
        followUpType,
        status = 'pending',
        message = null,
        nextAction = null,
        saleId = null,
        scheduledAt = null,
        metadata = null
    } = payload

    const appServer = getRunningExpressApp()

    const result = await appServer.AppDataSource.query(
        `INSERT INTO follow_ups (
            customer_id,
            phone_number,
            sale_id,
            follow_up_type,
            scheduled_at,
            status,
            attempt_number,
            max_attempts,
            message_sent,
            customer_response,
            next_action,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, 1, $7, $8, $9, NOW(), NOW()) RETURNING *`,
        [
            customerId,
            phoneNumber ?? 'internal',
            saleId,
            followUpType,
            scheduledAt,
            status,
            message,
            metadata ? JSON.stringify(metadata) : null,
            nextAction
        ]
    )

    return result[0]
}

const createNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, title, message, priority = 'medium', clientId, saleId, actionRequired, dueDate, metadata } = req.body

        if (!type || !title || !message) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'type, title and message are required')
        }

        const { customerId, phone } = await resolveCustomerContext(clientId)
        const parsedSaleId = saleId && /^\d+$/.test(String(saleId)) ? parseInt(saleId) : null

        const followUp = await insertNotificationFollowUp({
            customerId,
            phoneNumber: phone ?? 'internal',
            followUpType: `notification_${type}`,
            status: 'pending',
            message: `${title}: ${message}`,
            nextAction: actionRequired ?? priority,
            saleId: parsedSaleId,
            scheduledAt: dueDate ?? null,
            metadata
        })

        return res.status(StatusCodes.CREATED).json({
            message: 'Notification stored',
            followUp
        })
    } catch (error) {
        logger.error('Error creating notification:', error)
        return next(error)
    }
}

const notifyPriceApproval = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            approvalRequestId,
            clientId,
            phoneNumber,
            approved,
            newPrice,
            discountPercentage,
            validUntil,
            reason
        } = req.body

        if (!approvalRequestId || approved === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'approvalRequestId and approved flag are required')
        }

        const { customerId, phone } = await resolveCustomerContext(clientId, phoneNumber)
        const parsedSaleId = approvalRequestId && /^\d+$/.test(String(approvalRequestId)) ? parseInt(approvalRequestId) : null

        if (parsedSaleId) {
            try {
                const appServer = getRunningExpressApp()
                const noteParts: string[] = []
                noteParts.push(approved ? 'Descuento aprobado' : 'Descuento rechazado')
                if (newPrice !== undefined) {
                    noteParts.push(`Nuevo precio: ${newPrice}`)
                }
                if (discountPercentage !== undefined) {
                    noteParts.push(`Descuento: ${discountPercentage}%`)
                }
                if (reason) {
                    noteParts.push(`Motivo: ${reason}`)
                }

                const updateFields: string[] = ["agent_notes = COALESCE(agent_notes, '') || $2", 'updated_at = NOW()']
                const params: any[] = [parsedSaleId, `\n${noteParts.join(' - ')}`]
                if (newPrice !== undefined) {
                    updateFields.push('final_price = $' + (params.length + 1))
                    params.push(newPrice)
                }

                await appServer.AppDataSource.query(
                    `UPDATE sales SET ${updateFields.join(', ')} WHERE id = $1`,
                    params
                )
            } catch (error) {
                logger.warn('Unable to update sale with price approval details', { approvalRequestId, error })
            }
        }

        const followUp = await insertNotificationFollowUp({
            customerId,
            phoneNumber: phone ?? 'internal',
            followUpType: 'price_approval',
            status: approved ? 'completed' : 'pending',
            message: approved ? 'Solicitud de descuento aprobada' : 'Solicitud de descuento rechazada',
            nextAction: approved ? 'confirm_sale' : 'continue_negotiation',
            saleId: parsedSaleId,
            scheduledAt: validUntil ?? null,
            metadata: {
                approved,
                newPrice,
                discountPercentage,
                reason
            }
        })

        return res.json({
            message: 'Price approval notification registered',
            followUp
        })
    } catch (error) {
        logger.error('Error notifying price approval:', error)
        return next(error)
    }
}

const notifyDeliveryImprovement = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            deliveryRequestId,
            clientId,
            phoneNumber,
            improved,
            newDeliveryTime,
            originalDeliveryTime,
            reason,
            additionalCost
        } = req.body

        if (!deliveryRequestId || originalDeliveryTime === undefined || improved === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'deliveryRequestId, improved flag and originalDeliveryTime are required')
        }

        const { customerId, phone } = await resolveCustomerContext(clientId, phoneNumber)
        const parsedSaleId = deliveryRequestId && /^\d+$/.test(String(deliveryRequestId)) ? parseInt(deliveryRequestId) : null

        if (parsedSaleId) {
            try {
                const appServer = getRunningExpressApp()
                const note = improved
                    ? `Entrega mejorada a ${newDeliveryTime ?? originalDeliveryTime} días`
                    : 'No se pudo mejorar el tiempo de entrega'
                await appServer.AppDataSource.query(
                    `UPDATE sales SET agent_notes = COALESCE(agent_notes, '') || $2, updated_at = NOW() WHERE id = $1`,
                    [parsedSaleId, `\n${note}${additionalCost ? ` - Costo adicional: ${additionalCost}` : ''}`]
                )
            } catch (error) {
                logger.warn('Unable to update sale with delivery notes', { deliveryRequestId, error })
            }
        }

        const followUp = await insertNotificationFollowUp({
            customerId,
            phoneNumber: phone ?? 'internal',
            followUpType: 'delivery_improvement',
            status: improved ? 'completed' : 'pending',
            message: improved
                ? `Se mejoró la entrega a ${newDeliveryTime ?? originalDeliveryTime} días`
                : 'Sin mejoras disponibles para la entrega',
            nextAction: improved ? 'confirm_delivery' : 'offer_alternative',
            saleId: parsedSaleId,
            metadata: {
                improved,
                newDeliveryTime,
                originalDeliveryTime,
                reason,
                additionalCost
            }
        })

        return res.json({
            message: 'Delivery notification registered',
            followUp
        })
    } catch (error) {
        logger.error('Error notifying delivery improvement:', error)
        return next(error)
    }
}

const notifyStockAvailable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId, phoneNumber, productId, productName, quantity, price, reservationTime, originalInquiryDate } = req.body

        if (!productId || quantity === undefined || price === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'productId, quantity and price are required')
        }

        const { customerId, phone } = await resolveCustomerContext(clientId, phoneNumber)

        const followUp = await insertNotificationFollowUp({
            customerId,
            phoneNumber: phone ?? 'internal',
            followUpType: 'stock_available',
            status: 'pending',
            message: `Stock disponible para ${productName ?? productId}: ${quantity} unidades a ${price}`,
            nextAction: reservationTime ? `Reservar por ${reservationTime} horas` : 'contact_customer',
            metadata: {
                productId,
                quantity,
                price,
                reservationTime,
                originalInquiryDate
            }
        })

        return res.json({
            message: 'Stock availability notification stored',
            followUp
        })
    } catch (error) {
        logger.error('Error notifying stock availability:', error)
        return next(error)
    }
}

export default {
    createNotification,
    notifyPriceApproval,
    notifyDeliveryImprovement,
    notifyStockAvailable
}

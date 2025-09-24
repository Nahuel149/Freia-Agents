import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer'

type FollowUpInsertPayload = {
    customer_id?: number | null
    phone_number?: string | null
    sale_id?: number | null
    follow_up_type: string
    scheduled_at?: string | null
    status?: string
    attempt_number?: number
    max_attempts?: number
    message_sent?: string | null
    customer_response?: string | null
    next_action?: string | null
    completed_at?: string | null
}

const extractDigits = (value?: string | null): string | null => {
    if (!value) return null
    const digits = value.replace(/[^0-9]/g, '')
    return digits.length >= 7 ? digits : null
}

const parseNullableNumber = (value?: string | number | null): number | null => {
    if (value === null || value === undefined) return null
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const cleaned = value.trim()
        if (!cleaned) return null
        const parsed = Number(cleaned)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

const insertFollowUpRecord = async (payload: FollowUpInsertPayload) => {
    const {
        customer_id = null,
        phone_number,
        sale_id = null,
        follow_up_type,
        scheduled_at = null,
        status = 'pending',
        attempt_number = 1,
        max_attempts = 3,
        message_sent = null,
        customer_response = null,
        next_action = null,
        completed_at = null
    } = payload

    if (!phone_number) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
    }

    // Ensure scheduled_at is never null - use current timestamp if not provided
    const finalScheduledAt = scheduled_at || new Date().toISOString()

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
            completed_at,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *`,
        [
            customer_id,
            phone_number,
            sale_id,
            follow_up_type,
            finalScheduledAt,
            status,
            attempt_number,
            max_attempts,
            message_sent,
            customer_response,
            next_action,
            completed_at
        ]
    )

    return result[0]
}

// Get all follow-ups
const getAllFollowUps = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 50, status, type, phone } = req.query
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

        let query = 'SELECT * FROM follow_ups WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (status) {
            query += ` AND status = $${paramIndex}`
            params.push(status)
            paramIndex++
        }

        if (type) {
            query += ` AND follow_up_type = $${paramIndex}`
            params.push(type)
            paramIndex++
        }

        if (phone) {
            query += ` AND phone_number ILIKE $${paramIndex}`
            params.push(`%${phone}%`)
            paramIndex++
        }

        query += ` ORDER BY scheduled_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
        params.push(parseInt(limit as string), offset)

        const countQuery = 'SELECT COUNT(*) as total FROM follow_ups'

        const appServer = getRunningExpressApp()
        const [followUps, countResult] = await Promise.all([
            appServer.AppDataSource.query(query, params),
            appServer.AppDataSource.query(countQuery)
        ])

        return res.json({
            followUps,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total: parseInt(countResult[0].total),
                totalPages: Math.ceil(countResult[0].total / parseInt(limit as string))
            }
        })
    } catch (error) {
        logger.error('Error getting all follow-ups:', error)
        return next(error)
    }
}

// Get follow-up by ID
const getFollowUpById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Follow-up ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = 'SELECT * FROM follow_ups WHERE id = $1'
        const result = await appServer.AppDataSource.query(query, [parseInt(id)])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Follow-up not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting follow-up by ID:', error)
        return next(error)
    }
}

// Get follow-ups by customer phone
const getFollowUpsByPhone = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone } = req.params
        if (!phone) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM follow_ups 
            WHERE phone_number = $1 
            ORDER BY scheduled_at ASC
        `
        const result = await appServer.AppDataSource.query(query, [phone])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting follow-ups by phone:', error)
        return next(error)
    }
}

// Get follow-ups by customer ID
const getFollowUpsByCustomerId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { customerId } = req.params
        if (!customerId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Customer ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM follow_ups 
            WHERE customer_id = $1 
            ORDER BY scheduled_at ASC
        `
        const result = await appServer.AppDataSource.query(query, [parseInt(customerId)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting follow-ups by customer ID:', error)
        return next(error)
    }
}

// Create new follow-up
const createFollowUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            customer_id,
            customerId,
            client_id,
            clientId,
            phone_number,
            phoneNumber,
            phone,
            contact_phone,
            client_phone,
            clientPhone,
            follow_up_type,
            followUpType,
            reason,
            scheduled_at,
            scheduledAt,
            scheduled_date,
            date,
            status,
            sale_id,
            related_sale_id,
            message_sent,
            customer_response,
            next_action,
            notes,
            contact_method,
            priority,
            assigned_to,
            attempt_number,
            max_attempts,
            completed_at
        } = req.body

        const rawCustomerIdentifier = customer_id ?? customerId ?? client_id ?? clientId ?? null
        const numericCustomerId = parseNullableNumber(rawCustomerIdentifier)

        let resolvedPhone =
            phone_number ??
            phoneNumber ??
            phone ??
            contact_phone ??
            client_phone ??
            clientPhone ??
            null

        if (!resolvedPhone) {
            const digitsFromId = typeof rawCustomerIdentifier === 'string' ? extractDigits(rawCustomerIdentifier) : null
            if (digitsFromId) {
                resolvedPhone = digitsFromId
            }
        }

        if (!resolvedPhone && typeof notes === 'string') {
            const digitsFromNotes = extractDigits(notes)
            if (digitsFromNotes) {
                resolvedPhone = digitsFromNotes
            }
        }

        if (!resolvedPhone) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Phone number is required (provide phone_number, clientPhone o incluye el teléfono en customer_id/notes)'
            )
        }

        let normalisedPhone = resolvedPhone
        try {
            const normalised = normalizePhoneNumber(resolvedPhone)
            if (normalised && isValidPhoneNumber(normalised)) {
                normalisedPhone = normalised
            }
        } catch {
            const digits = extractDigits(resolvedPhone)
            if (digits) normalisedPhone = digits
        }

        const resolvedFollowUpType = (follow_up_type || followUpType || reason || 'general').toString()

        const scheduledRaw = scheduled_at || scheduledAt || scheduled_date || date || null
        let resolvedScheduledAt: string
        if (scheduledRaw) {
            const dateObj = new Date(scheduledRaw)
            resolvedScheduledAt = Number.isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString()
        } else {
            resolvedScheduledAt = new Date().toISOString()
        }

        const resolvedSaleId = (() => {
            const direct = parseNullableNumber(sale_id)
            if (direct !== null) return direct
            const digits = typeof related_sale_id === 'string' ? extractDigits(related_sale_id) : null
            return digits ? parseNullableNumber(digits) : null
        })()

        const messageParts: string[] = []
        if (notes) messageParts.push(String(notes))
        if (reason && reason !== resolvedFollowUpType) messageParts.push(`Motivo: ${reason}`)
        if (contact_method) messageParts.push(`Canal: ${contact_method}`)
        if (priority) messageParts.push(`Prioridad: ${priority}`)
        if (related_sale_id && resolvedSaleId === null) {
            messageParts.push(`Referencia venta: ${related_sale_id}`)
        }

        const followUpNotes = messageParts.length ? messageParts.join(' | ') : message_sent ?? null

        const nextActionParts: string[] = []
        if (assigned_to) nextActionParts.push(`Asignado a: ${assigned_to}`)
        if (next_action) nextActionParts.push(String(next_action))
        const resolvedNextAction = nextActionParts.length ? nextActionParts.join(' | ') : null

        const result = await insertFollowUpRecord({
            customer_id: numericCustomerId,
            phone_number: normalisedPhone,
            sale_id: resolvedSaleId,
            follow_up_type: resolvedFollowUpType,
            scheduled_at: resolvedScheduledAt,
            status: status ?? 'pending',
            attempt_number: attempt_number ?? 1,
            max_attempts: max_attempts ?? 3,
            message_sent: followUpNotes,
            customer_response: customer_response ?? null,
            next_action: resolvedNextAction,
            completed_at: completed_at ?? null
        })

        return res.status(StatusCodes.CREATED).json(result)
    } catch (error) {
        logger.error('Error creating follow-up:', error)
        return next(error)
    }
}

const createFollowUpAlias = async (req: Request, res: Response, next: NextFunction) => {
    return createFollowUp(req, res, next)
}

// Update follow-up
const updateFollowUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const {
            scheduled_at,
            status,
            attempt_number,
            max_attempts,
            message_sent,
            customer_response,
            next_action,
            completed_at,
            sale_id
        } = req.body

        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Follow-up ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if follow-up exists
        const existingFollowUp = await appServer.AppDataSource.query(
            'SELECT * FROM follow_ups WHERE id = $1',
            [parseInt(id)]
        )

        if (existingFollowUp.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Follow-up not found')
        }

        // Build update query dynamically
        let updateQuery = 'UPDATE follow_ups SET updated_at = NOW()'
        const params: any[] = []
        let paramIndex = 1

        if (scheduled_at !== undefined) {
            updateQuery += `, scheduled_at = $${paramIndex}`
            params.push(scheduled_at)
            paramIndex++
        }

        if (status !== undefined) {
            updateQuery += `, status = $${paramIndex}`
            params.push(status)
            paramIndex++
        }

        if (completed_at !== undefined) {
            updateQuery += `, completed_at = $${paramIndex}`
            params.push(completed_at)
            paramIndex++
        }

        if (attempt_number !== undefined) {
            updateQuery += `, attempt_number = $${paramIndex}`
            params.push(attempt_number)
            paramIndex++
        }

        if (max_attempts !== undefined) {
            updateQuery += `, max_attempts = $${paramIndex}`
            params.push(max_attempts)
            paramIndex++
        }

        if (message_sent !== undefined) {
            updateQuery += `, message_sent = $${paramIndex}`
            params.push(message_sent)
            paramIndex++
        }

        if (customer_response !== undefined) {
            updateQuery += `, customer_response = $${paramIndex}`
            params.push(customer_response)
            paramIndex++
        }

        if (next_action !== undefined) {
            updateQuery += `, next_action = $${paramIndex}`
            params.push(next_action)
            paramIndex++
        }

        if (sale_id !== undefined) {
            updateQuery += `, sale_id = $${paramIndex}`
            params.push(sale_id)
            paramIndex++
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`
        params.push(parseInt(id))

        const result = await appServer.AppDataSource.query(updateQuery, params)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error updating follow-up:', error)
        return next(error)
    }
}

const getPendingFollowUps = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = 25 } = req.query
        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(
            `SELECT * FROM follow_ups WHERE status IN ('pending', 'in_progress') ORDER BY scheduled_at ASC LIMIT $1`,
            [parseInt(limit as string)]
        )

        return res.json({ pending: result, total: result.length })
    } catch (error) {
        logger.error('Error getting pending follow-ups:', error)
        return next(error)
    }
}

const scheduleFollowUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            customerId,
            clientId, // alias for customerId
            phoneNumber,
            saleId,
            followUpType,
            scheduledAt,
            date, // alias for scheduledAt
            attemptNumber,
            maxAttempts,
            reason,
            note, // alias for reason
            productInterest,
            lastInteractionDate,
            priority
        } = req.body

        let resolvedPhone = phoneNumber ?? null
        let resolvedCustomerId = customerId ?? clientId ?? null

        // If no phone number provided, try to look it up from customer ID
        if (!resolvedPhone && resolvedCustomerId) {
            try {
                const appServer = getRunningExpressApp()
                const customerIdStr = String(resolvedCustomerId).trim()
                
                // Check if it's a valid numeric ID
                if (/^\d+$/.test(customerIdStr)) {
                    const lookup = await appServer.AppDataSource.query(
                        'SELECT phone_number FROM customers WHERE id = $1',
                        [parseInt(customerIdStr)]
                    )
                    
                    if (lookup.length > 0 && lookup[0].phone_number) {
                        resolvedPhone = lookup[0].phone_number
                    }
                }
            } catch (error) {
                logger.error('Error looking up phone number from customer ID', { 
                    customerId: resolvedCustomerId, 
                    error: error instanceof Error ? error.message : error
                })
            }
        }

        if (!resolvedPhone) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'phoneNumber or a customer with phone_number is required')
        }

        // Use date field if provided, otherwise use scheduledAt
        const finalScheduledAt = date ?? scheduledAt ?? lastInteractionDate ?? new Date().toISOString()
        const finalReason = note ?? reason ?? null

        const result = await insertFollowUpRecord({
            customer_id: resolvedCustomerId ? parseInt(resolvedCustomerId) : null,
            phone_number: resolvedPhone,
            sale_id: saleId ? parseInt(saleId) : null,
            follow_up_type: followUpType ?? 'sales_follow_up',
            scheduled_at: finalScheduledAt,
            status: 'pending',
            attempt_number: attemptNumber ? parseInt(attemptNumber) : 1,
            max_attempts: maxAttempts ? parseInt(maxAttempts) : 3,
            message_sent: finalReason,
            customer_response: null,
            next_action: productInterest ?? priority ?? null
        })

        return res.status(StatusCodes.CREATED).json({ followUp: result })
    } catch (error) {
        logger.error('Error scheduling follow-up:', error)
        return next(error)
    }
}

const executeFollowUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { followUpId, customMessage, executionNotes } = req.body

        if (!followUpId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'followUpId is required')
        }

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(
            `UPDATE follow_ups SET 
                status = 'completed',
                completed_at = NOW(),
                message_sent = COALESCE($2, message_sent),
                next_action = COALESCE($3, next_action),
                updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [parseInt(followUpId), customMessage ?? null, executionNotes ?? null]
        )

        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Follow-up not found')
        }

        return res.json({ followUp: result[0] })
    } catch (error) {
        logger.error('Error executing follow-up:', error)
        return next(error)
    }
}

const updateFollowUpStatusAlias = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            followUpId,
            status,
            result,
            customerResponse,
            nextAction,
            rescheduleDate,
            notes
        } = req.body

        if (!followUpId || !status) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'followUpId and status are required')
        }

        const appServer = getRunningExpressApp()

        const updates: string[] = ['updated_at = NOW()']
        const params: any[] = [parseInt(followUpId)]
        let paramIndex = 2

        updates.push(`status = $${paramIndex}`)
        params.push(status)
        paramIndex++

        if (result !== undefined) {
            updates.push(`message_sent = $${paramIndex}`)
            params.push(result)
            paramIndex++
        }

        if (customerResponse !== undefined) {
            updates.push(`customer_response = $${paramIndex}`)
            params.push(customerResponse)
            paramIndex++
        }

        if (nextAction !== undefined) {
            updates.push(`next_action = $${paramIndex}`)
            params.push(nextAction)
            paramIndex++
        }

        if (rescheduleDate) {
            updates.push(`scheduled_at = $${paramIndex}`)
            params.push(rescheduleDate)
            paramIndex++
        }

        if (notes !== undefined) {
            updates.push(`message_sent = COALESCE($${paramIndex}, message_sent)`)
            params.push(notes)
            paramIndex++
        }

        if (status === 'completed' && !rescheduleDate) {
            updates.push('completed_at = NOW()')
        }

        const query = `UPDATE follow_ups SET ${updates.join(', ')} WHERE id = $1 RETURNING *`

        const resultRows = await appServer.AppDataSource.query(query, params)

        if (resultRows.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Follow-up not found')
        }

        return res.json({ followUp: resultRows[0] })
    } catch (error) {
        logger.error('Error updating follow-up status:', error)
        return next(error)
    }
}

const getFollowUpAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()

        const summary = await appServer.AppDataSource.query(
            `SELECT 
                COUNT(*) AS total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
                COUNT(CASE WHEN scheduled_at::date = CURRENT_DATE THEN 1 END) AS due_today,
                COUNT(CASE WHEN scheduled_at < NOW() AND status IN ('pending', 'in_progress') THEN 1 END) AS overdue
            FROM follow_ups`
        )

        const byType = await appServer.AppDataSource.query(
            `SELECT follow_up_type AS type, COUNT(*) AS count FROM follow_ups GROUP BY follow_up_type ORDER BY count DESC`
        )

        return res.json({
            summary: summary[0],
            byType
        })
    } catch (error) {
        logger.error('Error getting follow-up analytics:', error)
        return next(error)
    }
}

// Get follow-ups due today
const getFollowUpsDueToday = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM follow_ups 
            WHERE DATE(scheduled_at) = CURRENT_DATE 
            AND status IN ('pending', 'in_progress')
            ORDER BY scheduled_at ASC
        `
        
        const result = await appServer.AppDataSource.query(query)
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting follow-ups due today:', error)
        return next(error)
    }
}

// Get overdue follow-ups
const getOverdueFollowUps = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM follow_ups 
            WHERE scheduled_at < NOW() 
            AND status IN ('pending', 'in_progress')
            ORDER BY scheduled_at ASC
        `
        
        const result = await appServer.AppDataSource.query(query)
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting overdue follow-ups:', error)
        return next(error)
    }
}

// Get follow-ups statistics
const getFollowUpsStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_follow_ups,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_follow_ups,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_follow_ups,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_follow_ups,
                COUNT(CASE WHEN DATE(scheduled_at) = CURRENT_DATE AND status IN ('pending', 'in_progress') THEN 1 END) as due_today,
                COUNT(CASE WHEN scheduled_at < NOW() AND status IN ('pending', 'in_progress') THEN 1 END) as overdue,
                COUNT(CASE WHEN follow_up_type = 'sales_follow_up' THEN 1 END) as sales_follow_ups,
                COUNT(CASE WHEN follow_up_type = 'customer_service' THEN 1 END) as service_follow_ups,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as created_last_week
            FROM follow_ups
        `
        
        const result = await appServer.AppDataSource.query(statsQuery)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting follow-ups stats:', error)
        return next(error)
    }
}

// Get follow-ups by type
const getFollowUpsByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.params
        const { limit = 50 } = req.query

        if (!type) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Follow-up type is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM follow_ups 
            WHERE follow_up_type = $1
            ORDER BY scheduled_at ASC
            LIMIT $2
        `
        
        const result = await appServer.AppDataSource.query(query, [type, parseInt(limit as string)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting follow-ups by type:', error)
        return next(error)
    }
}

export default {
    getAllFollowUps,
    getFollowUpById,
    getFollowUpsByPhone,
    getFollowUpsByCustomerId,
    createFollowUp,
     createFollowUpAlias,
    updateFollowUp,
    getFollowUpsDueToday,
    getOverdueFollowUps,
    getFollowUpsStats,
    getFollowUpsByType,
    getPendingFollowUps,
    scheduleFollowUp,
    executeFollowUp,
    updateFollowUpStatusAlias,
    getFollowUpAnalytics
}

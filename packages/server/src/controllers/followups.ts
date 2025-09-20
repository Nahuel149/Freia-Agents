import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

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
            phone_number,
            follow_up_type,
            scheduled_at,
            status = 'pending',
            priority = 'medium',
            notes,
            agent_id,
            related_sale_id
        } = req.body

        if (!phone_number || !follow_up_type || !scheduled_at) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number, follow-up type, and scheduled date are required')
        }

        const appServer = getRunningExpressApp()
        
        const query = `
            INSERT INTO follow_ups (
                customer_id, phone_number, follow_up_type, scheduled_at,
                status, priority, notes, agent_id, related_sale_id,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [
            customer_id, phone_number, follow_up_type, scheduled_at,
            status, priority, notes, agent_id, related_sale_id
        ])
        
        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating follow-up:', error)
        return next(error)
    }
}

// Update follow-up
const updateFollowUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const {
            scheduled_at,
            status,
            priority,
            notes,
            agent_id,
            completed_at,
            outcome,
            next_follow_up_date
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

        if (priority !== undefined) {
            updateQuery += `, priority = $${paramIndex}`
            params.push(priority)
            paramIndex++
        }

        if (notes !== undefined) {
            updateQuery += `, notes = $${paramIndex}`
            params.push(notes)
            paramIndex++
        }

        if (agent_id !== undefined) {
            updateQuery += `, agent_id = $${paramIndex}`
            params.push(agent_id)
            paramIndex++
        }

        if (completed_at !== undefined) {
            updateQuery += `, completed_at = $${paramIndex}`
            params.push(completed_at)
            paramIndex++
        }

        if (outcome !== undefined) {
            updateQuery += `, outcome = $${paramIndex}`
            params.push(outcome)
            paramIndex++
        }

        if (next_follow_up_date !== undefined) {
            updateQuery += `, next_follow_up_date = $${paramIndex}`
            params.push(next_follow_up_date)
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
    updateFollowUp,
    getFollowUpsDueToday,
    getOverdueFollowUps,
    getFollowUpsStats,
    getFollowUpsByType
}
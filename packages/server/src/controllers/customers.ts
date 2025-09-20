import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

// Get all customers
const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 50 } = req.query
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM customers 
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `
        const countQuery = 'SELECT COUNT(*) as total FROM customers'
        
        const [customers, countResult] = await Promise.all([
            appServer.AppDataSource.query(query, [parseInt(limit as string), offset]),
            appServer.AppDataSource.query(countQuery)
        ])

        return res.json({
            customers,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total: parseInt(countResult[0].total),
                totalPages: Math.ceil(countResult[0].total / parseInt(limit as string))
            }
        })
    } catch (error) {
        logger.error('Error getting all customers:', error)
        return next(error)
    }
}

// Get customer by ID
const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Customer ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = 'SELECT * FROM customers WHERE id = $1'
        const result = await appServer.AppDataSource.query(query, [parseInt(id)])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Customer not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting customer by ID:', error)
        return next(error)
    }
}

// Get customer by phone number
const getCustomerByPhone = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone } = req.params
        if (!phone) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
        }

        const appServer = getRunningExpressApp()
        const query = 'SELECT * FROM customers WHERE phone_number = $1'
        const result = await appServer.AppDataSource.query(query, [phone])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Customer not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting customer by phone:', error)
        return next(error)
    }
}

// Search customers
const searchCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q, phone } = req.query
        
        let query = 'SELECT * FROM customers WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (q) {
            query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
            params.push(`%${q}%`)
            paramIndex++
        }

        if (phone) {
            query += ` AND phone_number ILIKE $${paramIndex}`
            params.push(`%${phone}%`)
            paramIndex++
        }

        query += ' ORDER BY created_at DESC LIMIT 100'

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(query, params)
        
        return res.json(result)
    } catch (error) {
        logger.error('Error searching customers:', error)
        return next(error)
    }
}

// Create new customer
const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { 
            phone_number, 
            first_name, 
            last_name, 
            email, 
            default_address, 
            default_payment_method 
        } = req.body

        if (!phone_number) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if customer already exists
        const existingCustomer = await appServer.AppDataSource.query(
            'SELECT * FROM customers WHERE phone_number = $1',
            [phone_number]
        )

        if (existingCustomer.length > 0) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Customer with this phone number already exists')
        }

        const query = `
            INSERT INTO customers (
                phone_number, first_name, last_name, email, 
                default_address, default_payment_method, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [
            phone_number, first_name, last_name, email, 
            default_address, default_payment_method
        ])
        
        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating customer:', error)
        return next(error)
    }
}

// Update customer
const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const { 
            first_name, 
            last_name, 
            email, 
            default_address, 
            default_payment_method,
            previous_purchases
        } = req.body

        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Customer ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if customer exists
        const existingCustomer = await appServer.AppDataSource.query(
            'SELECT * FROM customers WHERE id = $1',
            [parseInt(id)]
        )

        if (existingCustomer.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Customer not found')
        }

        // Build update query dynamically
        let updateQuery = 'UPDATE customers SET updated_at = NOW()'
        const params: any[] = []
        let paramIndex = 1

        if (first_name !== undefined) {
            updateQuery += `, first_name = $${paramIndex}`
            params.push(first_name)
            paramIndex++
        }

        if (last_name !== undefined) {
            updateQuery += `, last_name = $${paramIndex}`
            params.push(last_name)
            paramIndex++
        }

        if (email !== undefined) {
            updateQuery += `, email = $${paramIndex}`
            params.push(email)
            paramIndex++
        }

        if (default_address !== undefined) {
            updateQuery += `, default_address = $${paramIndex}`
            params.push(default_address)
            paramIndex++
        }

        if (default_payment_method !== undefined) {
            updateQuery += `, default_payment_method = $${paramIndex}`
            params.push(default_payment_method)
            paramIndex++
        }

        if (previous_purchases !== undefined) {
            updateQuery += `, previous_purchases = $${paramIndex}`
            params.push(previous_purchases)
            paramIndex++
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`
        params.push(parseInt(id))

        const result = await appServer.AppDataSource.query(updateQuery, params)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error updating customer:', error)
        return next(error)
    }
}

// Get customer statistics
const getCustomerStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_customers,
                COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as customers_with_email,
                COUNT(CASE WHEN default_address IS NOT NULL AND default_address != '' THEN 1 END) as customers_with_address,
                COUNT(CASE WHEN previous_purchases IS NOT NULL AND previous_purchases != '' THEN 1 END) as returning_customers,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_customers_last_30_days
            FROM customers
        `
        
        const result = await appServer.AppDataSource.query(statsQuery)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting customer stats:', error)
        return next(error)
    }
}

// Get recent customers
const getRecentCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = 10 } = req.query

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM customers 
            ORDER BY created_at DESC
            LIMIT $1
        `
        
        const result = await appServer.AppDataSource.query(query, [parseInt(limit as string)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting recent customers:', error)
        return next(error)
    }
}

export default {
    getAllCustomers,
    getCustomerById,
    getCustomerByPhone,
    searchCustomers,
    createCustomer,
    updateCustomer,
    getCustomerStats,
    getRecentCustomers
}
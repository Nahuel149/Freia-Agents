import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer'

type ResolvedCustomer = {
    customer: any
    resolvedBy: 'id' | 'phone'
}

const resolveCustomer = async (identifier: string): Promise<ResolvedCustomer> => {
    if (!identifier) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Customer identifier is required')
    }

    const appServer = getRunningExpressApp()
    const trimmed = identifier.trim()

    const isNumericId = /^\d+$/.test(trimmed)

    if (isNumericId) {
        const result = await appServer.AppDataSource.query('SELECT * FROM customers WHERE id = $1', [parseInt(trimmed)])
        if (result.length > 0) {
            return { customer: result[0], resolvedBy: 'id' }
        }
    }

    const resultByPhone = await appServer.AppDataSource.query('SELECT * FROM customers WHERE phone_number = $1', [trimmed])
    if (resultByPhone.length > 0) {
        return { customer: resultByPhone[0], resolvedBy: 'phone' }
    }

    if (!isNumericId) {
        const fallback = await appServer.AppDataSource.query('SELECT * FROM customers WHERE id = $1', [parseInt(trimmed)])
        if (fallback.length > 0) {
            return { customer: fallback[0], resolvedBy: 'id' }
        }
    }

    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Customer not found')
}

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
            phone,
            first_name,
            last_name,
            name,
            email,
            default_address,
            address,
            default_payment_method,
            // Accept optional extra fields without failing validation
            company,
            customerType,
            taxId,
            notes
        } = req.body

        // Normalize incoming fields to server schema
        const normalizedPhone = normalizePhoneNumber(phone_number || phone)

        // Validate the normalized phone number
        if (!normalizedPhone) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required (use phone or phone_number)')
        }

        if (!isValidPhoneNumber(normalizedPhone)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid phone number format')
        }
        let normalizedFirstName = first_name
        let normalizedLastName = last_name

        if ((!normalizedFirstName || !normalizedLastName) && typeof name === 'string' && name.trim()) {
            const parts = name.trim().split(/\s+/)
            if (!normalizedFirstName) normalizedFirstName = parts[0]
            if (!normalizedLastName) normalizedLastName = parts.length > 1 ? parts.slice(1).join(' ') : ''
        }

        const normalizedAddress = default_address || address

        const appServer = getRunningExpressApp()

        // Check if customer already exists
        const existingCustomer = await appServer.AppDataSource.query('SELECT * FROM customers WHERE phone_number = $1', [normalizedPhone])

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

        const normalizedPaymentMethod = default_payment_method ?? null
        const result = await appServer.AppDataSource.query(query, [
            normalizedPhone,
            normalizedFirstName,
            normalizedLastName,
            email,
            normalizedAddress,
            normalizedPaymentMethod
        ])

        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating customer:', error)
        return next(error)
    }
}

// Alias to createCustomer using explicit client identifier
const createCustomerAlias = async (req: Request, res: Response, next: NextFunction) => {
    return createCustomer(req, res, next)
}

// Update customer
const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const { first_name, last_name, email, default_address, default_payment_method, previous_purchases } = req.body

        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Customer ID is required')
        }

        const appServer = getRunningExpressApp()

        // Check if customer exists
        const existingCustomer = await appServer.AppDataSource.query('SELECT * FROM customers WHERE id = $1', [parseInt(id)])

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

const buildCustomerFilters = (customer: any) => {
    const conditions: string[] = []
    const params: any[] = []
    let index = 1

    if (customer?.id) {
        conditions.push(`customer_id = $${index}`)
        params.push(customer.id)
        index++
    }

    if (customer?.phone_number) {
        conditions.push(`phone_number = $${index}`)
        params.push(customer.phone_number)
        index++
    }

    return {
        clause: conditions.length > 0 ? conditions.join(' OR ') : '1=0',
        params
    }
}

// Get consolidated customer history
const getCustomerHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId } = req.params
        const { customer } = await resolveCustomer(clientId)

        const appServer = getRunningExpressApp()
        const salesFilter = buildCustomerFilters(customer)

        const salesPromise = appServer.AppDataSource.query(
            `SELECT * FROM sales WHERE ${salesFilter.clause} ORDER BY created_at DESC`,
            salesFilter.params
        )

        const followUpsPromise = appServer.AppDataSource.query(
            `SELECT * FROM follow_ups WHERE ${salesFilter.clause
                .replace(/customer_id/g, 'customer_id')
                .replace(/phone_number/g, 'phone_number')} ORDER BY scheduled_at DESC`,
            salesFilter.params
        )

        const possibleClientIds: string[] = []
        if (customer?.id) {
            possibleClientIds.push(String(customer.id))
        }
        if (customer?.phone_number) {
            possibleClientIds.push(customer.phone_number)
        }

        let saleRecords: any[] = []
        if (possibleClientIds.length > 0) {
            saleRecords = await appServer.AppDataSource.query(
                'SELECT * FROM sale_record WHERE "clientId" = ANY($1::text[]) ORDER BY ts DESC',
                [possibleClientIds]
            )
        }

        const [sales, followUps] = await Promise.all([salesPromise, followUpsPromise])

        return res.json({
            customer,
            sales,
            followUps,
            saleRecords
        })
    } catch (error) {
        logger.error('Error getting customer history:', error)
        return next(error)
    }
}

// Get analytics summary for a customer
const getCustomerAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId } = req.params
        const { customer } = await resolveCustomer(clientId)

        const appServer = getRunningExpressApp()
        const salesFilter = buildCustomerFilters(customer)

        const sales = await appServer.AppDataSource.query(
            `SELECT * FROM sales WHERE ${salesFilter.clause} ORDER BY created_at DESC`,
            salesFilter.params
        )

        const followUps = await appServer.AppDataSource.query(
            `SELECT * FROM follow_ups WHERE ${salesFilter.clause
                .replace(/customer_id/g, 'customer_id')
                .replace(/phone_number/g, 'phone_number')}`,
            salesFilter.params
        )

        const totalSales = sales.length
        const totalAmount = sales.reduce((acc: number, sale: any) => acc + Number(sale.final_price ?? sale.total_price ?? 0), 0)
        const pendingSales = sales.filter((sale: any) => sale.sale_status === 'pending').length
        const negotiationAttempts = sales.reduce((acc: number, sale: any) => acc + Number(sale.negotiation_attempts ?? 0), 0)
        const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0
        const lastPurchase = sales[0]?.created_at ?? null

        const followUpBreakdown = followUps.reduce((acc: any, item: any) => {
            const type = item.follow_up_type ?? 'unknown'
            acc[type] = (acc[type] ?? 0) + 1
            return acc
        }, {})

        return res.json({
            customer,
            summary: {
                totalSales,
                totalAmount,
                pendingSales,
                negotiationAttempts,
                averageTicket,
                lastPurchase,
                followUps: followUps.length,
                followUpBreakdown
            }
        })
    } catch (error) {
        logger.error('Error getting customer analytics:', error)
        return next(error)
    }
}

// Store structured customer preferences
const updateCustomerPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId } = req.params
        const { customer } = await resolveCustomer(clientId)
        const { preferredBrands, preferredCategories, priceRange, paymentMethods, deliveryPreference, communicationPreference } = req.body

        const appServer = getRunningExpressApp()

        let existingData: any = {}
        if (customer.previous_purchases) {
            try {
                existingData = JSON.parse(customer.previous_purchases)
            } catch (error) {
                existingData = { history: customer.previous_purchases }
            }
        }

        existingData.preferences = {
            preferredBrands: Array.isArray(preferredBrands) ? preferredBrands : existingData.preferences?.preferredBrands ?? [],
            preferredCategories: Array.isArray(preferredCategories)
                ? preferredCategories
                : existingData.preferences?.preferredCategories ?? [],
            priceRange: priceRange ?? existingData.preferences?.priceRange ?? null,
            paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : existingData.preferences?.paymentMethods ?? [],
            deliveryPreference: deliveryPreference ?? existingData.preferences?.deliveryPreference ?? null,
            communicationPreference: communicationPreference ?? existingData.preferences?.communicationPreference ?? null,
            updatedAt: new Date().toISOString()
        }

        const preferredPayment =
            Array.isArray(paymentMethods) && paymentMethods.length > 0 ? paymentMethods[0] : customer.default_payment_method

        const updated = await appServer.AppDataSource.query(
            `UPDATE customers SET previous_purchases = $1, default_payment_method = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [JSON.stringify(existingData), preferredPayment ?? null, customer.id]
        )

        return res.json({
            customer: updated[0],
            preferences: existingData.preferences
        })
    } catch (error) {
        logger.error('Error saving customer preferences:', error)
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
    createCustomerAlias,
    updateCustomer,
    getCustomerStats,
    getRecentCustomers,
    getCustomerHistory,
    getCustomerAnalytics,
    updateCustomerPreferences
}

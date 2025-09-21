import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

// Get all sales
const getAllSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 50, status, phone } = req.query
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

        let query = 'SELECT * FROM sales WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (status) {
            query += ` AND sale_status = $${paramIndex}`
            params.push(status)
            paramIndex++
        }

        if (phone) {
            query += ` AND phone_number ILIKE $${paramIndex}`
            params.push(`%${phone}%`)
            paramIndex++
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
        params.push(parseInt(limit as string), offset)

        const countQuery = 'SELECT COUNT(*) as total FROM sales'

        const appServer = getRunningExpressApp()
        const [sales, countResult] = await Promise.all([
            appServer.AppDataSource.query(query, params),
            appServer.AppDataSource.query(countQuery)
        ])

        return res.json({
            sales,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total: parseInt(countResult[0].total),
                totalPages: Math.ceil(countResult[0].total / parseInt(limit as string))
            }
        })
    } catch (error) {
        logger.error('Error getting all sales:', error)
        return next(error)
    }
}

// Get sale by ID
const getSaleById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = 'SELECT * FROM sales WHERE id = $1'
        const result = await appServer.AppDataSource.query(query, [parseInt(id)])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Sale not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting sale by ID:', error)
        return next(error)
    }
}

// Get sales by customer phone
const getSalesByPhone = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone } = req.params
        if (!phone) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM sales 
            WHERE phone_number = $1 
            ORDER BY created_at DESC
        `
        const result = await appServer.AppDataSource.query(query, [phone])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting sales by phone:', error)
        return next(error)
    }
}

// Create new sale
const createSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            customer_id,
            phone_number,
            product_sku,
            product_brand,
            product_model,
            wheel_size,
            quantity = 1,
            unit_price,
            total_price,
            discount_percentage = 0,
            final_price,
            payment_method,
            delivery_method,
            delivery_address,
            sale_status = 'pending',
            agent_notes
        } = req.body

        if (!phone_number || !product_sku) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number and product SKU are required')
        }

        const appServer = getRunningExpressApp()
        
        const query = `
            INSERT INTO sales (
                customer_id, phone_number, product_sku, product_brand, product_model,
                wheel_size, quantity, unit_price, total_price, discount_percentage,
                final_price, payment_method, delivery_method, delivery_address,
                sale_status, negotiation_attempts, agent_notes, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [
            customer_id, phone_number, product_sku, product_brand, product_model,
            wheel_size, quantity, unit_price, total_price, discount_percentage,
            final_price, payment_method, delivery_method, delivery_address,
            sale_status, 0, agent_notes
        ])
        
        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating sale:', error)
        return next(error)
    }
}

// Update sale
const updateSale = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const {
            quantity,
            unit_price,
            total_price,
            discount_percentage,
            final_price,
            payment_method,
            delivery_method,
            delivery_address,
            sale_status,
            negotiation_attempts,
            agent_notes
        } = req.body

        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if sale exists
        const existingSale = await appServer.AppDataSource.query(
            'SELECT * FROM sales WHERE id = $1',
            [parseInt(id)]
        )

        if (existingSale.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Sale not found')
        }

        // Build update query dynamically
        let updateQuery = 'UPDATE sales SET updated_at = NOW()'
        const params: any[] = []
        let paramIndex = 1

        if (quantity !== undefined) {
            updateQuery += `, quantity = $${paramIndex}`
            params.push(quantity)
            paramIndex++
        }

        if (unit_price !== undefined) {
            updateQuery += `, unit_price = $${paramIndex}`
            params.push(unit_price)
            paramIndex++
        }

        if (total_price !== undefined) {
            updateQuery += `, total_price = $${paramIndex}`
            params.push(total_price)
            paramIndex++
        }

        if (discount_percentage !== undefined) {
            updateQuery += `, discount_percentage = $${paramIndex}`
            params.push(discount_percentage)
            paramIndex++
        }

        if (final_price !== undefined) {
            updateQuery += `, final_price = $${paramIndex}`
            params.push(final_price)
            paramIndex++
        }

        if (payment_method !== undefined) {
            updateQuery += `, payment_method = $${paramIndex}`
            params.push(payment_method)
            paramIndex++
        }

        if (delivery_method !== undefined) {
            updateQuery += `, delivery_method = $${paramIndex}`
            params.push(delivery_method)
            paramIndex++
        }

        if (delivery_address !== undefined) {
            updateQuery += `, delivery_address = $${paramIndex}`
            params.push(delivery_address)
            paramIndex++
        }

        if (sale_status !== undefined) {
            updateQuery += `, sale_status = $${paramIndex}`
            params.push(sale_status)
            paramIndex++
        }

        if (negotiation_attempts !== undefined) {
            updateQuery += `, negotiation_attempts = $${paramIndex}`
            params.push(negotiation_attempts)
            paramIndex++
        }

        if (agent_notes !== undefined) {
            updateQuery += `, agent_notes = $${paramIndex}`
            params.push(agent_notes)
            paramIndex++
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`
        params.push(parseInt(id))

        const result = await appServer.AppDataSource.query(updateQuery, params)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error updating sale:', error)
        return next(error)
    }
}

// Get sales statistics
const getSalesStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_sales,
                COUNT(CASE WHEN sale_status = 'completed' THEN 1 END) as completed_sales,
                COUNT(CASE WHEN sale_status = 'pending' THEN 1 END) as pending_sales,
                COUNT(CASE WHEN sale_status = 'cancelled' THEN 1 END) as cancelled_sales,
                SUM(CASE WHEN sale_status = 'completed' THEN final_price ELSE 0 END) as total_revenue,
                AVG(CASE WHEN sale_status = 'completed' THEN final_price END) as average_sale_value,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as sales_last_30_days,
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND sale_status = 'completed' THEN final_price ELSE 0 END) as revenue_last_30_days
            FROM sales
        `
        
        const result = await appServer.AppDataSource.query(statsQuery)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting sales stats:', error)
        return next(error)
    }
}

// Get recent sales
const getRecentSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = 10 } = req.query

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM sales 
            ORDER BY created_at DESC
            LIMIT $1
        `
        
        const result = await appServer.AppDataSource.query(query, [parseInt(limit as string)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting recent sales:', error)
        return next(error)
    }
}

// Get sales by status
const getSalesByStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status } = req.params
        const { limit = 50 } = req.query

        if (!status) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Status is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM sales 
            WHERE sale_status = $1
            ORDER BY created_at DESC
            LIMIT $2
        `
        
        const result = await appServer.AppDataSource.query(query, [status, parseInt(limit as string)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting sales by status:', error)
        return next(error)
    }
}

// Generate sale quote
const createSaleQuote = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { product_sku, quantity = 1 } = req.body
        if (!product_sku) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product SKU is required')
        }
        const appServer = getRunningExpressApp()
        // Try to fetch price from inventory table if available
        const inventoryQuery = 'SELECT price FROM product_inventory WHERE product_sku = $1 LIMIT 1'
        let unitPrice = 0
        try {
            const priceResult = await appServer.AppDataSource.query(inventoryQuery, [product_sku])
            if (priceResult.length > 0) {
                unitPrice = parseFloat(priceResult[0].price)
            }
        } catch {
            // Ignore if table not present yet
        }
        // Fallback unit price
        if (!unitPrice || isNaN(unitPrice)) {
            unitPrice = 100 // default placeholder price
        }
        const totalPrice = unitPrice * quantity
        return res.json({ product_sku, quantity, unit_price: unitPrice, total_price: totalPrice })
    } catch (error) {
        logger.error('Error generating sale quote:', error)
        return next(error)
    }
}

// Get product alternatives
const getProductAlternatives = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { product_sku } = req.query
        if (!product_sku) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product SKU is required')
        }
        const appServer = getRunningExpressApp()
        // Simple heuristic: return up to 5 products with different SKU but same brand prefix
        const altQuery = `SELECT product_sku, name, brand, price FROM product_inventory WHERE product_sku != $1 LIMIT 5`
        const alternatives = await appServer.AppDataSource.query(altQuery, [product_sku])
        return res.json({ alternatives })
    } catch (error) {
        logger.error('Error fetching product alternatives:', error)
        return next(error)
    }
}

// Apply discount to existing sale or quote
const applyDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { base_price, discount_percentage = 0 } = req.body
        if (base_price === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Base price is required')
        }
        const final_price = base_price * (1 - discount_percentage / 100)
        return res.json({ base_price, discount_percentage, final_price })
    } catch (error) {
        logger.error('Error applying discount:', error)
        return next(error)
    }
}

// Request price approval (stub)
const requestPriceApproval = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sale_id, proposed_price } = req.body
        if (!sale_id || proposed_price === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID and proposed price are required')
        }
        // Here you would trigger internal approval workflow
        return res.json({ sale_id, proposed_price, status: 'pending_approval' })
    } catch (error) {
        logger.error('Error requesting price approval:', error)
        return next(error)
    }
}

// Delivery options
const getDeliveryOptions = async (_req: Request, res: Response, _next: NextFunction) => {
    return res.json({ options: ['pickup', 'standard_shipping', 'express_shipping'] })
}

// Delivery improvement
const improveDeliveryTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sale_id, current_eta_days } = req.body
        if (!sale_id || current_eta_days === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID and current ETA are required')
        }
        // Simple improvement heuristic: reduce ETA by 1 day if possible
        const improved_eta = Math.max(current_eta_days - 1, 1)
        return res.json({ sale_id, improved_eta })
    } catch (error) {
        logger.error('Error improving delivery time:', error)
        return next(error)
    }
}

// Payment methods
const getPaymentMethods = async (_req: Request, res: Response, _next: NextFunction) => {
    return res.json({ methods: ['credit_card', 'bank_transfer', 'cash_on_delivery'] })
}

// Order number generation
const generateOrderNumber = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sale_id } = req.body
        if (!sale_id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID is required')
        }
        const order_number = `ORD-${sale_id}-${Date.now().toString().slice(-6)}`
        return res.json({ sale_id, order_number })
    } catch (error) {
        logger.error('Error generating order number:', error)
        return next(error)
    }
}

// Sale summary
const getSaleSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { saleId } = req.params
        if (!saleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Sale ID is required')
        }
        const appServer = getRunningExpressApp()
        const saleQuery = 'SELECT * FROM sales WHERE id = $1'
        const saleRecordQuery = 'SELECT * FROM sale_record WHERE sale_id = $1'
        const [saleResult, recordResult] = await Promise.all([
            appServer.AppDataSource.query(saleQuery, [saleId]),
            appServer.AppDataSource.query(saleRecordQuery, [saleId]).catch(() => [])
        ])
        if (saleResult.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Sale not found')
        }
        return res.json({ sale: saleResult[0], records: recordResult })
    } catch (error) {
        logger.error('Error getting sale summary:', error)
        return next(error)
    }
}

export default {
    getAllSales,
    getSaleById,
    getSalesByPhone,
    createSale,
    updateSale,
    getSalesStats,
    getRecentSales,
    getSalesByStatus,
    // new exports
    createSaleQuote,
    getProductAlternatives,
    applyDiscount,
    requestPriceApproval,
    getDeliveryOptions,
    improveDeliveryTime,
    getPaymentMethods,
    generateOrderNumber,
    getSaleSummary
}
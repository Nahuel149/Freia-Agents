import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

type InventoryUpdates = {
    stock?: number
    price?: number
}

const applyInventoryUpdate = async (productId: string, updates: InventoryUpdates) => {
    const { stock, price } = updates

    if (stock === undefined && price === undefined) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Stock or price must be provided')
    }

    const appServer = getRunningExpressApp()

    const existingProduct = await appServer.AppDataSource.query(
        'SELECT * FROM product_inventory WHERE "productId" = $1',
        [productId]
    )

    if (existingProduct.length === 0) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
    }

    let updateQuery = 'UPDATE product_inventory SET "updatedDate" = NOW()'
    const params: any[] = []
    let paramIndex = 1

    if (stock !== undefined) {
        updateQuery += `, stock = $${paramIndex}`
        params.push(stock)
        paramIndex++
    }

    if (price !== undefined) {
        updateQuery += `, price = $${paramIndex}`
        params.push(price)
        paramIndex++
    }

    updateQuery += ` WHERE "productId" = $${paramIndex} RETURNING *`
    params.push(productId)

    const result = await appServer.AppDataSource.query(updateQuery, params)

    return result[0]
}

// Get all inventory items
const getAllInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM product_inventory 
            ORDER BY "updatedDate" DESC
        `
        const result = await appServer.AppDataSource.query(query)
        return res.json(result)
    } catch (error) {
        logger.error('Error getting all inventory:', error)
        return next(error)
    }
}

// Get inventory item by product ID
const getInventoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params
        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM product_inventory 
            WHERE "productId" = $1
        `
        const result = await appServer.AppDataSource.query(query, [productId])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting inventory by ID:', error)
        return next(error)
    }
}

// Search inventory by brand or name
const searchInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q, brand, minStock, maxStock } = req.query
        
        let query = 'SELECT * FROM product_inventory WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (q) {
            query += ` AND (name ILIKE $${paramIndex} OR brand ILIKE $${paramIndex})`
            params.push(`%${q}%`)
            paramIndex++
        }

        if (brand) {
            query += ` AND brand ILIKE $${paramIndex}`
            params.push(`%${brand}%`)
            paramIndex++
        }

        if (minStock) {
            query += ` AND stock >= $${paramIndex}`
            params.push(parseInt(minStock as string))
            paramIndex++
        }

        if (maxStock) {
            query += ` AND stock <= $${paramIndex}`
            params.push(parseInt(maxStock as string))
            paramIndex++
        }

        query += ' ORDER BY "updatedDate" DESC'

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(query, params)
        
        return res.json(result)
    } catch (error) {
        logger.error('Error searching inventory:', error)
        return next(error)
    }
}

// Update inventory stock
const updateInventoryStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params
        const { stock, price } = req.body

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }

        const result = await applyInventoryUpdate(productId, { stock, price })

        return res.json(result)
    } catch (error) {
        logger.error('Error updating inventory:', error)
        return next(error)
    }
}

// Update inventory stock via POST alias
const updateInventoryByPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, stock, price } = req.body

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }

        const result = await applyInventoryUpdate(productId, { stock, price })

        return res.json(result)
    } catch (error) {
        logger.error('Error updating inventory (POST):', error)
        return next(error)
    }
}

// Create new inventory item
const createInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, name, brand, stock = 0, price } = req.body

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if product already exists
        const existingProduct = await appServer.AppDataSource.query(
            'SELECT * FROM product_inventory WHERE "productId" = $1',
            [productId]
        )

        if (existingProduct.length > 0) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Product already exists')
        }

        const query = `
            INSERT INTO product_inventory ("productId", name, brand, stock, price, "updatedDate")
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [productId, name, brand, stock, price])
        
        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating inventory item:', error)
        return next(error)
    }
}

// Get low stock items
const getLowStockItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { threshold = 10 } = req.query
        
        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM product_inventory 
            WHERE stock <= $1
            ORDER BY stock ASC, "updatedDate" DESC
        `
        
        const result = await appServer.AppDataSource.query(query, [parseInt(threshold as string)])
        
        return res.json(result)
    } catch (error) {
        logger.error('Error getting low stock items:', error)
        return next(error)
    }
}

// Get inventory statistics
const getInventoryStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appServer = getRunningExpressApp()
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_products,
                SUM(stock) as total_stock,
                COUNT(CASE WHEN stock <= 10 THEN 1 END) as low_stock_count,
                COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_count,
                AVG(price) as average_price,
                COUNT(DISTINCT brand) as total_brands
            FROM product_inventory
        `
        
        const result = await appServer.AppDataSource.query(statsQuery)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting inventory stats:', error)
        return next(error)
    }
}

// Check inventory availability by tire_number or productId
const checkInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tire_number, productId, productCode, brand } = req.query as { [key: string]: string }

        if (!tire_number && !productId && !productCode) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'tire_number, productId or productCode query param required')
        }

        let query = 'SELECT * FROM product_inventory WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        const aliasId = productId ?? productCode
        if (aliasId) {
            query += ` AND "productId" = $${paramIndex}`
            params.push(aliasId)
            paramIndex++
        }

        if (brand) {
            query += ` AND brand ILIKE $${paramIndex}`
            params.push(`%${brand}%`)
            paramIndex++
        }

        const filters: string[] = []
        if (tire_number) {
            const normalized = tire_number.replace(/\s+/g, '').toUpperCase()
            const digitsOnly = normalized.replace(/[^0-9]/g, '')
            filters.push(`UPPER("productId") LIKE $${paramIndex}`)
            params.push(`%${normalized}%`)
            paramIndex++
            filters.push(`REPLACE(REPLACE(REPLACE(UPPER("productId"), '-', ''), '/', ''), 'R', '') LIKE $${paramIndex}`)
            params.push(`%${digitsOnly}%`)
            paramIndex++
            filters.push(`UPPER(name) LIKE $${paramIndex}`)
            params.push(`%${normalized}%`)
            paramIndex++
        }

        if (filters.length > 0) {
            query += ` AND (${filters.join(' OR ')})`
        }

        const appServer = getRunningExpressApp()
        const rows = await appServer.AppDataSource.query(query, params)

        if (rows.length === 0) {
            return res.json({
                available: false,
                query: {
                    tire_number: tire_number ?? null,
                    productId: aliasId ?? null,
                    brand: brand ?? null
                }
            })
        }

        const match = rows[0]
        return res.json({
            available: match.stock > 0,
            product: match
        })
    } catch (error) {
        logger.error('Error checking inventory item:', error)
        return next(error)
    }
}

// Get alternative inventory suggestions based on reference productId or filters
const getInventoryAlternatives = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, brand, maxPriceDelta = '0.2', maxResults = '5', category } = req.query as {
            [key: string]: string
        }

        const appServer = getRunningExpressApp()

        let referenceProduct: any = null
        if (productId) {
            const referenceResult = await appServer.AppDataSource.query(
                'SELECT * FROM product_inventory WHERE "productId" = $1',
                [productId]
            )

            if (referenceResult.length > 0) {
                referenceProduct = referenceResult[0]
            }
        }

        const params: any[] = []
        let paramIndex = 1
        let query = 'SELECT * FROM product_inventory WHERE stock > 0'

        if (referenceProduct) {
            query += ` AND "productId" != $${paramIndex}`
            params.push(referenceProduct.productId)
            paramIndex++

            if (!brand) {
                query += ` AND brand = $${paramIndex}`
                params.push(referenceProduct.brand)
                paramIndex++
            }
        }

        if (brand) {
            query += ` AND brand ILIKE $${paramIndex}`
            params.push(`%${brand}%`)
            paramIndex++
        }

        if (category) {
            query += ` AND (name ILIKE $${paramIndex} OR "productId" ILIKE $${paramIndex})`
            params.push(`%${category}%`)
            paramIndex++
        }

        const candidates = await appServer.AppDataSource.query(query, params)

        const parsedMaxResults = Math.max(1, parseInt(maxResults))
        const priceDelta = Math.max(0, parseFloat(maxPriceDelta))

        const alternatives = candidates
            .map((candidate: any) => {
                let priceDifference = null
                let similarityScore = 0

                if (referenceProduct) {
                    const basePrice = Number(referenceProduct.price ?? 0)
                    const candidatePrice = Number(candidate.price ?? 0)
                    priceDifference = candidatePrice - basePrice

                    const relativeDiff = basePrice === 0 ? 0 : Math.abs(priceDifference) / basePrice
                    if (relativeDiff <= priceDelta) {
                        similarityScore += 0.5
                    }

                    if ((candidate.name ?? '').split(' ')[0] === (referenceProduct.name ?? '').split(' ')[0]) {
                        similarityScore += 0.2
                    }
                }

                if (brand && candidate.brand?.toLowerCase().includes(brand.toLowerCase())) {
                    similarityScore += 0.2
                }

                if (category && (candidate.name?.toLowerCase().includes(category.toLowerCase()) || candidate.productId?.toLowerCase().includes(category.toLowerCase()))) {
                    similarityScore += 0.1
                }

                return {
                    ...candidate,
                    priceDifference,
                    similarityScore
                }
            })
            .sort((a: any, b: any) => b.similarityScore - a.similarityScore)
            .slice(0, parsedMaxResults)

        return res.json({
            reference: referenceProduct,
            alternatives,
            total: alternatives.length
        })
    } catch (error) {
        logger.error('Error getting inventory alternatives:', error)
        return next(error)
    }
}

// Reserve inventory for a customer and reduce stock
const reserveInventory = async (req: Request, res: Response, next: NextFunction) => {
    const client = getRunningExpressApp().AppDataSource
    let transactionStarted = false

    try {
        const {
            productId,
            quantity,
            customerId,
            phoneNumber,
            reason,
            expiresAt,
            agentId,
            notes
        } = req.body

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'productId is required')
        }

        const requestedQuantity = quantity ? parseInt(quantity) : 1
        if (Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'quantity must be a positive integer')
        }

        await client.query('BEGIN')
        transactionStarted = true

        const productRows = await client.query(
            'SELECT * FROM product_inventory WHERE "productId" = $1 FOR UPDATE',
            [productId]
        )

        if (productRows.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        const product = productRows[0]
        const availableStock = parseInt(product.stock)

        if (availableStock < requestedQuantity) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Not enough stock to reserve')
        }

        const updatedStock = availableStock - requestedQuantity
        await client.query(
            'UPDATE product_inventory SET stock = $1, "updatedDate" = NOW() WHERE "productId" = $2',
            [updatedStock, productId]
        )

        // Set default expiration time to 30 minutes from now if not provided
        const defaultExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        const finalExpiresAt = expiresAt || defaultExpiresAt
        
        await client.query(
            `INSERT INTO follow_ups (
                customer_id,
                phone_number,
                follow_up_type,
                scheduled_at,
                status,
                attempt_number,
                max_attempts,
                message_sent,
                next_action
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                customerId ?? null,
                phoneNumber ?? null,
                'inventory_reservation',
                finalExpiresAt,
                'pending',
                1,
                1,
                notes ?? `Reserva de ${requestedQuantity} unidades de ${product.name}`,
                reason ?? 'inventory_hold'
            ]
        )

        await client.query('COMMIT')

        return res.json({
            productId,
            reservedQuantity: requestedQuantity,
            remainingStock: updatedStock,
            customerId: customerId ?? null,
            agentId: agentId ?? null
        })
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK')
        }
        logger.error('Error reserving inventory:', error)
        return next(error)
    }
}

// Register notification request for when stock becomes available
const notifyWhenInStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Debug: Log the entire request body first
        console.log('Debug - Full req.body:', JSON.stringify(req.body, null, 2))

        const {
            productId,
            customerId,
            clientId,
            phone_number,
            notificationType = 'stock_available',
            preferredChannel,
            notes
        } = req.body

        // Debug: Log extracted values
        console.log('Debug - Extracted productId:', productId)
        console.log('Debug - Extracted phone_number:', phone_number)
        console.log('Debug - Extracted customerId:', customerId)
        console.log('Debug - Extracted clientId:', clientId)

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'productId is required')
        }

        if (!phone_number) {
            console.log('Debug - phone_number is falsy:', phone_number)
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'phone_number is required')
        }

        const appServer = getRunningExpressApp()

        const productRows = await appServer.AppDataSource.query(
            'SELECT * FROM product_inventory WHERE "productId" = $1',
            [productId]
        )

        if (productRows.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        const scheduledAt = req.body.scheduledAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000) // Default to 24 hours from now
        
        const finalPhoneNumber = phone_number
        const finalCustomerId = clientId || customerId || null

        // Debug logging
        console.log('Debug - finalPhoneNumber:', finalPhoneNumber)
        console.log('Debug - finalCustomerId:', finalCustomerId)
        console.log('Debug - scheduledAt:', scheduledAt)
        console.log('Debug - phone_number from req.body:', phone_number)

        const followUp = await appServer.AppDataSource.query(
            `INSERT INTO follow_ups (
                customer_id,
                phone_number,
                follow_up_type,
                scheduled_at,
                status,
                attempt_number,
                max_attempts,
                message_sent,
                next_action,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, 1, 3, $6, $7, NOW(), NOW())
            RETURNING *`,
            [
                finalCustomerId,
                finalPhoneNumber,
                notificationType,
                scheduledAt,
                'pending',
                notes ?? `Notificar disponibilidad de ${productRows[0].name}`,
                preferredChannel ?? 'phone'
            ]
        )

        return res.status(StatusCodes.CREATED).json({
            message: 'Notification registered',
            followUp: followUp[0]
        })
    } catch (error) {
        logger.error('Error registering stock notification:', error)
        return next(error)
    }
}

export default {
    getAllInventory,
    getInventoryById,
    searchInventory,
    updateInventoryStock,
    updateInventoryByPost,
    createInventoryItem,
    getLowStockItems,
    getInventoryStats,
    checkInventoryItem,
    getInventoryAlternatives,
    reserveInventory,
    notifyWhenInStock
}

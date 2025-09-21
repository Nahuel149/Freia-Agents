import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

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

        if (stock === undefined && price === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Stock or price must be provided')
        }

        const appServer = getRunningExpressApp()
        
        // Check if product exists
        const existingProduct = await appServer.AppDataSource.query(
            'SELECT * FROM product_inventory WHERE "productId" = $1',
            [productId]
        )

        if (existingProduct.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        // Build update query dynamically
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
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error updating inventory:', error)
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
        const { tire_number, productId, productCode } = req.query as { [key: string]: string }

        if (!tire_number && !productId && !productCode) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'tire_number, productId or productCode query param required')
        }

        let query = 'SELECT * FROM product_inventory WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (tire_number) {
            query += ` AND "productId" = $${paramIndex}`
            params.push(tire_number)
            paramIndex++
        }

        if (productId) {
            query += ` AND "productId" = $${paramIndex}`
            params.push(productId)
            paramIndex++
        }

        if (productCode) {
            query += ` AND "productCode" = $${paramIndex}`
            params.push(productCode)
            paramIndex++
        }

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(query, params)

        if (result.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'Product not found' })
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error checking inventory item:', error)
        return next(error)
    }
}

export default {
    getAllInventory,
    getInventoryById,
    searchInventory,
    updateInventoryStock,
    createInventoryItem,
    getLowStockItems,
    getInventoryStats,
    checkInventoryItem
}
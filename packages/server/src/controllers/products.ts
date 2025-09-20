import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'

// Get all products
const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const { page = 1, limit = 50, categoria, marca, minPrice, maxPrice, inStock } = req.query
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

        let query = `
            SELECT p.*, 
                   pc.name as categoria_name,
                   pb.name as marca_name
            FROM products p
            LEFT JOIN product_categories pc ON p.categoria = pc.name AND pc."workspaceId" = p."workspaceId"
            LEFT JOIN product_brands pb ON p.marca = pb.name AND pb."workspaceId" = p."workspaceId"
            WHERE p."workspaceId" = $1
        `
        const params: any[] = [workspaceId]
        let paramIndex = 2

        if (categoria) {
            query += ` AND p.categoria ILIKE $${paramIndex}`
            params.push(`%${categoria}%`)
            paramIndex++
        }

        if (marca) {
            query += ` AND p.marca ILIKE $${paramIndex}`
            params.push(`%${marca}%`)
            paramIndex++
        }

        if (minPrice) {
            query += ` AND p.precio >= $${paramIndex}`
            params.push(parseFloat(minPrice as string))
            paramIndex++
        }

        if (maxPrice) {
            query += ` AND p.precio <= $${paramIndex}`
            params.push(parseFloat(maxPrice as string))
            paramIndex++
        }

        if (inStock === 'true') {
            query += ` AND p.stock > 0`
        } else if (inStock === 'false') {
            query += ` AND p.stock = 0`
        }

        query += ` ORDER BY p."updatedDate" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
        params.push(parseInt(limit as string), offset)

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(query, params)

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) FROM products WHERE "workspaceId" = $1`
        const countParams = [workspaceId]
        const countResult = await appServer.AppDataSource.query(countQuery, countParams)
        const total = parseInt(countResult[0].count)

        return res.json({
            products: result,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        })
    } catch (error) {
        logger.error('Error getting all products:', error)
        return next(error)
    }
}

// Get product by ID
const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params
        const workspaceId = req.user?.activeWorkspaceId
        
        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }
        
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT p.*, 
                   pc.name as categoria_name,
                   pb.name as marca_name
            FROM products p
            LEFT JOIN product_categories pc ON p.categoria = pc.name AND pc."workspaceId" = p."workspaceId"
            LEFT JOIN product_brands pb ON p.marca = pb.name AND pb."workspaceId" = p."workspaceId"
            WHERE p."productId" = $1 AND p."workspaceId" = $2
        `
        const result = await appServer.AppDataSource.query(query, [productId, workspaceId])
        
        if (result.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting product by ID:', error)
        return next(error)
    }
}

// Search products
const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q, categoria, marca, minPrice, maxPrice, inStock } = req.query
        const workspaceId = req.user?.activeWorkspaceId
        
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }
        
        let query = `
            SELECT p.*, 
                   pc.name as categoria_name,
                   pb.name as marca_name
            FROM products p
            LEFT JOIN product_categories pc ON p.categoria = pc.name AND pc."workspaceId" = p."workspaceId"
            LEFT JOIN product_brands pb ON p.marca = pb.name AND pb."workspaceId" = p."workspaceId"
            WHERE p."workspaceId" = $1
        `
        const params: any[] = [workspaceId]
        let paramIndex = 2

        if (q) {
            query += ` AND (p.nombre ILIKE $${paramIndex} OR p.descripcion ILIKE $${paramIndex} OR p.marca ILIKE $${paramIndex} OR p.categoria ILIKE $${paramIndex})`
            params.push(`%${q}%`)
            paramIndex++
        }

        if (categoria) {
            query += ` AND p.categoria ILIKE $${paramIndex}`
            params.push(`%${categoria}%`)
            paramIndex++
        }

        if (marca) {
            query += ` AND p.marca ILIKE $${paramIndex}`
            params.push(`%${marca}%`)
            paramIndex++
        }

        if (minPrice) {
            query += ` AND p.precio >= $${paramIndex}`
            params.push(parseFloat(minPrice as string))
            paramIndex++
        }

        if (maxPrice) {
            query += ` AND p.precio <= $${paramIndex}`
            params.push(parseFloat(maxPrice as string))
            paramIndex++
        }

        if (inStock === 'true') {
            query += ` AND p.stock > 0`
        } else if (inStock === 'false') {
            query += ` AND p.stock = 0`
        }

        query += ' ORDER BY p."updatedDate" DESC'

        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.query(query, params)
        
        return res.json(result)
    } catch (error) {
        logger.error('Error searching products:', error)
        return next(error)
    }
}

// Create new product
const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, categoria, marca, nombre, precio, stock, descripcion, especificaciones } = req.body
        const workspaceId = req.user?.activeWorkspaceId

        if (!productId || !nombre) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID and name are required')
        }
        
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if product already exists
        const existingProduct = await appServer.AppDataSource.query(
            'SELECT * FROM products WHERE "productId" = $1 AND "workspaceId" = $2',
            [productId, workspaceId]
        )

        if (existingProduct.length > 0) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, 'Product already exists')
        }

        const query = `
            INSERT INTO products ("productId", "workspaceId", categoria, marca, nombre, precio, stock, descripcion, especificaciones, "createdDate", "updatedDate")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [
            productId, workspaceId, categoria, marca, nombre, precio || 0, stock || 0, descripcion, especificaciones
        ])
        
        return res.status(StatusCodes.CREATED).json(result[0])
    } catch (error) {
        logger.error('Error creating product:', error)
        return next(error)
    }
}

// Update product
const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId } = req.params
        const { categoria, marca, nombre, precio, stock, descripcion, especificaciones } = req.body
        const workspaceId = req.user?.activeWorkspaceId

        if (!productId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product ID is required')
        }
        
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        
        // Check if product exists
        const existingProduct = await appServer.AppDataSource.query(
            'SELECT * FROM products WHERE "productId" = $1 AND "workspaceId" = $2',
            [productId, workspaceId]
        )

        if (existingProduct.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Product not found')
        }

        // Build update query dynamically
        let updateQuery = 'UPDATE products SET "updatedDate" = NOW()'
        const params: any[] = []
        let paramIndex = 1

        if (categoria !== undefined) {
            updateQuery += `, categoria = $${paramIndex}`
            params.push(categoria)
            paramIndex++
        }

        if (marca !== undefined) {
            updateQuery += `, marca = $${paramIndex}`
            params.push(marca)
            paramIndex++
        }

        if (nombre !== undefined) {
            updateQuery += `, nombre = $${paramIndex}`
            params.push(nombre)
            paramIndex++
        }

        if (precio !== undefined) {
            updateQuery += `, precio = $${paramIndex}`
            params.push(precio)
            paramIndex++
        }

        if (stock !== undefined) {
            updateQuery += `, stock = $${paramIndex}`
            params.push(stock)
            paramIndex++
        }

        if (descripcion !== undefined) {
            updateQuery += `, descripcion = $${paramIndex}`
            params.push(descripcion)
            paramIndex++
        }

        if (especificaciones !== undefined) {
            updateQuery += `, especificaciones = $${paramIndex}`
            params.push(especificaciones)
            paramIndex++
        }

        updateQuery += ` WHERE "productId" = $${paramIndex} AND "workspaceId" = $${paramIndex + 1} RETURNING *`
        params.push(productId, workspaceId)

        const result = await appServer.AppDataSource.query(updateQuery, params)
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error updating product:', error)
        return next(error)
    }
}

// Get product categories
const getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM product_categories 
            WHERE "workspaceId" = $1
            ORDER BY name ASC
        `
        const result = await appServer.AppDataSource.query(query, [workspaceId])
        return res.json(result)
    } catch (error) {
        logger.error('Error getting categories:', error)
        return next(error)
    }
}

// Get product brands
const getBrands = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        const query = `
            SELECT * FROM product_brands 
            WHERE "workspaceId" = $1
            ORDER BY name ASC
        `
        const result = await appServer.AppDataSource.query(query, [workspaceId])
        return res.json(result)
    } catch (error) {
        logger.error('Error getting brands:', error)
        return next(error)
    }
}

// Get product statistics
const getProductStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Workspace ID is required')
        }

        const appServer = getRunningExpressApp()
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_products,
                SUM(stock) as total_stock,
                COUNT(CASE WHEN stock <= 10 THEN 1 END) as low_stock_count,
                COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_count,
                AVG(precio) as average_price,
                COUNT(DISTINCT categoria) as total_categories,
                COUNT(DISTINCT marca) as total_brands
            FROM products
            WHERE "workspaceId" = $1
        `
        
        const result = await appServer.AppDataSource.query(statsQuery, [workspaceId])
        
        return res.json(result[0])
    } catch (error) {
        logger.error('Error getting product stats:', error)
        return next(error)
    }
}

export default {
    getAllProducts,
    getProductById,
    searchProducts,
    createProduct,
    updateProduct,
    getCategories,
    getBrands,
    getProductStats
}
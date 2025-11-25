import { Request, Response, NextFunction } from 'express'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import logger from '../utils/logger'
import { analyzeConversationForProduct, validateProductSKU } from '../utils/conversationAnalyzer'
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer'
import { DashboardService } from '../services/dashboard'
import { recordSaleAnalytics } from '../services/agent-events'

const parseNumberish = (value: any): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const trimmed = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.')
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

const computeAmountCents = (
    finalPrice?: number | null,
    totalPrice?: number | null,
    unitPrice?: number | null,
    quantity?: number | null
): number => {
    const resolvedQuantity = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 1
    const candidates = [
        finalPrice,
        totalPrice,
        typeof unitPrice === 'number' && Number.isFinite(unitPrice) ? unitPrice * resolvedQuantity : null
    ]
    const chosen = candidates.find((val) => typeof val === 'number' && Number.isFinite(val)) ?? 0
    return Math.max(0, Math.round(chosen * 100))
}

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
            customer_name,
            client_name,
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
            delivery_address: deliveryAddress,
            sale_status = 'pending',
            agent_notes,
            // New parameters for conversation analysis
            chatflowid,
            sessionId,
            chatId
        } = req.body

        if (!phone_number) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Phone number is required')
        }

        // Normalize phone number to international format
        const normalizedPhoneNumber = normalizePhoneNumber(phone_number)
        
        // Validate the normalized phone number
        if (!isValidPhoneNumber(normalizedPhoneNumber)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid phone number format')
        }

        let resolvedChatflowId = chatflowid
        const appServer = getRunningExpressApp()

        if (!resolvedChatflowId && sessionId) {
            try {
                const chatflowLookup = await appServer.AppDataSource.query(
                    'SELECT "chatflowid" FROM chat_message WHERE "sessionId" = $1 ORDER BY "createdDate" DESC LIMIT 1',
                    [sessionId]
                )
                if (chatflowLookup.length > 0 && chatflowLookup[0].chatflowid) {
                    resolvedChatflowId = chatflowLookup[0].chatflowid
                }
            } catch (error) {
                logger.warn('Unable to resolve chatflow id from session', { sessionId, error })
            }
        }

        let finalProductSku = product_sku
        let finalProductBrand = product_brand
        let finalProductModel = product_model
        let finalWheelSize = wheel_size
        let analysisNotes = ''
        const quantityNumber = parseNumberish(quantity) ?? 1
        const unitPriceNumber = parseNumberish(unit_price)
        const totalPriceNumber = parseNumberish(total_price)
        const discountPercentageNumber = parseNumberish(discount_percentage) ?? 0
        const finalPriceNumber = parseNumberish(final_price)
        const currency =
            typeof req.body.currency === 'string' && req.body.currency.trim()
                ? req.body.currency.trim().toUpperCase().slice(0, 10)
                : 'USD'

        // If product_sku is not provided, try to detect it from conversation
        if (!finalProductSku && (resolvedChatflowId || sessionId || chatId)) {
            logger.info('Product SKU not provided, analyzing conversation for product information...')
            
            const analysisResult = await analyzeConversationForProduct(
                resolvedChatflowId ?? '',
                sessionId,
                chatId,
                normalizedPhoneNumber
            )

            if (analysisResult.productInfo && analysisResult.productInfo.confidence > 0.5) {
                finalProductSku = analysisResult.productInfo.product_sku
                finalProductBrand = finalProductBrand || analysisResult.productInfo.product_brand
                finalProductModel = finalProductModel || analysisResult.productInfo.product_model
                finalWheelSize = finalWheelSize || analysisResult.productInfo.wheel_size
                
                analysisNotes = `Auto-detected from conversation (confidence: ${(analysisResult.productInfo.confidence * 100).toFixed(1)}%). Keywords: ${analysisResult.analysisDetails.keywordsFound.join(', ')}`
                
                logger.info('Product information detected from conversation:', {
                    product_sku: finalProductSku,
                    product_brand: finalProductBrand,
                    confidence: analysisResult.productInfo.confidence,
                    keywords: analysisResult.analysisDetails.keywordsFound
                })
            } else {
                logger.warn('Could not detect product information from conversation with sufficient confidence', {
                    confidence: analysisResult.analysisDetails.confidenceScore,
                    messagesAnalyzed: analysisResult.analysisDetails.messagesAnalyzed
                })
            }
        }

        if (!finalProductSku && (finalProductBrand || finalProductModel || finalWheelSize)) {
            try {
                logger.info('Attempting inventory fallback for product detection', {
                    brand: finalProductBrand,
                    model: finalProductModel,
                    wheelSize: finalWheelSize
                })
                let fallbackQuery = 'SELECT "productId", name, brand, price FROM product_inventory WHERE 1=1'
                const params: any[] = []

                if (finalProductBrand) {
                    fallbackQuery += ` AND brand ILIKE $${params.length + 1}`
                    params.push(`%${finalProductBrand}%`)
                }

                if (finalProductModel) {
                    fallbackQuery += ` AND name ILIKE $${params.length + 1}`
                    params.push(`%${finalProductModel}%`)
                }

                if (finalWheelSize) {
                    const sanitizedSize = finalWheelSize.replace(/\s+/g, '').toUpperCase()
                    fallbackQuery += ` AND REPLACE(UPPER(REPLACE(REPLACE(name, '/', ''), ' ', '')), '-', '') LIKE $${params.length + 1}`
                    params.push(`%${sanitizedSize.replace(/[^0-9A-Z]/g, '')}%`)
                }

                fallbackQuery += ' ORDER BY "updatedDate" DESC LIMIT 1'

                const candidates = await appServer.AppDataSource.query(fallbackQuery, params)
                const candidate = candidates?.[0]

                if (candidate) {
                    finalProductSku = candidate.productId
                    finalProductBrand = finalProductBrand || candidate.brand
                    finalProductModel = finalProductModel || candidate.name
                    analysisNotes = [analysisNotes, 'SKU matched from inventory by brand/medida'].filter(Boolean).join(' | ')
                    logger.info('Matched product from inventory fallback lookup', {
                        product_sku: finalProductSku,
                        brand: finalProductBrand,
                        wheel_size: finalWheelSize,
                        candidate
                    })
                } else {
                    logger.warn('No inventory match found for conversation fallback', {
                        brand: finalProductBrand,
                        model: finalProductModel,
                        wheelSize: finalWheelSize,
                        params,
                        fallbackQuery
                    })
                }
            } catch (error) {
                logger.warn('Failed to match product from inventory fallback lookup', { error, finalProductBrand, finalWheelSize })
            }
        }

        // Validate that we have a product SKU
        if (!finalProductSku) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST, 
                'Product SKU is required. Either provide it directly or ensure the conversation contains sufficient product information (brand, tire size, etc.)'
            )
        }

        // Validate that the product SKU exists in inventory
        const isValidSku = await validateProductSKU(finalProductSku)
        if (!isValidSku) {
            logger.warn(`Product SKU ${finalProductSku} not found in inventory`)
            // Don't throw error, just log warning - the sale can still be created for manual review
        }

        // Combine agent notes with analysis notes
        const combinedNotes = [agent_notes, analysisNotes].filter(Boolean).join(' | ')
        const amountCents = computeAmountCents(finalPriceNumber, totalPriceNumber, unitPriceNumber, quantityNumber)
        
        const query = `
            INSERT INTO sales (
                customer_id, phone_number, product_sku, product_brand, product_model,
                wheel_size, quantity, unit_price, total_price, discount_percentage,
                final_price, amount_cents, currency, payment_method, delivery_method, delivery_address,
                sale_status, negotiation_attempts, agent_notes, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
            RETURNING *
        `
        
        const result = await appServer.AppDataSource.query(query, [
            customer_id,
            normalizedPhoneNumber,
            finalProductSku,
            finalProductBrand,
            finalProductModel,
            finalWheelSize,
            quantityNumber,
            unitPriceNumber,
            totalPriceNumber,
            discountPercentageNumber,
            finalPriceNumber,
            amountCents,
            currency,
            payment_method,
            delivery_method,
            deliveryAddress,
            sale_status,
            0,
            combinedNotes
        ])

        const resolvedCustomerName = customer_name || client_name || undefined
        const fallbackAmount = unitPriceNumber !== null && Number.isFinite(unitPriceNumber)
            ? unitPriceNumber * quantityNumber
            : null
        const analyticsTotal = [finalPriceNumber, totalPriceNumber, fallbackAmount]
            .find((value) => typeof value === 'number' && Number.isFinite(value)) || 0

        await recordSaleAnalytics(
            {
                saleId: result[0]?.id,
                agentId: resolvedChatflowId,
                clientId: customer_id ? String(customer_id) : undefined,
                clientName: resolvedCustomerName,
                contactPhone: normalizedPhoneNumber,
                totalAmount: analyticsTotal,
                discountPercentage: discountPercentageNumber,
                quantity: quantityNumber,
                paymentMethod: payment_method,
                deliveryMethod: delivery_method,
                deliveryAddress,
                notes: combinedNotes || undefined,
                sessionId: sessionId || undefined,
                chatId: chatId || undefined,
                chatflowId: resolvedChatflowId || undefined,
                products: [
                    {
                        sku: finalProductSku,
                        brand: finalProductBrand,
                        model: finalProductModel,
                        wheelSize: finalWheelSize,
                        unitPrice: unitPriceNumber ?? undefined,
                        quantity: quantityNumber,
                        totalPrice: finalPriceNumber ?? totalPriceNumber ?? fallbackAmount ?? undefined
                    }
                ]
            },
            appServer.AppDataSource
        )

        return res.status(StatusCodes.CREATED).json({
            ...result[0],
            analysis_info: analysisNotes ? {
                auto_detected: true,
                analysis_notes: analysisNotes
            } : {
                auto_detected: false
            }
        })
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

        const existing = existingSale[0]
        const existingQuantity = parseNumberish(existing.quantity) ?? 1
        const quantityNumber = quantity !== undefined ? parseNumberish(quantity) ?? existingQuantity : existingQuantity
        const unitPriceNumber =
            unit_price !== undefined ? parseNumberish(unit_price) : parseNumberish(existing.unit_price ?? existing.unitPrice)
        const totalPriceNumber =
            total_price !== undefined ? parseNumberish(total_price) : parseNumberish(existing.total_price ?? existing.totalPrice)
        const finalPriceNumber =
            final_price !== undefined ? parseNumberish(final_price) : parseNumberish(existing.final_price ?? existing.finalPrice)
        const discountPercentageNumber =
            discount_percentage !== undefined
                ? parseNumberish(discount_percentage)
                : parseNumberish(existing.discount_percentage ?? existing.discountPercentage)
        const shouldUpdateAmountCents =
            quantity !== undefined || unit_price !== undefined || total_price !== undefined || final_price !== undefined
        const amountCents = shouldUpdateAmountCents
            ? computeAmountCents(finalPriceNumber, totalPriceNumber, unitPriceNumber, quantityNumber)
            : undefined
        const currencyValue =
            req.body.currency !== undefined
                ? typeof req.body.currency === 'string' && req.body.currency.trim()
                    ? req.body.currency.trim().toUpperCase().slice(0, 10)
                    : existing.currency || 'USD'
                : undefined

        // Build update query dynamically
        let updateQuery = 'UPDATE sales SET updated_at = NOW()'
        const params: any[] = []
        let paramIndex = 1

        if (quantity !== undefined) {
            updateQuery += `, quantity = $${paramIndex}`
            params.push(quantityNumber)
            paramIndex++
        }

        if (unit_price !== undefined) {
            updateQuery += `, unit_price = $${paramIndex}`
            params.push(unitPriceNumber)
            paramIndex++
        }

        if (total_price !== undefined) {
            updateQuery += `, total_price = $${paramIndex}`
            params.push(totalPriceNumber)
            paramIndex++
        }

        if (discount_percentage !== undefined) {
            updateQuery += `, discount_percentage = $${paramIndex}`
            params.push(discountPercentageNumber)
            paramIndex++
        }

        if (final_price !== undefined) {
            updateQuery += `, final_price = $${paramIndex}`
            params.push(finalPriceNumber)
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

        if (currencyValue !== undefined) {
            updateQuery += `, currency = $${paramIndex}`
            params.push(currencyValue)
            paramIndex++
        }

        if (shouldUpdateAmountCents) {
            updateQuery += `, amount_cents = $${paramIndex}`
            params.push(amountCents ?? 0)
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
        const { 
            product_sku, 
            quantity = 1,
            // New parameters for conversation analysis
            chatflowid,
            sessionId,
            chatId
        } = req.body

        let finalProductSku = product_sku
        let analysisNotes = ''

        // If product_sku is not provided, try to detect it from conversation
        if (!finalProductSku && (chatflowid || sessionId || chatId)) {
            logger.info('Product SKU not provided for quote, analyzing conversation for product information...')
            
            const analysisResult = await analyzeConversationForProduct(
                chatflowid,
                sessionId,
                chatId
            )

            if (analysisResult.productInfo && analysisResult.productInfo.confidence > 0.5) {
                finalProductSku = analysisResult.productInfo.product_sku
                analysisNotes = `Auto-detected from conversation (confidence: ${(analysisResult.productInfo.confidence * 100).toFixed(1)}%). Keywords: ${analysisResult.analysisDetails.keywordsFound.join(', ')}`
                
                logger.info('Product SKU detected from conversation for quote:', {
                    product_sku: finalProductSku,
                    confidence: analysisResult.productInfo.confidence,
                    keywords: analysisResult.analysisDetails.keywordsFound
                })
            } else {
                logger.warn('Could not detect product SKU from conversation with sufficient confidence for quote', {
                    confidence: analysisResult.analysisDetails.confidenceScore,
                    messagesAnalyzed: analysisResult.analysisDetails.messagesAnalyzed
                })
            }
        }

        if (!finalProductSku) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Product SKU is required or could not be detected from conversation')
        }

        const appServer = getRunningExpressApp()
        
        // Try to fetch price from inventory table if available
        const inventoryQuery = 'SELECT price FROM product_inventory WHERE "productId" = $1 LIMIT 1'
        let unitPrice = 0
        try {
            const priceResult = await appServer.AppDataSource.query(inventoryQuery, [finalProductSku])
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
        
        const response: {
            product_sku: any;
            quantity: any;
            unit_price: number;
            total_price: number;
            analysis_info?: {
                auto_detected: boolean;
                analysis_notes: string;
            };
        } = { 
            product_sku: finalProductSku, 
            quantity, 
            unit_price: unitPrice, 
            total_price: totalPrice 
        }

        // Add analysis info if product was auto-detected
        if (analysisNotes) {
            response.analysis_info = {
                auto_detected: true,
                analysis_notes: analysisNotes
            }
        }
        
        return res.json(response)
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
        const altQuery = `SELECT "productId" as product_id, name, brand, price FROM product_inventory WHERE "productId" != $1 LIMIT 5`
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
        const {
            quoteId,
            clientId,
            saleId,
            requestedDiscount,
            requestedTotal,
            reason,
            clientPhone,
            estimatedResponseTime,
            priority = 'medium'
        } = req.body

        if (!quoteId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'quoteId is required')
        }
        if (requestedDiscount === undefined) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'requestedDiscount is required')
        }

        const toNumber = (value: unknown): number | null => {
            if (typeof value === 'number' && Number.isFinite(value)) return value
            if (typeof value === 'string') {
                const trimmed = value.trim()
                if (!trimmed) return null
                const cleaned = trimmed.replace(/[^0-9.,-]/g, '').replace(/,/g, '.')
                if (!cleaned) return null
                const parsed = Number(cleaned)
                return Number.isFinite(parsed) ? parsed : null
            }
            return null
        }

        const sanitisePhone = (value: unknown): string | null => {
            if (!value) return null
            if (typeof value !== 'string') return null

            const trimmed = value.trim()
            if (!trimmed) return null

            try {
                const normalised = normalizePhoneNumber(trimmed)
                if (normalised && isValidPhoneNumber(normalised)) {
                    return normalised
                }
                return normalised
            } catch {
                const digits = trimmed.replace(/[^0-9+]/g, '')
                return digits || null
            }
        }

        const discountValue = toNumber(requestedDiscount)
        if (discountValue === null || discountValue <= 0) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'requestedDiscount must be a positive number')
        }

        const maxSelfServeDiscount = 5
        if (discountValue <= maxSelfServeDiscount) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                `La aprobación manual solo se solicita para descuentos mayores al ${maxSelfServeDiscount}%`
            )
        }

        const requestedTotalNumber = requestedTotal !== undefined ? toNumber(requestedTotal) : null
        const estimatedResponseNumber = estimatedResponseTime !== undefined ? toNumber(estimatedResponseTime) : null
        const saleIdNumber = saleId !== undefined ? toNumber(saleId) : null

        if (saleId !== undefined && saleIdNumber === null) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'saleId debe ser numérico')
        }
        if (estimatedResponseNumber !== null && estimatedResponseNumber <= 0) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'estimatedResponseTime debe ser un número positivo en horas')
        }
        if (requestedTotalNumber !== null && requestedTotalNumber <= 0) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'requestedTotal debe ser mayor a cero')
        }

        const priorityValueRaw = typeof priority === 'string' ? priority.toLowerCase() : 'medium'
        const allowedPriorities = ['low', 'medium', 'high']
        const priorityValue = allowedPriorities.includes(priorityValueRaw) ? priorityValueRaw : 'medium'

        const resolvedClientPhone = sanitisePhone(clientPhone)

        const dashboardService = new DashboardService()

        const request = await dashboardService.createPriceApprovalRequest({
            quoteId: String(quoteId),
            clientId: clientId ? String(clientId) : null,
            saleId: saleIdNumber !== null ? Math.round(saleIdNumber) : null,
            requestedDiscount: discountValue,
            requestedTotal: requestedTotalNumber,
            reason: reason ?? null,
            clientPhone: resolvedClientPhone,
            priority: priorityValue,
            estimatedResponseTime: estimatedResponseNumber !== null ? Math.round(estimatedResponseNumber) : null
        })

        return res.status(StatusCodes.CREATED).json({
            approvalRequestId: request.id,
            status: request.status,
            priority: request.priority,
            requestedDiscount: request.requestedDiscount
        })
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
        const saleResult = await appServer.AppDataSource.query(saleQuery, [saleId])
        if (saleResult.length === 0) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Sale not found')
        }
        const sale = saleResult[0]
        let recordResult: any[] = []
        const clientKey = sale.customer_id ? sale.customer_id.toString() : sale.phone_number
        if (clientKey) {
            const saleRecordQuery = 'SELECT * FROM sale_record WHERE "clientId" = $1 ORDER BY ts DESC'
            recordResult = await appServer.AppDataSource.query(saleRecordQuery, [clientKey]).catch(() => [])
        }
        return res.json({ sale, records: recordResult })
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

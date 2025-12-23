import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import logger from '../utils/logger'

type InventoryItem = {
    productid: string
    productId?: string
    name: string
    brand: string
    stock: number
    price: number
}

type SalesRecord = {
    id: number
    customer_id: number | null
    phone_number: string | null
    product_sku: string
    product_brand: string | null
    product_model: string | null
    wheel_size: string | null
    quantity: number | null
    unit_price: number | null
    total_price: number | null
    discount_percentage: number | null
    final_price: number | null
    payment_method: string | null
    delivery_method: string | null
    delivery_address: string | null
    sale_status: string | null
    negotiation_attempts: number | null
    agent_notes: string | null
    created_at: string | null
}

type AlternativeCandidate = {
    item: InventoryItem
    score: number
    suggestedDiscount: number
}

const normalizeInventoryItem = (item: any): InventoryItem => ({
    productid: item.productId ?? item.productid,
    productId: item.productId ?? item.productid,
    name: item.name,
    brand: item.brand,
    stock: Number(item.stock ?? 0),
    price: Number(item.price ?? 0)
})

const fetchInventory = async () => {
    const appServer = getRunningExpressApp()
    const rows = await appServer.AppDataSource.query('SELECT * FROM product_inventory')
    return rows.map(normalizeInventoryItem)
}

const fetchSales = async () => {
    const appServer = getRunningExpressApp()
    return appServer.AppDataSource.query('SELECT * FROM sales') as Promise<SalesRecord[]>
}

const resolveCustomerMetrics = async (clientId?: string) => {
    if (!clientId) {
        return { customerId: null, phoneNumber: null }
    }

    const appServer = getRunningExpressApp()
    const trimmed = clientId.trim()
    const isNumeric = /^\d+$/.test(trimmed)

    if (isNumeric) {
        const rows = await appServer.AppDataSource.query('SELECT id, phone_number FROM customers WHERE id = $1', [parseInt(trimmed)])
        if (rows.length > 0) {
            return { customerId: rows[0].id, phoneNumber: rows[0].phone_number }
        }
    }

    const byPhone = await appServer.AppDataSource.query('SELECT id, phone_number FROM customers WHERE phone_number = $1', [trimmed])
    if (byPhone.length > 0) {
        return { customerId: byPhone[0].id, phoneNumber: byPhone[0].phone_number }
    }

    return { customerId: null, phoneNumber: null }
}

const calculateBundlePrice = (items: InventoryItem[], discountPercentage = 0) => {
    const subtotal = items.reduce((acc: number, item: InventoryItem) => acc + item.price, 0)
    const discountAmount = subtotal * (discountPercentage / 100)
    return {
        subtotal,
        discountAmount,
        total: subtotal - discountAmount
    }
}

const getComplementaryPromotions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, category, vehicleModel, clientType, maxResults = '5' } = req.query as { [key: string]: string }
        const inventory = await fetchInventory()
        const normalizedProductId = productId ? productId.trim() : null

        const reference = normalizedProductId ? inventory.find((item: InventoryItem) => item.productid === normalizedProductId) : null

        const limit = Math.max(1, parseInt(maxResults))
        const accessoryTags = ['ACC', 'SERV', 'KIT', 'ACEITE', 'FILTRO', 'BATER']

        const candidates: AlternativeCandidate[] = inventory
            .filter((item: InventoryItem) => {
                if (reference && item.productid === reference.productid) {
                    return false
                }

                const matchesCategory = category
                    ? item.name.toLowerCase().includes(category.toLowerCase()) ||
                      item.productid?.toLowerCase().includes(category.toLowerCase())
                    : true

                const matchesBrand = reference ? item.brand !== reference.brand : true
                const looksAccessory = accessoryTags.some((tag) => item.productid?.toUpperCase().includes(tag))
                const matchesVehicle = vehicleModel ? item.name.toLowerCase().includes(vehicleModel.toLowerCase()) : true

                return matchesCategory && matchesBrand && matchesVehicle && looksAccessory
            })
            .map((item: InventoryItem) => ({
                item,
                score: reference && item.brand === reference.brand ? 0.6 : 0.4,
                suggestedDiscount: clientType === 'business' ? 12 : 8
            }))
            .sort((a: AlternativeCandidate, b: AlternativeCandidate) => b.score - a.score)
            .slice(0, limit)

        return res.json({
            reference,
            complementary: candidates.map((candidate: AlternativeCandidate) => ({
                productId: candidate.item.productid,
                name: candidate.item.name,
                brand: candidate.item.brand,
                price: candidate.item.price,
                suggestedDiscount: candidate.suggestedDiscount,
                score: candidate.score
            }))
        })
    } catch (error) {
        logger.error('Error getting complementary promotions:', error)
        return next(error)
    }
}

const getSeasonalPromotions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { season = 'all', productCategory, clientType } = req.query as { [key: string]: string }
        const inventory = await fetchInventory()

        const seasonKeywords: Record<string, string[]> = {
            summer: ['aire', 'aire acondicionado', 'verano', 'ventil'],
            winter: ['invierno', 'nieve', 'cadena', 'antihielo', 'termico', 'winter'],
            spring: ['limpieza', 'filtro', 'fluido', 'mantenimiento'],
            autumn: ['lluvia', 'wiper', 'escobilla', 'freno']
        }

        const keywords = seasonKeywords[season.toLowerCase()] ?? []
        const filtered = inventory.filter((item: InventoryItem) => {
            const lowerName = item.name.toLowerCase()
            const matchesSeason = keywords.length === 0 || keywords.some((keyword) => lowerName.includes(keyword))
            const matchesCategory = productCategory ? lowerName.includes(productCategory.toLowerCase()) : true
            return matchesSeason && matchesCategory
        })

        const promotions = filtered.map((item: InventoryItem) => ({
            productId: item.productid,
            name: item.name,
            brand: item.brand,
            basePrice: item.price,
            seasonalDiscount: clientType === 'business' ? 15 : 10,
            promoPrice: item.price * (clientType === 'business' ? 0.85 : 0.9)
        }))

        return res.json({ season, promotions })
    } catch (error) {
        logger.error('Error getting seasonal promotions:', error)
        return next(error)
    }
}

const getBundleOffers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productId, minQuantity = '2', includeServices = 'true' } = req.query as { [key: string]: string }
        const inventory = await fetchInventory()
        const reference = productId ? inventory.find((item: InventoryItem) => item.productid === productId) : null
        const quantity = Math.max(2, parseInt(minQuantity))

        const serviceItems = includeServices === 'true' ? inventory.filter((item: InventoryItem) => item.productid?.startsWith('SERV')) : []

        const bundles: Array<{
            mainProduct: InventoryItem | null
            extras: InventoryItem[]
            quantity: number
            subtotal: number
            discountPercentage: number
            discountAmount: number
            bundlePrice: number
        }> = []

        if (reference) {
            const service = serviceItems[0]
            const items = [reference, ...(service ? [service] : [])]
            const discountPercentage = service ? 12 : 8
            const pricing = calculateBundlePrice(items, discountPercentage)

            bundles.push({
                mainProduct: reference,
                extras: service ? [service] : [],
                quantity,
                subtotal: pricing.subtotal,
                discountPercentage,
                discountAmount: pricing.discountAmount,
                bundlePrice: pricing.total
            })
        }

        const accessoryCandidates = inventory.filter((item: InventoryItem) => item.productid?.startsWith('ACC'))
        if (!reference && accessoryCandidates.length >= 2) {
            const items = accessoryCandidates.slice(0, 2)
            const pricing = calculateBundlePrice(items, 10)
            bundles.push({
                mainProduct: null,
                extras: items,
                quantity,
                subtotal: pricing.subtotal,
                discountPercentage: 10,
                discountAmount: pricing.discountAmount,
                bundlePrice: pricing.total
            })
        }

        return res.json({ bundles })
    } catch (error) {
        logger.error('Error getting bundle offers:', error)
        return next(error)
    }
}

const applyPromoCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { promoCode, products = [] } = req.body
        if (!promoCode) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'promoCode is required')
        }

        const inventory = await fetchInventory()
        const items = Array.isArray(products) ? inventory.filter((item: InventoryItem) => products.includes(item.productid)) : []

        const subtotal = items.reduce((acc: number, item: InventoryItem) => acc + item.price, 0)

        const promoMap: Record<string, { type: 'percentage' | 'fixed'; value: number }> = {
            FREIA10: { type: 'percentage', value: 10 },
            FREIA20: { type: 'percentage', value: 20 },
            ENVIOGRATIS: { type: 'fixed', value: 15000 },
            COMBOAUTO: { type: 'percentage', value: 15 }
        }

        const promo = promoMap[promoCode.toUpperCase()]
        if (!promo) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Promo code not found')
        }

        const discountAmount = promo.type === 'percentage' ? subtotal * (promo.value / 100) : promo.value
        const total = Math.max(0, subtotal - discountAmount)

        return res.json({
            promoCode,
            subtotal,
            discountAmount,
            total
        })
    } catch (error) {
        logger.error('Error applying promo code:', error)
        return next(error)
    }
}

const getClearancePromotions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { category, maxPrice } = req.query as { [key: string]: string }
        const inventory = await fetchInventory()

        const filtered = inventory.filter((item: InventoryItem) => {
            const matchesCategory = category ? item.name.toLowerCase().includes(category.toLowerCase()) : true
            const matchesPrice = maxPrice ? item.price <= parseFloat(maxPrice) : true
            const isLowStock = item.stock <= 10
            return matchesCategory && matchesPrice && isLowStock
        })

        const clearance = filtered.map((item: InventoryItem) => ({
            productId: item.productid,
            name: item.name,
            brand: item.brand,
            stock: item.stock,
            originalPrice: item.price,
            clearanceDiscount: 18,
            clearancePrice: item.price * 0.82
        }))

        return res.json({ clearance })
    } catch (error) {
        logger.error('Error getting clearance promotions:', error)
        return next(error)
    }
}

const getCrossSellRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId, currentProducts } = req.query as { [key: string]: string | string[] }
        const inventory = await fetchInventory()

        let parsedCurrent: string[] = []
        if (Array.isArray(currentProducts)) {
            parsedCurrent = currentProducts as string[]
        } else if (typeof currentProducts === 'string' && currentProducts.trim() !== '') {
            try {
                const maybeJson = JSON.parse(currentProducts)
                if (Array.isArray(maybeJson)) {
                    parsedCurrent = maybeJson
                } else {
                    parsedCurrent = currentProducts.split(',').map((value) => value.trim())
                }
            } catch (error) {
                parsedCurrent = currentProducts.split(',').map((value) => value.trim())
            }
        }

        const accessoryCandidates = inventory.filter(
            (item: InventoryItem) => item.productid?.startsWith('ACC') || item.productid?.startsWith('SERV')
        )
        const recommendations = accessoryCandidates
            .filter((item: InventoryItem) => !parsedCurrent.includes(item.productid ?? ''))
            .slice(0, 5)
            .map((item: InventoryItem) => ({
                productId: item.productid,
                name: item.name,
                brand: item.brand,
                price: item.price,
                suggestedDiscount: 7
            }))

        const resolvedClientId = Array.isArray(clientId) ? clientId[0] : clientId
        const { customerId } = await resolveCustomerMetrics(resolvedClientId)
        let recentPurchases: SalesRecord[] = []
        if (customerId) {
            const appServer = getRunningExpressApp()
            recentPurchases = await appServer.AppDataSource.query(
                'SELECT * FROM sales WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 5',
                [customerId]
            )
        }

        return res.json({
            recommendations,
            recentPurchases
        })
    } catch (error) {
        logger.error('Error getting cross-sell recommendations:', error)
        return next(error)
    }
}

const getLoyaltyRewards = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId } = req.query as { [key: string]: string }
        const { customerId } = await resolveCustomerMetrics(clientId)

        const sales = await fetchSales()
        const customerSales = sales.filter((sale: SalesRecord) => {
            if (customerId && sale.customer_id === customerId) {
                return true
            }
            if (!customerId && clientId) {
                return sale.phone_number === clientId
            }
            return false
        })

        const totalSpent = customerSales.reduce(
            (acc: number, sale: SalesRecord) => acc + Number(sale.final_price ?? sale.total_price ?? 0),
            0
        )
        const totalOrders = customerSales.length
        const tier = totalSpent > 2000000 ? 'platinum' : totalSpent > 1000000 ? 'gold' : totalSpent > 500000 ? 'silver' : 'bronze'
        const points = Math.round(totalSpent / 1000)

        const rewards = [
            {
                type: 'discount',
                description: '10% en próxima compra de cubiertas',
                pointsRequired: 800,
                available: points >= 800
            },
            {
                type: 'service',
                description: 'Alineación y balanceo sin cargo',
                pointsRequired: 1200,
                available: points >= 1200
            },
            {
                type: 'accessory',
                description: 'Kit de seguridad reglamentario',
                pointsRequired: 1500,
                available: points >= 1500
            }
        ]

        return res.json({
            tier,
            points,
            totalSpent,
            totalOrders,
            rewards
        })
    } catch (error) {
        logger.error('Error getting loyalty rewards:', error)
        return next(error)
    }
}

const getPromotionsAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startDate, endDate } = req.query as { [key: string]: string }
        const sales = await fetchSales()

        const filteredSales = sales.filter((sale: SalesRecord) => {
            const saleDate = sale.created_at ? new Date(sale.created_at) : null
            const afterStart = startDate ? (saleDate ? saleDate >= new Date(startDate) : false) : true
            const beforeEnd = endDate ? (saleDate ? saleDate <= new Date(endDate) : false) : true
            return afterStart && beforeEnd
        })

        const totalRevenue = filteredSales.reduce(
            (acc: number, sale: SalesRecord) => acc + Number(sale.final_price ?? sale.total_price ?? 0),
            0
        )
        const totalDiscount = filteredSales.reduce((acc: number, sale: SalesRecord) => acc + Number(sale.discount_percentage ?? 0), 0)
        const averageDiscount = filteredSales.length > 0 ? totalDiscount / filteredSales.length : 0

        const byBrand = filteredSales.reduce((acc: Record<string, { orders: number; revenue: number }>, sale: SalesRecord) => {
            const brand = sale.product_brand ?? 'unknown'
            if (!acc[brand]) {
                acc[brand] = { orders: 0, revenue: 0 }
            }
            acc[brand].orders += 1
            acc[brand].revenue += Number(sale.final_price ?? sale.total_price ?? 0)
            return acc
        }, {})

        return res.json({
            totalOrders: filteredSales.length,
            totalRevenue,
            averageDiscount,
            revenueByBrand: byBrand
        })
    } catch (error) {
        logger.error('Error getting promotions analytics:', error)
        return next(error)
    }
}

const createCustomBundle = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { clientId, products = [], services = [], discountPercentage = 0, validUntil, reason, notes } = req.body
        if (!Array.isArray(products) || products.length === 0) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'products array is required')
        }

        const inventory = await fetchInventory()
        const items = inventory.filter((item: InventoryItem) => products.includes(item.productid ?? ''))
        const serviceItems = inventory.filter((item: InventoryItem) => services.includes(item.productid ?? ''))
        const allItems: InventoryItem[] = [...items, ...serviceItems]

        const pricing = calculateBundlePrice(allItems, discountPercentage)
        const { customerId, phoneNumber } = await resolveCustomerMetrics(clientId)

        const appServer = getRunningExpressApp()
        const saleRecord = await appServer.AppDataSource.query(
            `INSERT INTO sale_record (agentId, clientId, clientName, totalAmount, items) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
                null,
                clientId ?? phoneNumber ?? 'anonymous',
                null,
                pricing.total,
                JSON.stringify(
                    allItems.map((item: InventoryItem) => ({
                        productId: item.productid,
                        name: item.name,
                        price: item.price
                    }))
                )
            ]
        )

        await appServer.AppDataSource.query(
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
            ) VALUES ($1, $2, $3, $4, $5, $6, 1, 1, $7, $8, $9, NOW(), NOW())`,
            [
                customerId,
                phoneNumber ?? 'internal',
                null,
                'custom_bundle',
                validUntil ?? null,
                'pending',
                reason ?? null,
                notes ?? null,
                'share_bundle'
            ]
        )

        return res.status(StatusCodes.CREATED).json({
            bundle: {
                items: allItems,
                discountPercentage,
                subtotal: pricing.subtotal,
                total: pricing.total,
                saleRecord: saleRecord[0]
            }
        })
    } catch (error) {
        logger.error('Error creating custom bundle:', error)
        return next(error)
    }
}

const createPromotionalCampaign = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            clientId,
            campaignName,
            targetProducts = [],
            discountType,
            discountValue,
            startDate,
            endDate,
            conditions,
            maxUses
        } = req.body

        if (!clientId || !campaignName || !discountType || discountValue === undefined || !startDate || !endDate) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing required campaign fields')
        }

        const inventory = await fetchInventory()
        const targeted = inventory.filter((item: InventoryItem) => targetProducts.includes(item.productid ?? ''))
        const { customerId, phoneNumber } = await resolveCustomerMetrics(clientId)

        const appServer = getRunningExpressApp()
        const campaign = await appServer.AppDataSource.query(
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
                null,
                'promotion_campaign',
                startDate,
                'scheduled',
                `Campaña ${campaignName}`,
                conditions ?? null,
                `finalizar_${endDate}`
            ]
        )

        return res.status(StatusCodes.CREATED).json({
            campaign: campaign[0],
            targetedProducts: targeted,
            discount: { type: discountType, value: discountValue },
            window: { startDate, endDate },
            maxUses
        })
    } catch (error) {
        logger.error('Error creating promotional campaign:', error)
        return next(error)
    }
}

export default {
    getComplementaryPromotions,
    getSeasonalPromotions,
    getBundleOffers,
    applyPromoCode,
    getClearancePromotions,
    getCrossSellRecommendations,
    getLoyaltyRewards,
    getPromotionsAnalytics,
    createCustomBundle,
    createPromotionalCampaign
}

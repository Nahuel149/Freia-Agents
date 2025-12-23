import { utilGetChatMessage } from './getChatMessage'
import { getRunningExpressApp } from './getRunningExpressApp'
import logger from './logger'

interface ProductInfo {
    product_sku?: string
    product_brand?: string
    product_model?: string
    wheel_size?: string
    confidence: number
}

interface ConversationAnalysisResult {
    productInfo: ProductInfo | null
    analysisDetails: {
        messagesAnalyzed: number
        keywordsFound: string[]
        confidenceScore: number
    }
}

// Product patterns based on tire industry standards
const TIRE_SIZE_PATTERNS = [
    /\b(\d{3}\/\d{2}R\d{2})\b/gi, // 225/60R16
    /\b(\d{3}\/\d{2}-\d{2})\b/gi, // 225/60-16
    /\b(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2})\b/gi, // 225 / 60 R 16
    /\b(\d{3}x\d{2}R\d{2})\b/gi // 225x60R16
]

const BRAND_PATTERNS = [
    /\b(michelin|bridgestone|goodyear|continental|pirelli|dunlop|yokohama|toyo|falken|hankook|kumho|nexen|cooper|bf\s*goodrich|general|firestone|uniroyal|nitto|maxxis|atturo|federal|achilles|lexani|vercelli|lionhart|delinte|accelera|westlake|sunny|triangle|doublestar|roadstone|marshal|gt\s*radial|nankang|zeetex|rotalla|comforser|rapid|goodride|hifly|landsail|roadcruza|autogreen|headway|invovic|ovation|tracmax|windforce|goalstar|roadmarch|antares|runway|kenda|radar|fortune|boto|wanli|chaoyang|linglong|aeolus|triangle|doublestar|roadstone|marshal|gt\s*radial|nankang|zeetex|rotalla|comforser|rapid|goodride|hifly|landsail|roadcruza|autogreen|headway|invovic|ovation|tracmax|windforce|goalstar|roadmarch|antares|runway|kenda|radar|fortune|boto|wanli|chaoyang|linglong|aeolus)\b/gi
]

const PRODUCT_KEYWORDS = [
    'tire',
    'tires',
    'tyre',
    'tyres',
    'wheel',
    'wheels',
    'rim',
    'rims',
    'all season',
    'winter',
    'summer',
    'performance',
    'touring',
    'sport',
    'mud terrain',
    'all terrain',
    'highway',
    'commercial',
    'truck',
    'passenger',
    'suv',
    'crossover',
    'sedan',
    'coupe',
    'hatchback'
]

const INTENT_KEYWORDS = [
    'buy',
    'purchase',
    'need',
    'want',
    'looking for',
    'interested in',
    'quote',
    'price',
    'cost',
    'how much',
    'available',
    'in stock',
    'order',
    'get',
    'install',
    'replacement',
    'change',
    'upgrade'
]

/**
 * Analyzes conversation history to extract product information
 */
export const analyzeConversationForProduct = async (
    chatflowid: string,
    sessionId?: string,
    chatId?: string,
    phoneNumber?: string
): Promise<ConversationAnalysisResult> => {
    try {
        // Get recent chat messages (last 20 messages to avoid processing too much data)
        const messages = await utilGetChatMessage({
            chatflowid,
            sessionId,
            chatId,
            sortOrder: 'DESC',
            activeWorkspaceId: 'oss-mode' // Default workspace
        })

        // Limit to recent messages for performance
        const recentMessages = messages.slice(0, 20)

        if (recentMessages.length === 0) {
            return {
                productInfo: null,
                analysisDetails: {
                    messagesAnalyzed: 0,
                    keywordsFound: [],
                    confidenceScore: 0
                }
            }
        }

        // Combine all message content for analysis
        const conversationText = recentMessages
            .map((msg) => msg.content || '')
            .join(' ')
            .toLowerCase()

        const analysisResult = extractProductInfo(conversationText)

        // If we have phone number but no product info from conversation,
        // try to get product info from previous sales
        if (!analysisResult.productInfo && phoneNumber) {
            const previousSalesProduct = await getProductFromPreviousSales(phoneNumber)
            if (previousSalesProduct) {
                analysisResult.productInfo = {
                    ...previousSalesProduct,
                    confidence: 0.6 // Lower confidence for historical data
                }
                analysisResult.analysisDetails.confidenceScore = 0.6
                analysisResult.analysisDetails.keywordsFound.push('previous_sales_history')
            }
        }

        analysisResult.analysisDetails.messagesAnalyzed = recentMessages.length

        logger.info(`Conversation analysis completed for chatflow ${chatflowid}:`, {
            messagesAnalyzed: recentMessages.length,
            productFound: !!analysisResult.productInfo,
            confidence: analysisResult.analysisDetails.confidenceScore
        })

        return analysisResult
    } catch (error) {
        logger.error('Error analyzing conversation for product:', error)
        return {
            productInfo: null,
            analysisDetails: {
                messagesAnalyzed: 0,
                keywordsFound: [],
                confidenceScore: 0
            }
        }
    }
}

/**
 * Extracts product information from conversation text
 */
function extractProductInfo(text: string): ConversationAnalysisResult {
    const keywordsFound: string[] = []
    let confidence = 0
    const productInfo: ProductInfo = { confidence: 0 }

    // Extract tire size
    for (const pattern of TIRE_SIZE_PATTERNS) {
        const matches = text.match(pattern)
        if (matches && matches.length > 0) {
            productInfo.wheel_size = matches[0].replace(/\s+/g, '').toUpperCase()
            keywordsFound.push(`tire_size:${productInfo.wheel_size}`)
            confidence += 0.4
            break
        }
    }

    // Extract brand
    const brandMatches = text.match(BRAND_PATTERNS[0])
    if (brandMatches && brandMatches.length > 0) {
        productInfo.product_brand = brandMatches[0]
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        keywordsFound.push(`brand:${productInfo.product_brand}`)
        confidence += 0.3
    }

    // Check for product keywords
    const productKeywordCount = PRODUCT_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase())).length

    if (productKeywordCount > 0) {
        keywordsFound.push(`product_keywords:${productKeywordCount}`)
        confidence += Math.min(productKeywordCount * 0.1, 0.2)
    }

    // Check for purchase intent
    const intentKeywordCount = INTENT_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase())).length

    if (intentKeywordCount > 0) {
        keywordsFound.push(`intent_keywords:${intentKeywordCount}`)
        confidence += Math.min(intentKeywordCount * 0.05, 0.1)
    }

    // Generate product SKU if we have enough information
    if (productInfo.product_brand && productInfo.wheel_size) {
        productInfo.product_sku = generateProductSKU(productInfo.product_brand, productInfo.wheel_size)
        confidence += 0.2
    }

    productInfo.confidence = Math.min(confidence, 1.0)

    return {
        productInfo: confidence > 0.3 ? productInfo : null,
        analysisDetails: {
            messagesAnalyzed: 0, // Will be set by caller
            keywordsFound,
            confidenceScore: confidence
        }
    }
}

/**
 * Generates a product SKU based on brand and wheel size
 */
function generateProductSKU(brand: string, wheelSize: string): string {
    const brandCode = brand.substring(0, 3).toUpperCase()
    const sizeCode = wheelSize.replace(/[^0-9]/g, '')
    return `${brandCode}-${sizeCode}-AS` // AS for All Season (default)
}

/**
 * Gets product information from customer's previous sales
 */
async function getProductFromPreviousSales(phoneNumber: string): Promise<Partial<ProductInfo> | null> {
    try {
        const appServer = getRunningExpressApp()
        const query = `
            SELECT product_sku, product_brand, product_model, wheel_size
            FROM sales 
            WHERE phone_number = $1 
            AND product_sku IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT 1
        `

        const result = await appServer.AppDataSource.query(query, [phoneNumber])

        if (result.length > 0) {
            const sale = result[0]
            return {
                product_sku: sale.product_sku,
                product_brand: sale.product_brand,
                product_model: sale.product_model,
                wheel_size: sale.wheel_size
            }
        }

        return null
    } catch (error) {
        logger.error('Error getting product from previous sales:', error)
        return null
    }
}

/**
 * Validates if a product SKU exists in inventory
 */
export const validateProductSKU = async (productSku: string): Promise<boolean> => {
    try {
        const appServer = getRunningExpressApp()
        const query = 'SELECT "productId" FROM product_inventory WHERE "productId" = $1 LIMIT 1'
        const result = await appServer.AppDataSource.query(query, [productSku])
        return result.length > 0
    } catch (error) {
        logger.error('Error validating product SKU:', error)
        return false
    }
}

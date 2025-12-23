import express from 'express'
import salesController from '../../controllers/sales'

const router = express.Router()

// GET /api/v1/sales - Get all sales with pagination and filters
router.get('/', salesController.getAllSales)

// GET /api/v1/sales/stats - Get sales statistics
router.get('/stats', salesController.getSalesStats)

// GET /api/v1/sales/recent - Get recent sales
router.get('/recent', salesController.getRecentSales)

// GET /api/v1/sales/status/:status - Get sales by status
router.get('/status/:status', salesController.getSalesByStatus)

// GET /api/v1/sales/phone/:phone - Get sales by customer phone
router.get('/phone/:phone', salesController.getSalesByPhone)

// GET /api/v1/sales/:id - Get sale by ID
router.get('/:id', salesController.getSaleById)

// POST /api/v1/sales - Create new sale
router.post('/', salesController.createSale)

// PUT /api/v1/sales/:id - Update sale
router.put('/:id', salesController.updateSale)

// POST /api/v1/sales/quote - Generate quote for a product
router.post('/quote', salesController.createSaleQuote)

// GET /api/v1/sales/alternatives - Get product alternatives
router.get('/alternatives', salesController.getProductAlternatives)

// POST /api/v1/sales/discount - Apply discount to a quote or sale
router.post('/discount', salesController.applyDiscount)

// POST /api/v1/sales/price-approval - Request price approval
router.post('/price-approval', salesController.requestPriceApproval)

// GET /api/v1/sales/delivery - Get delivery options
router.get('/delivery', salesController.getDeliveryOptions)

// POST /api/v1/sales/delivery-improvement - Improve delivery ETA
router.post('/delivery-improvement', salesController.improveDeliveryTime)

// GET /api/v1/sales/payment-methods - Get payment methods
router.get('/payment-methods', salesController.getPaymentMethods)

// POST /api/v1/sales/order-number - Generate order number for sale
router.post('/order-number', salesController.generateOrderNumber)

// POST /api/v1/sales/create - alias to createSale
router.post('/create', salesController.createSale)

// GET /api/v1/sales/summary/:saleId - Get sale summary including records
router.get('/summary/:saleId', salesController.getSaleSummary)

export default router

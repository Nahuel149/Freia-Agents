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

export default router
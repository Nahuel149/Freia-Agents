import express from 'express'
import inventoryController from '../../controllers/inventory'

const router = express.Router()

// GET /api/v1/inventory - Get all inventory items
router.get('/', inventoryController.getAllInventory)

// GET /api/v1/inventory/search - Search inventory
router.get('/search', inventoryController.searchInventory)

// GET /api/v1/inventory/stats - Get inventory statistics
router.get('/stats', inventoryController.getInventoryStats)

// GET /api/v1/inventory/low-stock - Get low stock items
router.get('/low-stock', inventoryController.getLowStockItems)

// GET /api/v1/inventory/check - Check inventory availability
router.get('/check', inventoryController.checkInventoryItem)

// GET /api/v1/inventory/:productId - Get specific inventory item
router.get('/:productId', inventoryController.getInventoryById)

// POST /api/v1/inventory - Create new inventory item
router.post('/', inventoryController.createInventoryItem)

// PUT /api/v1/inventory/:productId - Update inventory stock/price
router.put('/:productId', inventoryController.updateInventoryStock)

export default router
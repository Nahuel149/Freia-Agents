import express from 'express'
import dashboardController from '../../controllers/dashboard'

const router = express.Router()

// GET /api/v1/dashboard
router.get('/', dashboardController.getDashboardMetrics)

// GET /api/v1/dashboard/customers
router.get('/customers', dashboardController.getCustomerStats)

// GET /api/v1/dashboard/sales
router.get('/sales', dashboardController.getSalesStats)

export default router
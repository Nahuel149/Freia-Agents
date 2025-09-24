import express from 'express'
import dashboardController from '../../controllers/dashboard'

const router = express.Router()

// GET /api/v1/dashboard
router.get('/', dashboardController.getDashboardMetrics)

// GET /api/v1/dashboard/customers
router.get('/customers', dashboardController.getCustomerStats)

// GET /api/v1/dashboard/sales
router.get('/sales', dashboardController.getSalesStats)

// Agent performance view
router.get('/funnel', dashboardController.getFunnel)
router.get('/recent', dashboardController.getRecentActivities)
router.get('/follow-ups', dashboardController.getFollowUps)
router.get('/top-agents', dashboardController.getTopAgents)
router.get('/alerts', dashboardController.getToolAlerts)
router.patch('/alerts/:id', dashboardController.resolveToolAlert)
router.get('/price-approvals', dashboardController.getPriceApprovalRequests)
router.patch('/price-approvals/:id', dashboardController.updatePriceApprovalRequest)

export default router

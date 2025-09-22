import express from 'express'
import notificationsController from '../../controllers/notifications'

const router = express.Router()

// POST /api/v1/notifications/create - Generic notification entry
router.post('/create', notificationsController.createNotification)

// POST /api/v1/notifications/price-approval - Notify price approval decision
router.post('/price-approval', notificationsController.notifyPriceApproval)

// POST /api/v1/notifications/delivery-improvement - Notify improved delivery time
router.post('/delivery-improvement', notificationsController.notifyDeliveryImprovement)

// POST /api/v1/notifications/stock-available - Notify stock availability
router.post('/stock-available', notificationsController.notifyStockAvailable)

export default router

import express from 'express'
import followupsController from '../../controllers/followups'

const router = express.Router()

// GET /api/v1/followups - Get all follow-ups with pagination and filters
router.get('/', followupsController.getAllFollowUps)

// GET /api/v1/followups/stats - Get follow-ups statistics
router.get('/stats', followupsController.getFollowUpsStats)

// GET /api/v1/followups/due-today - Get follow-ups due today
router.get('/due-today', followupsController.getFollowUpsDueToday)

// GET /api/v1/followups/overdue - Get overdue follow-ups
router.get('/overdue', followupsController.getOverdueFollowUps)

// GET /api/v1/followups/type/:type - Get follow-ups by type
router.get('/type/:type', followupsController.getFollowUpsByType)

// GET /api/v1/followups/phone/:phone - Get follow-ups by customer phone
router.get('/phone/:phone', followupsController.getFollowUpsByPhone)

// GET /api/v1/followups/customer/:customerId - Get follow-ups by customer ID
router.get('/customer/:customerId', followupsController.getFollowUpsByCustomerId)

// GET /api/v1/followups/:id - Get follow-up by ID
router.get('/:id', followupsController.getFollowUpById)

// POST /api/v1/followups - Create new follow-up
router.post('/', followupsController.createFollowUp)

// PUT /api/v1/followups/:id - Update follow-up
router.put('/:id', followupsController.updateFollowUp)

export default router
import express from 'express'
import followupsController from '../../controllers/followups'

const router = express.Router()

// GET /api/v1/followup/pending - Pending follow-ups
router.get('/pending', followupsController.getPendingFollowUps)

// GET /api/v1/followup/analytics - Analytics summary
router.get('/analytics', followupsController.getFollowUpAnalytics)

// POST /api/v1/followup/schedule - Schedule a follow-up
router.post('/schedule', followupsController.scheduleFollowUp)

// POST /api/v1/followup/execute - Execute follow-up and mark completed
router.post('/execute', followupsController.executeFollowUp)

// POST /api/v1/followup/update-status - Update follow-up status
router.post('/update-status', followupsController.updateFollowUpStatusAlias)

export default router

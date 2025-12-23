import express from 'express'

// Import the JavaScript orchestration routes
const {
    router: orchestrationRouter,
    initializeOrchestrationRoutes
} = require('../../../marketplaces/codeagentv2/code-orchestration-routes')

const router = express.Router()

// Mount the orchestration routes
router.use('/', orchestrationRouter)

// Initialize orchestration routes on startup
initializeOrchestrationRoutes().catch((error: Error) => {
    console.error('Failed to initialize orchestration routes:', error)
})

export default router

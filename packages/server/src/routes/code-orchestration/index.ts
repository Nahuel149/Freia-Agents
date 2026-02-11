import express from 'express'

const router = express.Router()
const orchestrationEnabled = process.env.ENABLE_CODE_ORCHESTRATION === 'true'

if (orchestrationEnabled) {
    // Import lazily so disabled mode does not initialize orchestration internals.
    const {
        router: orchestrationRouter,
        initializeOrchestrationRoutes
    } = require('../../../marketplaces/codeagentv2/code-orchestration-routes')

    router.use('/', orchestrationRouter)

    initializeOrchestrationRoutes().catch((error: Error) => {
        console.error('Failed to initialize orchestration routes:', error)
    })
} else {
    router.get('/health', (_req, res) => {
        res.status(200).json({
            success: true,
            data: {
                status: 'disabled',
                enabled: false,
                timestamp: new Date().toISOString()
            }
        })
    })
}

export default router

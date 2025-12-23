import express from 'express'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { CodeAgentAnalyticsService } from '../../services/codeagent-analytics'

const router = express.Router()

router.post('/ingest', async (req, res, next) => {
    try {
        const svc = new CodeAgentAnalyticsService(getRunningExpressApp().AppDataSource)
        const events = await svc.ingestEvents(req.body || {})
        const datasets = await svc.ingestDatasets(req.body || {})
        res.json({ ...events, ...datasets })
    } catch (e) {
        next(e)
    }
})

export default router

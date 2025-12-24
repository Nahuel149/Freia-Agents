import express from 'express'
import rateLimit from 'express-rate-limit'
import manualAgentsController from '../../controllers/manual-agents'
import { checkPermission } from '../../oss/rbac/PermissionCheck'

const router = express.Router()

const publicChatLimiter = rateLimit({
    windowMs: parseInt(process.env.MANUAL_AGENT_PUBLIC_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.MANUAL_AGENT_PUBLIC_RATE_LIMIT_MAX || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip || 'unknown'}:${req.params.token || 'public'}`
})

router.get('/health', checkPermission('chatflows:view'), manualAgentsController.getManualAgentsHealth)
router.get('/public/:token', publicChatLimiter, manualAgentsController.getPublicAgentInfo)
router.post('/public/:token/chat', publicChatLimiter, manualAgentsController.chatManualAgentPublic)
router.get('/public/:token/session/:sessionId', publicChatLimiter, manualAgentsController.getPublicSession)

router.get('/', checkPermission('chatflows:view'), manualAgentsController.getAllManualAgents)
router.get('/:id', checkPermission('chatflows:view'), manualAgentsController.getManualAgentById)
router.get('/:id/sessions', checkPermission('chatflows:view'), manualAgentsController.getManualAgentSessions)
router.get('/:id/sessions/:sessionId', checkPermission('chatflows:view'), manualAgentsController.getManualAgentSession)
router.get('/:id/kpi', checkPermission('chatflows:view'), manualAgentsController.getManualAgentKpi)
router.get('/:id/outbound', checkPermission('chatflows:view'), manualAgentsController.getManualAgentOutbound)
router.post('/:id/chat', checkPermission('chatflows:view'), manualAgentsController.chatManualAgent)
router.post('/:id/holds', checkPermission('chatflows:update'), manualAgentsController.createHold)
router.post('/:id/payments/confirm', checkPermission('chatflows:update'), manualAgentsController.confirmPayment)
router.post('/:id/share', checkPermission('chatflows:update'), manualAgentsController.createShareToken)
router.get('/:id/share', checkPermission('chatflows:view'), manualAgentsController.getShareTokens)
router.delete('/:id/share/:tokenId', checkPermission('chatflows:update'), manualAgentsController.revokeShareToken)
router.post('/:id/outbound/send', checkPermission('chatflows:update'), manualAgentsController.sendOutbound)
router.post('/:id/seed', checkPermission('chatflows:update'), manualAgentsController.seedManualAgentData)
router.delete('/:id', checkPermission('chatflows:delete'), manualAgentsController.archiveManualAgent)

export default router

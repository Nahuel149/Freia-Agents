import express from 'express'
import crypto from 'crypto'
import logger from '../../utils/logger'
import { WhatsAppService } from '../../services/whatsapp'

const router = express.Router()
const svc = new WhatsAppService()

// Status endpoint to check configuration
router.get('/status', async (req, res) => {
    const hasKey = Boolean(process.env.WASENDER_API_KEY && process.env.WASENDER_API_KEY.trim())
    const hasAgent = Boolean(process.env.WHATSAPP_CODEAGENT_ID && process.env.WHATSAPP_CODEAGENT_ID.trim())
    const signatureRequired = Boolean(process.env.WASENDER_WEBHOOK_SECRET && process.env.WASENDER_WEBHOOK_SECRET.trim())
    const hasPhone = Boolean(process.env.WASENDER_PHONE_NUMBER_ID && process.env.WASENDER_PHONE_NUMBER_ID.trim())
    const apiUrl = (process.env.WASENDER_API_URL || '').trim()
    const mode = /api\.wasender\.live/.test(apiUrl) || hasPhone ? 'new' : 'legacy'
    res.json({ hasKey, hasAgent, signatureRequired, hasPhone, mode })
})

// Test send endpoint: { to, text }
router.post('/send', async (req, res, next) => {
    try {
        const { to, text } = req.body || {}
        if (!to || !text) return res.status(400).json({ message: 'to and text are required' })
        const data = await svc.sendMessage({ to, text })
        res.json({ ok: true, data })
    } catch (e) {
        next(e)
    }
})

// Verify X-Webhook-Signature using HMAC SHA256 of the raw request body
function verifyWebhook(req: express.Request): boolean {
    const secret = process.env.WASENDER_WEBHOOK_SECRET
    if (!secret) return true // if not configured, skip verification
    const header = (req.headers['x-webhook-signature'] as string) || ''
    if (!header) return false
    const payload = (req as any).rawBody as Buffer
    if (!payload) return false
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    try {
        const a = Buffer.from(hmac)
        const b = Buffer.from(header)
        return a.length === b.length && crypto.timingSafeEqual(a, b)
    } catch {
        return false
    }
}

// Middleware to capture raw body for signature verification
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res, next) => {
    try {
        // Signature verification
        if (!verifyWebhook(req)) {
            return res.status(401).json({ message: 'Invalid webhook signature' })
        }

        // Parse JSON body
        let body: any = {}
        try {
            body = JSON.parse((req as any).rawBody?.toString('utf8') || '{}')
        } catch (e) {
            logger.warn('[whatsapp:webhook] invalid JSON payload')
            return res.status(400).json({ message: 'Invalid JSON payload' })
        }
        const from = body.from || body.sender || body.number || ''
        const to = body.to || ''
        const text = body.text || body.message || body.msg || body.body || ''

        logger.info(`[whatsapp:webhook] from=${from} to=${to} text=${(text || '').slice(0, 200)}`)

        // Bridge to CodeAgent if configured
        const agentId = process.env.WHATSAPP_CODEAGENT_ID
        if (agentId && text) {
            try {
                const { text: aiText } = await svc.executeCodeAgentAndGetReply(agentId, text, [])
                if (aiText) {
                    await svc.sendMessage({ to: from, text: aiText })
                }
            } catch (e) {
                logger.warn(`[whatsapp:webhook] AI reply failed: ${e}`)
            }
        }

        res.json({ received: true })
    } catch (e) {
        next(e)
    }
})

export default router

import express from 'express'
import supportController from '../../controllers/support'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { SupportTicket } from '../../database/entities/SupportTicket'
import { getMulterStorage } from '../../utils'
const router = express.Router()

// Submit a support ticket
router.post('/tickets', getMulterStorage().array('files'), supportController.submitTicket)

// Simple list endpoint (latest first)
router.get('/tickets', async (req, res, next) => {
    try {
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(SupportTicket)
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200)
        const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1)
        const [rows, total] = await repo.findAndCount({
            order: { createdDate: 'DESC' },
            skip: (page - 1) * limit,
            take: limit
        })
        res.json({ data: rows, total, page, limit })
    } catch (e) {
        next(e)
    }
})

// Get ticket by id
router.get('/tickets/:id', async (req, res, next) => {
    try {
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(SupportTicket)
        const ticket = await repo.findOne({ where: { id: req.params.id } })
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
        res.json(ticket)
    } catch (e) {
        next(e)
    }
})

// Update ticket (status only for now)
router.patch('/tickets/:id', async (req, res, next) => {
    try {
        const { status } = req.body || {}
        const allowed = ['OPEN', 'CLOSED']
        if (status && !allowed.includes(String(status).toUpperCase())) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(', ')}` })
        }
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(SupportTicket)
        const ticket = await repo.findOne({ where: { id: req.params.id } })
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
        if (status) ticket.status = String(status).toUpperCase()
        const saved = await repo.save(ticket)
        res.json(saved)
    } catch (e) {
        next(e)
    }
})

export default router

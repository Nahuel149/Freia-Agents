import express from 'express'
import { AgentDashboardService } from '../services/agent-dashboard'

const router = express.Router()

// GET /api/v1/agent-dashboard/metrics
router.get('/metrics', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const metrics = await service.getAgentExecutionMetrics()
        res.json(metrics)
    } catch (error) {
        console.error('Error fetching agent metrics:', error)
        res.status(500).json({ error: 'Failed to fetch agent metrics' })
    }
})

// GET /api/v1/agent-dashboard/inventory-status
router.get('/inventory-status', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const status = await service.getInventoryIntegrationStatus()
        res.json(status)
    } catch (error) {
        console.error('Error fetching inventory status:', error)
        res.status(500).json({ error: 'Failed to fetch inventory status' })
    }
})

// GET /api/v1/agent-dashboard/sales-status
router.get('/sales-status', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const status = await service.getSalesIntegrationStatus()
        res.json(status)
    } catch (error) {
        console.error('Error fetching sales status:', error)
        res.status(500).json({ error: 'Failed to fetch sales status' })
    }
})

// GET /api/v1/agent-dashboard/outbound-status
router.get('/outbound-status', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const status = await service.getOutboundContactStatus()
        res.json(status)
    } catch (error) {
        console.error('Error fetching outbound status:', error)
        res.status(500).json({ error: 'Failed to fetch outbound status' })
    }
})

// GET /api/v1/agent-dashboard/promotional-status
router.get('/promotional-status', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const status = await service.getPromotionalSystemStatus()
        res.json(status)
    } catch (error) {
        console.error('Error fetching promotional status:', error)
        res.status(500).json({ error: 'Failed to fetch promotional status' })
    }
})

// GET /api/v1/agent-dashboard/health
router.get('/health', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        const health = await service.getAgentHealthStatus()
        res.json(health)
    } catch (error) {
        console.error('Error fetching agent health:', error)
        res.status(500).json({ error: 'Failed to fetch agent health' })
    }
})

// GET /api/v1/agent-dashboard/overview
router.get('/overview', async (req, res) => {
    try {
        const service = new AgentDashboardService()
        
        // Fetch all data in parallel
        const [
            metrics,
            inventoryStatus,
            salesStatus,
            outboundStatus,
            promotionalStatus,
            health
        ] = await Promise.all([
            service.getAgentExecutionMetrics(),
            service.getInventoryIntegrationStatus(),
            service.getSalesIntegrationStatus(),
            service.getOutboundContactStatus(),
            service.getPromotionalSystemStatus(),
            service.getAgentHealthStatus()
        ])

        const overview = {
            health,
            metrics,
            integrations: {
                inventory: inventoryStatus,
                sales: salesStatus,
                outbound: outboundStatus,
                promotional: promotionalStatus
            },
            summary: {
                totalToolExecutions: metrics.totalExecutions,
                successRate: metrics.successRate,
                activeIntegrations: 4, // inventory, sales, outbound, promotional
                pendingTasks: outboundStatus.pendingFollowUps + inventoryStatus.lowStockAlerts.length
            }
        }

        res.json(overview)
    } catch (error) {
        console.error('Error fetching agent overview:', error)
        res.status(500).json({ error: 'Failed to fetch agent overview' })
    }
})

export default router
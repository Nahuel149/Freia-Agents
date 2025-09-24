import { Request, Response } from 'express'
import { DashboardService } from '../../services/dashboard'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const getDashboardMetrics = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const metrics = await dashboardService.getDashboardMetrics()
        return res.json(metrics)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getDashboardMetrics - ${error}`
        )
    }
}

const getCustomerStats = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const stats = await dashboardService.getCustomerStats()
        return res.json(stats)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getCustomerStats - ${error}`
        )
    }
}

const getSalesStats = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const stats = await dashboardService.getSalesStats()
        return res.json(stats)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getSalesStats - ${error}`
        )
    }
}

const getFunnel = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const data = await dashboardService.getFunnel()
        return res.json(data)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getFunnel - ${error}`
        )
    }
}

const getRecentActivities = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const limit = parseInt((req.query.limit as string) || '20', 10)
        const data = await dashboardService.getRecentActivities(limit)
        return res.json(data)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getRecentActivities - ${error}`
        )
    }
}

const getFollowUps = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const limit = parseInt((req.query.limit as string) || '15', 10)
        const status = typeof req.query.status === 'string' ? req.query.status : undefined
        const data = await dashboardService.getRecentFollowUps(limit, status)
        return res.json(data)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getFollowUps - ${error}`
        )
    }
}

const getTopAgents = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const limit = parseInt((req.query.limit as string) || '5', 10)
        const data = await dashboardService.getTopAgents(limit)
        return res.json(data)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getTopAgents - ${error}`
        )
    }
}

const getToolAlerts = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const status = typeof req.query.status === 'string' ? req.query.status : undefined
        const limit = parseInt((req.query.limit as string) || '50', 10)
        const alerts = await dashboardService.getToolAlerts(status, limit)
        return res.json(alerts)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getToolAlerts - ${error}`
        )
    }
}

const resolveToolAlert = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const id = parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid alert id')
        }
        const payload = {
            status: typeof req.body?.status === 'string' ? req.body.status : undefined,
            resolvedBy: typeof req.body?.resolvedBy === 'string' ? req.body.resolvedBy : undefined,
            resolvedNotes: typeof req.body?.resolvedNotes === 'string' ? req.body.resolvedNotes : undefined
        }
        const alert = await dashboardService.resolveToolAlert(id, payload)
        return res.json(alert)
    } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, error.message)
        }
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.resolveToolAlert - ${error}`
        )
    }
}

const getPriceApprovalRequests = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const status = typeof req.query.status === 'string' ? req.query.status : undefined
        const limit = parseInt((req.query.limit as string) || '50', 10)
        const requests = await dashboardService.getPriceApprovalRequests(status, limit)
        return res.json(requests)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.getPriceApprovalRequests - ${error}`
        )
    }
}

const updatePriceApprovalRequest = async (req: Request, res: Response) => {
    try {
        const dashboardService = new DashboardService()
        const id = parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid price approval id')
        }

        const payload = {
            status: typeof req.body?.status === 'string' ? req.body.status : undefined,
            reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
            approvedDiscount:
                req.body?.approvedDiscount !== undefined ? Number(req.body.approvedDiscount) : undefined,
            decisionNotes: typeof req.body?.decisionNotes === 'string' ? req.body.decisionNotes : undefined
        }

        const updated = await dashboardService.updatePriceApprovalRequest(id, payload)
        return res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, error.message)
        }
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: dashboardController.updatePriceApprovalRequest - ${error}`
        )
    }
}

export default {
    getDashboardMetrics,
    getCustomerStats,
    getSalesStats,
    getFunnel,
    getRecentActivities,
    getFollowUps,
    getTopAgents,
    getToolAlerts,
    resolveToolAlert,
    getPriceApprovalRequests,
    updatePriceApprovalRequest
}

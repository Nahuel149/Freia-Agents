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

export default {
    getDashboardMetrics,
    getCustomerStats,
    getSalesStats,
    getFunnel,
    getRecentActivities,
    getTopAgents
}

import { getRunningExpressApp } from '../utils'
import { DataSource } from 'typeorm'

export class AgentDashboardService {
    private dataSource: DataSource

    constructor() {
        const app = getRunningExpressApp()
        this.dataSource = app.AppDataSource
    }

    async getAgentExecutionMetrics(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map(rows)
            } catch (error) {
                console.error('Query error:', error)
                return fallback
            }
        }

        // Agent execution statistics
        const totalExecutions = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event WHERE type='tool_execution' AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        const successfulExecutions = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event WHERE type='tool_execution' AND (metadata::json->>'status')='success' AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        const failedExecutions = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event WHERE type='tool_execution' AND (metadata::json->>'status')='error' AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Tool usage breakdown
        const toolUsage = await q<{ tool: string; count: number; success_rate: number }[]>(
            `SELECT 
                metadata::json->>'tool' AS tool,
                COUNT(*) AS count,
                ROUND(
                    (COUNT(CASE WHEN (metadata::json->>'status')='success' THEN 1 END) * 100.0 / COUNT(*)), 2
                ) AS success_rate
             FROM agent_event 
             WHERE type='tool_execution' AND ts >= NOW() - INTERVAL '7 days'
             GROUP BY metadata::json->>'tool'
             ORDER BY count DESC`,
            (rs) =>
                rs.map((r) => ({
                    tool: r.tool || 'Unknown',
                    count: parseInt(r.count || '0'),
                    success_rate: parseFloat(r.success_rate || '0')
                })),
            []
        )

        // Agent performance by agent ID
        const agentPerformance = await q<{ agentId: string; executions: number; success_rate: number; avg_response_time: number }[]>(
            `SELECT 
                COALESCE("agentId", 'unknown') AS agent_id,
                COUNT(*) AS executions,
                ROUND(
                    (COUNT(CASE WHEN (metadata::json->>'status')='success' THEN 1 END) * 100.0 / COUNT(*)), 2
                ) AS success_rate,
                AVG((metadata::json->>'responseTime')::numeric) AS avg_response_time
             FROM agent_event 
             WHERE type='tool_execution' AND ts >= NOW() - INTERVAL '7 days'
             GROUP BY COALESCE("agentId", 'unknown')
             ORDER BY executions DESC`,
            (rs) =>
                rs.map((r) => ({
                    agentId: r.agent_id,
                    executions: parseInt(r.executions || '0'),
                    success_rate: parseFloat(r.success_rate || '0'),
                    avg_response_time: parseFloat(r.avg_response_time || '0')
                })),
            []
        )

        // Recent agent activities
        const recentActivities = await q<any[]>(
            `SELECT 
                id, ts, type, "agentId", "clientId", "clientName", 
                metadata::json->>'tool' AS tool,
                metadata::json->>'status' AS status,
                metadata::json->>'result' AS result,
                message
             FROM agent_event 
             WHERE ts >= NOW() - INTERVAL '2 hours'
             ORDER BY ts DESC 
             LIMIT 50`,
            (rs) => rs,
            []
        )

        // Error analysis
        const errorAnalysis = await q<{ error_type: string; count: number; last_occurrence: string }[]>(
            `SELECT 
                metadata::json->>'error_type' AS error_type,
                COUNT(*) AS count,
                MAX(ts) AS last_occurrence
             FROM agent_event 
             WHERE type='tool_execution' AND (metadata::json->>'status')='error'
             AND ts >= NOW() - INTERVAL '7 days'
             GROUP BY metadata::json->>'error_type'
             ORDER BY count DESC`,
            (rs) =>
                rs.map((r) => ({
                    error_type: r.error_type || 'Unknown Error',
                    count: parseInt(r.count || '0'),
                    last_occurrence: r.last_occurrence
                })),
            []
        )

        const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

        return {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            successRate,
            toolUsage,
            agentPerformance,
            recentActivities,
            errorAnalysis,
            lastUpdated: new Date().toISOString()
        }
    }

    async getInventoryIntegrationStatus(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map(rows)
            } catch {
                return fallback
            }
        }

        // Inventory tool usage
        const inventoryToolUsage = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND (metadata::json->>'tool' LIKE '%inventory%' OR metadata::json->>'tool' LIKE '%product%')
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Low stock alerts generated by agent
        const lowStockAlerts = await q<any[]>(
            `SELECT "productId", name, brand, stock, last_updated 
             FROM product_inventory 
             WHERE stock < 20 
             ORDER BY stock ASC`,
            (rs) => rs,
            []
        )

        // Product recommendations made
        const productRecommendations = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Get Product Recommendations'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        return {
            inventoryToolUsage,
            lowStockAlerts,
            productRecommendations,
            totalProducts: lowStockAlerts.length
        }
    }

    async getSalesIntegrationStatus(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map(rows)
            } catch {
                return fallback
            }
        }

        // Sales flow tool usage
        const salesToolUsage = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND (metadata::json->>'tool' LIKE '%quote%' OR metadata::json->>'tool' LIKE '%sale%')
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Quotes generated by agent
        const quotesGenerated = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Generate Quote'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Sales completed through agent
        const agentSales = await q<{ count: number; revenue: number }>(
            `SELECT COUNT(*) AS count, COALESCE(SUM("totalAmount"), 0) AS revenue
             FROM sale_record 
             WHERE "agentId" IS NOT NULL 
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => ({
                count: parseInt(rs?.[0]?.count || '0'),
                revenue: parseFloat(rs?.[0]?.revenue || '0')
            }),
            { count: 0, revenue: 0 }
        )

        return {
            salesToolUsage,
            quotesGenerated,
            agentSales
        }
    }

    async getOutboundContactStatus(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map(rows)
            } catch {
                return fallback
            }
        }

        // WhatsApp messages sent
        const whatsappSent = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Send WhatsApp Message'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Follow-ups scheduled
        const followUpsScheduled = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Schedule Follow-up Contact'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Pending follow-ups
        const pendingFollowUps = await q<any[]>(
            `SELECT id, "clientId", "clientName", contact_method, scheduled_date, priority
             FROM follow_up_contacts 
             WHERE status = 'pending' 
             AND scheduled_date <= NOW() + INTERVAL '24 hours'
             ORDER BY scheduled_date ASC`,
            (rs) => rs,
            []
        )

        return {
            whatsappSent,
            followUpsScheduled,
            pendingFollowUps: pendingFollowUps.length,
            upcomingFollowUps: pendingFollowUps
        }
    }

    async getPromotionalSystemStatus(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map(rows)
            } catch {
                return fallback
            }
        }

        // Promotional codes applied
        const promoCodesApplied = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Apply Promotional Code'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Bundles created
        const bundlesCreated = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event 
             WHERE type='tool_execution' 
             AND metadata::json->>'tool' = 'Create Custom Bundle'
             AND ts >= NOW() - INTERVAL '24 hours'`,
            (rs) => parseInt(rs?.[0]?.c || '0'),
            0
        )

        // Active promotions
        const activePromotions = await q<any[]>(
            `SELECT id, name, discount_percentage, valid_until, usage_count
             FROM promotional_campaigns 
             WHERE status = 'active' 
             AND valid_until >= NOW()
             ORDER BY valid_until ASC`,
            (rs) => rs,
            []
        )

        return {
            promoCodesApplied,
            bundlesCreated,
            activePromotions: activePromotions.length,
            promotionsList: activePromotions
        }
    }

    async getAgentHealthStatus(): Promise<any> {
        // Check if agent is responding and healthy
        const lastActivity = await this.dataSource.query(
            `SELECT MAX(ts) as last_activity FROM agent_event WHERE ts >= NOW() - INTERVAL '1 hour'`
        )

        const isHealthy = lastActivity?.[0]?.last_activity
            ? new Date().getTime() - new Date(lastActivity[0].last_activity).getTime() < 300000 // 5 minutes
            : false

        return {
            isHealthy,
            lastActivity: lastActivity?.[0]?.last_activity,
            status: isHealthy ? 'online' : 'offline'
        }
    }
}

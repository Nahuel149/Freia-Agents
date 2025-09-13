import { getRunningExpressApp } from '../utils'
import { DataSource } from 'typeorm'

export class DashboardService {
    private dataSource: DataSource

    constructor() {
        const app = getRunningExpressApp()
        this.dataSource = app.AppDataSource
    }

    async getDashboardMetrics(): Promise<any> {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try { const rows = await this.dataSource.query(sql); return map(rows) } catch { return fallback }
        }

        // Conversations (last 30 days)
        const totalConversations = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event WHERE type='conversation' AND ts >= NOW() - INTERVAL '30 days'`,
            rs => parseInt(rs?.[0]?.c || '0'), 0
        )

        // Closed clients = distinct clientIds in sale_record
        const closedClients = await q<number>(
            `SELECT COUNT(DISTINCT "clientId") AS c FROM sale_record WHERE ts >= NOW() - INTERVAL '90 days'`,
            rs => parseInt(rs?.[0]?.c || '0'), 0
        )

        // Total revenue (last 90 days)
        const totalRevenue = await q<number>(
            `SELECT COALESCE(SUM("totalAmount"),0) AS s FROM sale_record WHERE ts >= NOW() - INTERVAL '90 days'`,
            rs => Number(rs?.[0]?.s || 0), 0
        )

        // Leads generated
        const leads = await q<number>(
            `SELECT COUNT(*) AS c FROM agent_event WHERE type='lead' AND ts >= NOW() - INTERVAL '90 days'`,
            rs => parseInt(rs?.[0]?.c || '0'), 0
        )

        // Avg response time (ms) from metadata.responseTime on conversation events
        const avgResponseTime = await q<number>(
            `SELECT AVG( (metadata::json->>'responseTime')::numeric ) AS a FROM agent_event WHERE type='conversation' AND (metadata IS NOT NULL)`,
            rs => parseFloat(rs?.[0]?.a || '0'), 0
        )

        // Inventory alerts (<20)
        const lowStock = await q<any[]>(
            `SELECT "productId", name, brand, stock FROM product_inventory WHERE stock < 20 ORDER BY stock ASC LIMIT 20`,
            rs => rs, []
        )

        // Most requested products from agent_event.productId
        const mostRequestedProducts = await q<{ name: string; requests: number }[]>(
            `SELECT "productId" AS id, COUNT(*) AS c FROM agent_event WHERE "productId" IS NOT NULL GROUP BY "productId" ORDER BY c DESC LIMIT 5`,
            rs => rs.map(r => ({ name: r.id, requests: parseInt(r.c || '0') })), []
        )

        // Sentiment analysis from metadata.sentiment
        const sentiment = await q<{ positive:number; negative:number; neutral:number }>(
            `SELECT 
               SUM(CASE WHEN LOWER(metadata::json->>'sentiment')='positive' THEN 1 ELSE 0 END) AS pos,
               SUM(CASE WHEN LOWER(metadata::json->>'sentiment')='negative' THEN 1 ELSE 0 END) AS neg,
               SUM(CASE WHEN LOWER(metadata::json->>'sentiment')='neutral' THEN 1 ELSE 0 END) AS neu
             FROM agent_event WHERE type='conversation'`,
            rs => ({ positive: parseInt(rs?.[0]?.pos || '0'), negative: parseInt(rs?.[0]?.neg || '0'), neutral: parseInt(rs?.[0]?.neu || '0') }),
            { positive:0, negative:0, neutral:0 }
        )

        // Sales data (last 30 days, grouped by day)
        const salesData = await q<{ date:string; sales:number; revenue:number }[]>(
            `SELECT DATE(ts) AS d, COUNT(*) AS s, SUM("totalAmount") AS r FROM sale_record WHERE ts >= NOW() - INTERVAL '30 days' GROUP BY DATE(ts) ORDER BY d DESC`,
            rs => rs.map(r => ({ date: r.d, sales: parseInt(r.s || '0'), revenue: parseFloat(r.r || '0') })), []
        )

        // Customer Satisfaction / Feedback Avg (0-10) from feedback events
        const feedbackAvg = await q<number>(
            `SELECT AVG( (metadata::json->>'score')::numeric ) AS a FROM agent_event WHERE type='feedback'`,
            rs => parseFloat(rs?.[0]?.a || '0'), 0
        )

        const conversionRate = totalConversations > 0 ? Math.round((closedClients / totalConversations) * 100) : 0

        return {
            totalConversations,
            activeAgents: 0, // not tracked yet; can be derived from distinct AgentEvent.agentId if needed
            closedClients,
            totalCallbacks: 0, // can be derived from follow_up events if we track them
            mostRequestedProducts,
            sentimentAnalysis: { positive: sentiment.positive, negative: sentiment.negative, neutral: sentiment.neutral },
            salesData,
            conversionRate,
            totalRevenue,
            inventoryAlerts: lowStock,
            feedbackAvg,
            lastUpdated: new Date().toISOString()
        }
    }

    async getCustomerStats(): Promise<any> {
        try {
            const result = await this.dataSource.query(
                `SELECT 
                    COUNT(*) as total_customers,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month
                 FROM customers`
            )
            return result[0] || { total_customers: 0, new_this_week: 0, new_this_month: 0 }
        } catch (error) {
            console.error('Error fetching customer stats:', error)
            throw new Error('Failed to fetch customer stats')
        }
    }

    async getSalesStats(): Promise<any> {
        try {
            const result = await this.dataSource.query(
                `SELECT 
                    COUNT(*) as total_sales,
                    SUM(COALESCE(amount, 0)) as total_revenue,
                    AVG(COALESCE(amount, 0)) as avg_sale_amount,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as sales_this_week
                 FROM sales`
            )
            return result[0] || { total_sales: 0, total_revenue: 0, avg_sale_amount: 0, sales_this_week: 0 }
        } catch (error) {
            console.error('Error fetching sales stats:', error)
            throw new Error('Failed to fetch sales stats')
        }
    }

    async getFunnel() {
        const q = async <T = any>(sql: string, map: (rows: any[]) => T, fallback: T): Promise<T> => {
            try { const rows = await this.dataSource.query(sql); return map(rows) } catch { return fallback }
        }
        const leads = await q<number>(`SELECT COUNT(*) AS c FROM agent_event WHERE type='lead'`, rs => parseInt(rs?.[0]?.c || '0'), 0)
        const qualified = await q<number>(`SELECT COUNT(*) AS c FROM agent_event WHERE type='qualified'`, rs => parseInt(rs?.[0]?.c || '0'), 0)
        const proposals = await q<number>(`SELECT COUNT(*) AS c FROM agent_event WHERE type='proposal'`, rs => parseInt(rs?.[0]?.c || '0'), 0)
        const closed = await q<number>(`SELECT COUNT(*) AS c FROM sale_record`, rs => parseInt(rs?.[0]?.c || '0'), 0)
        return { leads, qualified, proposals, closed }
    }

    async getRecentActivities(limit = 20) {
        // Pull recent from both agent_event and sale_record
        const ev = await this.dataSource.query(
            `SELECT id, ts, type, "clientId", "clientName", amount, message FROM agent_event ORDER BY ts DESC LIMIT $1`,
            [limit]
        )
        const sales = await this.dataSource.query(
            `SELECT id, ts, 'sale' as type, "clientId", "clientName", "totalAmount" as amount, NULL as message FROM sale_record ORDER BY ts DESC LIMIT $1`,
            [limit]
        )
        const merged = [...ev, ...sales]
            .sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
            .slice(0, limit)
        return merged
    }

    async getTopAgents(limit = 5) {
        const rows = await this.dataSource.query(
            `SELECT COALESCE("agentId", 'unknown') AS id,
                    COUNT(*) AS closedDeals,
                    COALESCE(SUM("totalAmount"),0) AS revenue
             FROM sale_record
             GROUP BY COALESCE("agentId", 'unknown')
             ORDER BY revenue DESC
             LIMIT $1`,
            [limit]
        )
        // Add conversations per agent if needed
        const conv = await this.dataSource.query(
            `SELECT COALESCE("agentId", 'unknown') AS id, COUNT(*) AS conversations
             FROM agent_event
             WHERE type='conversation'
             GROUP BY COALESCE("agentId", 'unknown')`
        )
        const convMap = new Map(conv.map((r:any)=>[r.id, parseInt(r.conversations||'0')]))
        return rows.map((r:any)=>({
            id: r.id,
            conversations: convMap.get(r.id)||0,
            closedDeals: parseInt(r.closedDeals||'0'),
            revenue: parseFloat(r.revenue||'0')
        }))
    }
}

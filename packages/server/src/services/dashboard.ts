import { getRunningExpressApp } from '../utils'
import { DataSource } from 'typeorm'

export class DashboardService {
    private dataSource: DataSource

    constructor() {
        const app = getRunningExpressApp()
        this.dataSource = app.AppDataSource
    }

    async getDashboardMetrics(): Promise<any> {
        // Helper to run optional queries safely
        const safeQuery = async <T = any>(sql: string, fallback: T, map?: (rows: any[]) => T): Promise<T> => {
            try {
                const rows = await this.dataSource.query(sql)
                return map ? map(rows) : ((rows as unknown) as T)
            } catch (_err) {
                return fallback
            }
        }

        // totals
        const totalConversations = await safeQuery<number>(
            'SELECT COUNT(*) as count FROM customers',
            0,
            (rows) => parseInt(rows?.[0]?.count || '0')
        )

        const activeAgents = await safeQuery<number>(
            `SELECT COUNT(DISTINCT agent_id) as count 
             FROM sales 
             WHERE created_at >= NOW() - INTERVAL '30 days'`,
            0,
            (rows) => parseInt(rows?.[0]?.count || '0')
        )

        const closedClients = await safeQuery<number>(
            `SELECT COUNT(DISTINCT c.id) as count 
             FROM customers c 
             INNER JOIN sales s ON c.id = s.customer_id`,
            0,
            (rows) => parseInt(rows?.[0]?.count || '0')
        )

        const totalCallbacks = await safeQuery<number>(
            'SELECT COUNT(*) as count FROM follow_ups',
            0,
            (rows) => parseInt(rows?.[0]?.count || '0')
        )

        const mostRequestedProducts = await safeQuery<{ name: string; requests: number }[]>(
            `SELECT product_name, COUNT(*) as count 
             FROM sales 
             WHERE product_name IS NOT NULL 
             GROUP BY product_name 
             ORDER BY count DESC 
             LIMIT 5`,
            [],
            (rows) => rows.map((r: any) => ({ name: r.product_name, requests: parseInt(r.count || '0') }))
        )

        const sentimentAnalysis = await safeQuery<{ positive: number; negative: number; neutral: number }>(
            `SELECT 
                COUNT(CASE WHEN LOWER(notes) LIKE '%positive%' OR LOWER(notes) LIKE '%good%' OR LOWER(notes) LIKE '%excellent%' THEN 1 END) as positive,
                COUNT(CASE WHEN LOWER(notes) LIKE '%negative%' OR LOWER(notes) LIKE '%bad%' OR LOWER(notes) LIKE '%poor%' THEN 1 END) as negative,
                COUNT(*) as total
             FROM follow_ups 
             WHERE notes IS NOT NULL`,
            { positive: 0, negative: 0, neutral: 0 },
            (rows) => {
                const s = rows?.[0] || { positive: 0, negative: 0, total: 0 }
                const pos = parseInt(s.positive || '0')
                const neg = parseInt(s.negative || '0')
                const total = parseInt(s.total || '0')
                const neu = Math.max(0, total - pos - neg)
                return { positive: pos, negative: neg, neutral: neu }
            }
        )

        const salesData = await safeQuery<{ date: string; sales: number; revenue: number }[]>(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as sales,
                SUM(COALESCE(amount, 0)) as revenue
             FROM sales 
             WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC
             LIMIT 30`,
            [],
            (rows) => rows.map((r: any) => ({ date: r.date, sales: parseInt(r.sales || '0'), revenue: parseFloat(r.revenue || '0') }))
        )

        const conversionRate = totalConversations > 0 ? Math.round((closedClients / totalConversations) * 100) : 0

        return {
            totalConversations,
            activeAgents,
            closedClients,
            totalCallbacks,
            mostRequestedProducts,
            sentimentAnalysis,
            salesData,
            conversionRate,
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
}

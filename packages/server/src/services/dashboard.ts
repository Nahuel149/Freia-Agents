import { getRunningExpressApp } from '../utils'
import { DataSource } from 'typeorm'

export class DashboardService {
    private dataSource: DataSource

    constructor() {
        const app = getRunningExpressApp()
        this.dataSource = app.AppDataSource
    }

    async getDashboardMetrics(): Promise<any> {
        try {
            // Get total conversations (customers)
            const totalConversationsResult = await this.dataSource.query(
                'SELECT COUNT(*) as count FROM customers'
            )
            const totalConversations = parseInt(totalConversationsResult[0]?.count || '0')

            // Get active agents (unique agent_id from recent sales)
            const activeAgentsResult = await this.dataSource.query(
                `SELECT COUNT(DISTINCT agent_id) as count 
                 FROM sales 
                 WHERE created_at >= NOW() - INTERVAL '30 days'`
            )
            const activeAgents = parseInt(activeAgentsResult[0]?.count || '0')

            // Get closed clients (customers with sales)
            const closedClientsResult = await this.dataSource.query(
                `SELECT COUNT(DISTINCT c.id) as count 
                 FROM customers c 
                 INNER JOIN sales s ON c.id = s.customer_id`
            )
            const closedClients = parseInt(closedClientsResult[0]?.count || '0')

            // Get total callbacks (follow_ups)
            const totalCallbacksResult = await this.dataSource.query(
                'SELECT COUNT(*) as count FROM follow_ups'
            )
            const totalCallbacks = parseInt(totalCallbacksResult[0]?.count || '0')

            // Get most requested products
            const mostRequestedProductsResult = await this.dataSource.query(
                `SELECT product_name, COUNT(*) as count 
                 FROM sales 
                 WHERE product_name IS NOT NULL 
                 GROUP BY product_name 
                 ORDER BY count DESC 
                 LIMIT 5`
            )
            const mostRequestedProducts = mostRequestedProductsResult.map((row: any) => ({
                name: row.product_name,
                requests: parseInt(row.count)
            }))

            // Get sentiment analysis from follow_ups notes
            const sentimentResult = await this.dataSource.query(
                `SELECT 
                    COUNT(CASE WHEN LOWER(notes) LIKE '%positive%' OR LOWER(notes) LIKE '%good%' OR LOWER(notes) LIKE '%excellent%' THEN 1 END) as positive,
                    COUNT(CASE WHEN LOWER(notes) LIKE '%negative%' OR LOWER(notes) LIKE '%bad%' OR LOWER(notes) LIKE '%poor%' THEN 1 END) as negative,
                    COUNT(*) as total
                 FROM follow_ups 
                 WHERE notes IS NOT NULL`
            )
            const sentimentData = sentimentResult[0] || { positive: 0, negative: 0, total: 0 }
            const neutral = sentimentData.total - sentimentData.positive - sentimentData.negative
            
            const sentimentAnalysis = {
                positive: parseInt(sentimentData.positive),
                negative: parseInt(sentimentData.negative),
                neutral: Math.max(0, neutral)
            }

            // Get recent sales data for chart
            const recentSalesResult = await this.dataSource.query(
                `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as sales,
                    SUM(COALESCE(amount, 0)) as revenue
                 FROM sales 
                 WHERE created_at >= NOW() - INTERVAL '30 days'
                 GROUP BY DATE(created_at)
                 ORDER BY date DESC
                 LIMIT 30`
            )
            const salesData = recentSalesResult.map((row: any) => ({
                date: row.date,
                sales: parseInt(row.sales),
                revenue: parseFloat(row.revenue || '0')
            }))

            // Get conversion rate
            const conversionRate = totalConversations > 0 
                ? Math.round((closedClients / totalConversations) * 100) 
                : 0

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
        } catch (error) {
            console.error('Error fetching dashboard metrics:', error)
            throw new Error('Failed to fetch dashboard metrics')
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
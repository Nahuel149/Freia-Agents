import { getRunningExpressApp } from '../utils'
import {
    DataSource,
    Repository,
    LessThan,
    MoreThanOrEqual,
    In
} from 'typeorm'
import { AgentEvent } from '../database/entities/AgentEvent'
import { SaleRecord } from '../database/entities/SaleRecord'
import { ProductInventory } from '../database/entities/ProductInventory'
import { ClientAccount } from '../database/entities/ClientAccount'

type SentimentBuckets = { positive: number; neutral: number; negative: number }

export class DashboardService {
    private dataSource: DataSource
    private agentEventRepo: Repository<AgentEvent>
    private saleRecordRepo: Repository<SaleRecord>
    private inventoryRepo: Repository<ProductInventory>
    private clientAccountRepo: Repository<ClientAccount>

    constructor() {
        const app = getRunningExpressApp()
        this.dataSource = app.AppDataSource
        this.agentEventRepo = this.dataSource.getRepository(AgentEvent)
        this.saleRecordRepo = this.dataSource.getRepository(SaleRecord)
        this.inventoryRepo = this.dataSource.getRepository(ProductInventory)
        this.clientAccountRepo = this.dataSource.getRepository(ClientAccount)
    }

    private daysAgo(days: number): Date {
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    private parseMetadata(metadata?: string | null): Record<string, any> | null {
        if (!metadata) return null
        try {
            return JSON.parse(metadata)
        } catch {
            return null
        }
    }

    private collectAverage(values: number[]): number {
        if (!values.length) return 0
        const sum = values.reduce((acc, val) => acc + val, 0)
        return Math.round((sum / values.length) * 100) / 100
    }

    private normaliseNumber(value: unknown): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) return value
        if (typeof value === 'string') {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) return parsed
        }
        return null
    }

    async getDashboardMetrics(): Promise<any> {
        const last30Days = this.daysAgo(30)
        const last90Days = this.daysAgo(90)

        const [
            totalConversations,
            closedClientsRow,
            totalRevenueRow,
            followUps,
            leadsGenerated,
            activeAgentsRow,
            recentSales,
            mostRequestedRaw,
            responseMetadataRows,
            sentimentMetadataRows,
            feedbackMetadataRows,
            lowStock
        ] = await Promise.all([
            this.agentEventRepo
                .createQueryBuilder('event')
                .where('event.type = :type', { type: 'conversation' })
                .andWhere('event.ts >= :start', { start: last30Days })
                .getCount(),
            this.saleRecordRepo
                .createQueryBuilder('sale')
                .select('COUNT(DISTINCT sale.clientId)', 'count')
                .where('sale.ts >= :start', { start: last90Days })
                .getRawOne<{ count: string | null }>(),
            this.saleRecordRepo
                .createQueryBuilder('sale')
                .select('COALESCE(SUM(sale.totalAmount), 0)', 'sum')
                .where('sale.ts >= :start', { start: last90Days })
                .getRawOne<{ sum: string | null }>(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .where('event.type = :type', { type: 'follow_up' })
                .andWhere('event.ts >= :start', { start: last90Days })
                .getCount(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .where('event.type = :type', { type: 'lead' })
                .andWhere('event.ts >= :start', { start: last90Days })
                .getCount(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('COUNT(DISTINCT event.agentId)', 'count')
                .where('event.agentId IS NOT NULL')
                .andWhere('event.type = :type', { type: 'conversation' })
                .andWhere('event.ts >= :start', { start: last30Days })
                .getRawOne<{ count: string | null }>(),
            this.saleRecordRepo.find({
                where: { ts: MoreThanOrEqual(last30Days) },
                order: { ts: 'DESC' }
            }),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('event.productId', 'productId')
                .addSelect('COUNT(*)', 'requests')
                .where('event.productId IS NOT NULL')
                .groupBy('event.productId')
                .orderBy('requests', 'DESC')
                .limit(5)
                .getRawMany<{ productId: string; requests: string }>(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('event.metadata', 'metadata')
                .where('event.type = :type', { type: 'conversation' })
                .andWhere('event.metadata IS NOT NULL')
                .andWhere('event.ts >= :start', { start: last30Days })
                .getRawMany<{ metadata: string }>(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('event.metadata', 'metadata')
                .where('event.type = :type', { type: 'conversation' })
                .andWhere('event.metadata IS NOT NULL')
                .andWhere('event.ts >= :start', { start: last90Days })
                .getRawMany<{ metadata: string }>(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('event.metadata', 'metadata')
                .where('event.type = :type', { type: 'feedback' })
                .andWhere('event.metadata IS NOT NULL')
                .getRawMany<{ metadata: string }>(),
            this.inventoryRepo.find({
                where: { stock: LessThan(20) },
                order: { stock: 'ASC', updatedDate: 'DESC' },
                take: 20
            })
        ])

        const closedClients = Number(closedClientsRow?.count || 0)
        const totalRevenue = Number(totalRevenueRow?.sum || 0)
        const activeAgents = Number(activeAgentsRow?.count || 0)

        const responseTimes = responseMetadataRows
            .map(row => this.parseMetadata(row.metadata)?.responseTime)
            .map(value => this.normaliseNumber(value))
            .filter((value): value is number => value !== null)
        const avgResponseTime = this.collectAverage(responseTimes)

        const sentiment = sentimentMetadataRows.reduce<SentimentBuckets>((acc, row) => {
            const sentimentValue = (this.parseMetadata(row.metadata)?.sentiment || '').toString().toLowerCase()
            if (sentimentValue === 'positive') acc.positive += 1
            else if (sentimentValue === 'negative') acc.negative += 1
            else if (sentimentValue === 'neutral') acc.neutral += 1
            return acc
        }, { positive: 0, neutral: 0, negative: 0 })

        const feedbackScores = feedbackMetadataRows
            .map(row => this.parseMetadata(row.metadata)?.score)
            .map(value => this.normaliseNumber(value))
            .filter((value): value is number => value !== null)
        const feedbackAvg = this.collectAverage(feedbackScores)

        const productIds = mostRequestedRaw
            .map(row => row.productId)
            .filter((id): id is string => Boolean(id))
        const inventoryDetails = productIds.length
            ? await this.inventoryRepo.find({ where: { productId: In(productIds) } })
            : []
        const inventoryMap = new Map(inventoryDetails.map(item => [item.productId, item]))

        const mostRequestedProducts = mostRequestedRaw.map(row => {
            const product = inventoryMap.get(row.productId)
            return {
                productId: row.productId,
                name: product?.name || row.productId,
                brand: product?.brand || null,
                stock: product?.stock ?? null,
                requests: Number(row.requests || 0)
            }
        })

        const salesByDate = new Map<string, { sales: number; revenue: number }>()
        recentSales.forEach(record => {
            const dateKey = record.ts.toISOString().slice(0, 10)
            const existing = salesByDate.get(dateKey) || { sales: 0, revenue: 0 }
            existing.sales += 1
            const amount = this.normaliseNumber(record.totalAmount)
            if (amount !== null) existing.revenue += amount
            salesByDate.set(dateKey, existing)
        })

        const salesData = Array.from(salesByDate.entries())
            .map(([date, stats]) => ({
                date,
                sales: stats.sales,
                revenue: Math.round(stats.revenue * 100) / 100
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const conversionRate = totalConversations > 0 ? Math.round((closedClients / totalConversations) * 100) : 0

        return {
            totalConversations,
            activeAgents,
            closedClients,
            totalCallbacks: followUps,
            leadsGenerated,
            avgResponseTime,
            mostRequestedProducts,
            sentimentAnalysis: sentiment,
            salesData,
            conversionRate,
            totalRevenue,
            inventoryAlerts: lowStock.map(item => ({
                productId: item.productId,
                name: item.name,
                brand: item.brand,
                stock: item.stock,
                price: item.price,
                updatedDate: item.updatedDate
            })),
            feedbackAvg,
            customerSatisfaction: feedbackAvg,
            lastUpdated: new Date().toISOString()
        }
    }

    async getCustomerStats(): Promise<any> {
        const now = new Date()
        const sevenDaysAgo = this.daysAgo(7)
        const thirtyDaysAgo = this.daysAgo(30)

        try {
            const [totalCustomers, newThisWeek, newThisMonth] = await Promise.all([
                this.clientAccountRepo.count(),
                this.clientAccountRepo.count({ where: { updatedDate: MoreThanOrEqual(sevenDaysAgo) } }),
                this.clientAccountRepo.count({ where: { updatedDate: MoreThanOrEqual(thirtyDaysAgo) } })
            ])

            return {
                total_customers: totalCustomers,
                new_this_week: newThisWeek,
                new_this_month: newThisMonth,
                last_updated: now.toISOString()
            }
        } catch (error) {
            console.error('Error fetching customer stats:', error)
            throw new Error('Failed to fetch customer stats')
        }
    }

    async getSalesStats(): Promise<any> {
        const now = new Date()
        const sevenDaysAgo = this.daysAgo(7)

        try {
            const [totalSales, totalRevenueRow, salesThisWeek] = await Promise.all([
                this.saleRecordRepo.count(),
                this.saleRecordRepo
                    .createQueryBuilder('sale')
                    .select('COALESCE(SUM(sale.totalAmount), 0)', 'sum')
                    .getRawOne<{ sum: string | null }>(),
                this.saleRecordRepo
                    .createQueryBuilder('sale')
                    .where('sale.ts >= :start', { start: sevenDaysAgo })
                    .getCount()
            ])

            const totalRevenue = Number(totalRevenueRow?.sum || 0)
            const avgSaleAmount = totalSales > 0 ? totalRevenue / totalSales : 0

            return {
                total_sales: totalSales,
                total_revenue: totalRevenue,
                avg_sale_amount: Math.round(avgSaleAmount * 100) / 100,
                sales_this_week: salesThisWeek,
                last_updated: now.toISOString()
            }
        } catch (error) {
            console.error('Error fetching sales stats:', error)
            throw new Error('Failed to fetch sales stats')
        }
    }

    async getFunnel() {
        const [leads, qualified, proposals, closed] = await Promise.all([
            this.agentEventRepo.count({ where: { type: 'lead' } }),
            this.agentEventRepo.count({ where: { type: 'qualified' } }),
            this.agentEventRepo.count({ where: { type: 'proposal' } }),
            this.saleRecordRepo.count()
        ])
        return { leads, qualified, proposals, closed }
    }

    async getRecentActivities(limit = 20) {
        const [events, sales] = await Promise.all([
            this.agentEventRepo
                .createQueryBuilder('event')
                .orderBy('event.ts', 'DESC')
                .take(limit)
                .getMany(),
            this.saleRecordRepo
                .createQueryBuilder('sale')
                .orderBy('sale.ts', 'DESC')
                .take(limit)
                .getMany()
        ])

        const eventActivities = events.map(event => ({
            id: event.id,
            ts: event.ts,
            type: event.type,
            agentId: event.agentId,
            clientId: event.clientId,
            clientName: event.clientName,
            amount: event.amount,
            message: event.message
        }))

        const saleActivities = sales.map(sale => ({
            id: sale.id,
            ts: sale.ts,
            type: 'sale',
            agentId: sale.agentId,
            clientId: sale.clientId,
            clientName: sale.clientName,
            amount: sale.totalAmount,
            message: null
        }))

        return [...eventActivities, ...saleActivities]
            .sort((a, b) => b.ts.getTime() - a.ts.getTime())
            .slice(0, limit)
    }

    async getTopAgents(limit = 5) {
        const [salesByAgent, conversationsByAgent] = await Promise.all([
            this.saleRecordRepo
                .createQueryBuilder('sale')
                .select('sale.agentId', 'agentId')
                .addSelect('COUNT(*)', 'closedDeals')
                .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'revenue')
                .groupBy('sale.agentId')
                .orderBy('COALESCE(SUM(sale.totalAmount), 0)', 'DESC')
                .limit(limit)
                .getRawMany<{ agentId: string | null; closedDeals: string; revenue: string | null }>(),
            this.agentEventRepo
                .createQueryBuilder('event')
                .select('event.agentId', 'agentId')
                .addSelect('COUNT(*)', 'conversations')
                .where('event.type = :type', { type: 'conversation' })
                .groupBy('event.agentId')
                .getRawMany<{ agentId: string | null; conversations: string }>()
        ])

        const conversationsMap = new Map(
            conversationsByAgent.map(item => [item.agentId || 'unknown', Number(item.conversations || 0)])
        )

        return salesByAgent.map(item => {
            const id = item.agentId || 'unknown'
            return {
                id,
                conversations: conversationsMap.get(id) || 0,
                closedDeals: Number(item.closedDeals || 0),
                revenue: Number(item.revenue || 0)
            }
        })
    }
}

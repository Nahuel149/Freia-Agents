import { DataSource } from 'typeorm'
import { AgentEvent } from '../../database/entities/AgentEvent'
import { SaleRecord } from '../../database/entities/SaleRecord'
import { ProductInventory } from '../../database/entities/ProductInventory'
import { ClientAccount } from '../../database/entities/ClientAccount'

export class CodeAgentAnalyticsService {
    constructor(private ds: DataSource) {}

    async ingestEvents(body: any) {
        const events = Array.isArray(body?.events) ? body.events : []
        const agentId: string | undefined = body?.agentId || undefined
        const eventRepo = this.ds.getRepository(AgentEvent)
        const saleRepo = this.ds.getRepository(SaleRecord)

        for (const e of events) {
            const ev = new AgentEvent()
            ev.type = String(e.type || 'conversation')
            ev.agentId = e.agentId || agentId || undefined
            ev.clientId = e.clientId || undefined
            ev.clientName = e.clientName || undefined
            ev.message = e.message || e.notes || undefined
            ev.productId = e.productId || undefined
            ev.qty = typeof e.qty === 'number' ? e.qty : undefined
            ev.amount = typeof e.amount === 'number' ? e.amount : undefined
            ev.metadata = e.metadata ? (typeof e.metadata === 'string' ? e.metadata : JSON.stringify(e.metadata)) : undefined
            await eventRepo.save(ev)

            if (ev.type === 'sale') {
                const s = new SaleRecord()
                s.agentId = ev.agentId || undefined
                s.clientId = ev.clientId || undefined
                s.clientName = ev.clientName || undefined
                s.totalAmount = Number(e.totalAmount || ev.amount || 0)
                s.items = e.items ? (typeof e.items === 'string' ? e.items : JSON.stringify(e.items)) : undefined
                await saleRepo.save(s)
            }
        }
        return { ingested: events.length }
    }

    async ingestDatasets(body: any) {
        const products = body?.products || []
        const clients = body?.clients || []
        const prodRepo = this.ds.getRepository(ProductInventory)
        const cliRepo = this.ds.getRepository(ClientAccount)

        for (const p of products) {
            const id = p.id || p.product_id || p.code
            if (!id) continue
            const rec = new ProductInventory()
            rec.productId = String(id)
            rec.name = p.name || p.nombre || undefined
            rec.brand = p.brand || p.marca || undefined
            rec.stock = typeof p.stock === 'number' ? p.stock : 0
            if (p.price || p.precio) rec.price = Number(p.price || p.precio)
            await prodRepo.save(rec)
        }
        for (const c of clients) {
            const id = c.id || c.email || c.name
            if (!id) continue
            const rec = new ClientAccount()
            rec.clientId = String(id)
            rec.name = c.name || c.contact || undefined
            rec.company = c.company || c.empresa || undefined
            rec.email = c.email || undefined
            await cliRepo.save(rec)
        }
        return { products: products.length, clients: clients.length }
    }
}

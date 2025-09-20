import { DataSource } from 'typeorm'
import { AgentEvent } from '../../database/entities/AgentEvent'
import { SaleRecord } from '../../database/entities/SaleRecord'
import { Product } from '../../database/entities/Product'
import { ProductCategory } from '../../database/entities/ProductCategory'
import { ProductBrand } from '../../database/entities/ProductBrand'
import { ClientAccount } from '../../database/entities/ClientAccount'

export class CodeAgentAnalyticsService {
    constructor(private ds: DataSource, private workspaceId?: string) {}

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
        if (!this.workspaceId) {
            throw new Error('Workspace ID is required for dataset ingestion')
        }

        const products = body?.products || []
        const clients = body?.clients || []
        const productRepo = this.ds.getRepository(Product)
        const categoryRepo = this.ds.getRepository(ProductCategory)
        const brandRepo = this.ds.getRepository(ProductBrand)
        const clientRepo = this.ds.getRepository(ClientAccount)

        let productsProcessed = 0
        let clientsProcessed = 0

        // Process products with multi-tenant support
        for (const p of products) {
            try {
                const productId = p.ID || p.id || p.product_id || p.code
                if (!productId) continue

                // Handle category
                let categoryId = null
                if (p.Categoria || p.categoria || p.category) {
                    const categoryName = p.Categoria || p.categoria || p.category
                    let category = await categoryRepo.findOne({
                        where: { name: categoryName, workspaceId: this.workspaceId }
                    })
                    
                    if (!category) {
                        category = categoryRepo.create({
                            name: categoryName,
                            workspaceId: this.workspaceId
                        })
                        await categoryRepo.save(category)
                    }
                    categoryId = category.id
                }

                // Handle brand
                let brandId = null
                if (p.Marca || p.marca || p.brand) {
                    const brandName = p.Marca || p.marca || p.brand
                    let brand = await brandRepo.findOne({
                        where: { name: brandName, workspaceId: this.workspaceId }
                    })
                    
                    if (!brand) {
                        brand = brandRepo.create({
                            name: brandName,
                            workspaceId: this.workspaceId
                        })
                        await brandRepo.save(brand)
                    }
                    brandId = brand.id
                }

                // Create or update product
                let product = await productRepo.findOne({
                    where: { productId: String(productId), workspaceId: this.workspaceId }
                })

                const productData = {
                    productId: String(productId),
                    workspaceId: this.workspaceId,
                    categoryId: categoryId || undefined,
                    brandId: brandId || undefined,
                    nombre: p.Nombre || p.nombre || p.name || '',
                    precio: Number(p.Precio || p.precio || p.price || 0),
                    stock: Number(p.Stock || p.stock || 0),
                    descripcion: p.Descripcion || p.descripcion || p.description || null,
                    especificaciones: p.Especificaciones || p.especificaciones || p.specifications || null,
                    sku: p.SKU || p.sku || null,
                    costo: Number(p.Costo || p.costo || p.cost || 0),
                    stockMinimo: Number(p.StockMinimo || p.stock_minimo || p.minimum_stock || 0)
                }

                if (!product) {
                    product = productRepo.create(productData)
                } else {
                    Object.assign(product, productData)
                }

                await productRepo.save(product)
                productsProcessed++
            } catch (error) {
                console.error(`Error processing product ${p.ID || p.id}:`, error)
            }
        }

        // Process clients
        for (const c of clients) {
            try {
                const clientId = c.id || c.email || c.name
                if (!clientId) continue
                
                const rec = new ClientAccount()
                rec.clientId = String(clientId)
                rec.name = c.name || c.contact || undefined
                rec.company = c.company || c.empresa || undefined
                rec.email = c.email || undefined
                await clientRepo.save(rec)
                clientsProcessed++
            } catch (error) {
                console.error(`Error processing client ${c.id}:`, error)
            }
        }

        return { products: productsProcessed, clients: clientsProcessed }
    }
}

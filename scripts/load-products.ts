import { DataSource } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { Product } from '../packages/server/src/database/entities/Product'
import { ProductCategory } from '../packages/server/src/database/entities/ProductCategory'
import { ProductBrand } from '../packages/server/src/database/entities/ProductBrand'
import { Workspace } from '../packages/server/src/oss/database/entities/workspace.entity'

// Load environment variables
dotenv.config()

interface ProductData {
    ID: string
    Categoria: string
    Marca: string
    Nombre: string
    Precio: number
    Stock: number
    Descripcion: string
    Especificaciones: any
    SKU?: string
    Costo?: number
    StockMinimo?: number
}

interface DataFile {
    productos: ProductData[]
}

class ProductLoader {
    private dataSource: DataSource
    private workspaceId: string

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId
        this.dataSource = new DataSource({
            type: 'postgres',
            host: process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432'),
            username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
            password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
            database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'flowise',
            entities: [Product, ProductCategory, ProductBrand, Workspace],
            synchronize: false,
            logging: true,
            ssl: {
                rejectUnauthorized: false
            }
        })
    }

    async initialize(): Promise<void> {
        await this.dataSource.initialize()
        console.log('✅ Database connection established')
    }

    async validateWorkspace(): Promise<boolean> {
        const workspaceRepo = this.dataSource.getRepository(Workspace)
        let workspace = await workspaceRepo.findOne({ where: { id: this.workspaceId } })
        
        if (!workspace) {
            console.log(`⚠️ Workspace with ID ${this.workspaceId} not found, creating it...`)
            
            // Use an existing organization ID from the database
            workspace = workspaceRepo.create({
                id: this.workspaceId,
                name: `Test Workspace ${this.workspaceId.substring(0, 8)}`,
                description: 'Workspace created by product loader script',
                organizationId: 'e29fdbd4-0171-4769-90f1-e5509a59ca42' // Using existing organization ID
            })
            
            await workspaceRepo.save(workspace)
            console.log(`✅ Workspace created: ${workspace.name}`)
        } else {
            console.log(`✅ Workspace found: ${workspace.name}`)
        }
        
        return true
    }

    async loadCategories(productos: ProductData[]): Promise<Map<string, string>> {
        const categoryRepo = this.dataSource.getRepository(ProductCategory)
        const categoryMap = new Map<string, string>()
        
        // Get unique categories
        const uniqueCategories = [...new Set(productos.map(p => p.Categoria).filter(Boolean))]
        
        console.log(`📂 Loading ${uniqueCategories.length} categories...`)
        
        for (const categoryName of uniqueCategories) {
            let category = await categoryRepo.findOne({
                where: { name: categoryName, workspaceId: this.workspaceId }
            })
            
            if (!category) {
                category = categoryRepo.create({
                    name: categoryName,
                    workspaceId: this.workspaceId,
                    description: `Categoría: ${categoryName}`
                })
                await categoryRepo.save(category)
                console.log(`  ✅ Created category: ${categoryName}`)
            } else {
                console.log(`  ⏭️  Category exists: ${categoryName}`)
            }
            
            categoryMap.set(categoryName, category.id)
        }
        
        return categoryMap
    }

    async loadBrands(productos: ProductData[]): Promise<Map<string, string>> {
        const brandRepo = this.dataSource.getRepository(ProductBrand)
        const brandMap = new Map<string, string>()
        
        // Get unique brands
        const uniqueBrands = [...new Set(productos.map(p => p.Marca).filter(Boolean))]
        
        console.log(`🏷️  Loading ${uniqueBrands.length} brands...`)
        
        for (const brandName of uniqueBrands) {
            let brand = await brandRepo.findOne({
                where: { name: brandName, workspaceId: this.workspaceId }
            })
            
            if (!brand) {
                brand = brandRepo.create({
                    name: brandName,
                    workspaceId: this.workspaceId,
                    description: `Marca: ${brandName}`
                })
                await brandRepo.save(brand)
                console.log(`  ✅ Created brand: ${brandName}`)
            } else {
                console.log(`  ⏭️  Brand exists: ${brandName}`)
            }
            
            brandMap.set(brandName, brand.id)
        }
        
        return brandMap
    }

    async loadProducts(productos: ProductData[]): Promise<void> {
        const productRepo = this.dataSource.getRepository(Product)
        const categoryRepo = this.dataSource.getRepository(ProductCategory)
        const brandRepo = this.dataSource.getRepository(ProductBrand)
        
        console.log(`📦 Loading ${productos.length} products...`)
        
        let created = 0
        let updated = 0
        let errors = 0
        
        for (const productData of productos) {
            try {
                let product = await productRepo.findOne({
                    where: { productId: productData.ID, workspaceId: this.workspaceId }
                })
                
                // Get category ID
                let categoryId = null
                if (productData.Categoria) {
                    const category = await categoryRepo.findOne({
                        where: { name: productData.Categoria, workspaceId: this.workspaceId }
                    })
                    categoryId = category?.id || null
                }
                
                // Get brand ID
                let brandId = null
                if (productData.Marca) {
                    const brand = await brandRepo.findOne({
                        where: { name: productData.Marca, workspaceId: this.workspaceId }
                    })
                    brandId = brand?.id || null
                }
                
                const productInfo = {
                    productId: productData.ID,
                    workspaceId: this.workspaceId,
                    categoryId: categoryId || undefined,
                    brandId: brandId || undefined,
                    nombre: productData.Nombre,
                    precio: Number(productData.Precio),
                    stock: Number(productData.Stock),
                    descripcion: productData.Descripcion,
                    especificaciones: productData.Especificaciones,
                    sku: productData.SKU || undefined,
                    costo: Number(productData.Costo || 0),
                    stockMinimo: Number(productData.StockMinimo || 0)
                }
                
                if (!product) {
                    product = productRepo.create(productInfo)
                    await productRepo.save(product)
                    created++
                    console.log(`  ✅ Created: ${productData.Nombre} (${productData.ID})`)
                } else {
                    // Update existing product
                    Object.assign(product, productInfo)
                    await productRepo.save(product)
                    updated++
                    console.log(`  🔄 Updated: ${productData.Nombre} (${productData.ID})`)
                }
            } catch (error: any) {
                errors++
                console.error(`  ❌ Error processing product ${productData.ID}: ${error.message}`)
            }
        }
        
        console.log(`\n📊 Product loading summary:`)
        console.log(`  ✅ Created: ${created}`)
        console.log(`  🔄 Updated: ${updated}`)
        console.log(`  ❌ Errors: ${errors}`)
        console.log(`  📦 Total processed: ${productos.length}`)
    }

    async loadData(): Promise<void> {
        try {
            // Read the JSON file
            const dataPath = path.join(__dirname, '../docs/DATAFINALV1.0.json')
            
            if (!fs.existsSync(dataPath)) {
                throw new Error(`Data file not found: ${dataPath}`)
            }
            
            console.log(`📖 Reading data from: ${dataPath}`)
            const rawData = fs.readFileSync(dataPath, 'utf8')
            const data: DataFile = JSON.parse(rawData)
            
            if (!data.productos || !Array.isArray(data.productos)) {
                throw new Error('Invalid data format: productos array not found')
            }
            
            console.log(`📊 Found ${data.productos.length} products in data file`)
            
            // Validate workspace exists
            const isValidWorkspace = await this.validateWorkspace()
            if (!isValidWorkspace) {
                throw new Error('Invalid workspace')
            }
            
            // Load categories and brands first
            await this.loadCategories(data.productos)
            await this.loadBrands(data.productos)
            
            // Load products
            await this.loadProducts(data.productos)
            
            console.log('\n🎉 Product loading completed successfully!')
            
        } catch (error: any) {
            console.error('❌ Error loading products:', error.message)
            throw error
        }
    }

    async close(): Promise<void> {
        await this.dataSource.destroy()
        console.log('🔌 Database connection closed')
    }
}

// Main execution
async function main() {
    const workspaceId = process.argv[2]
    
    if (!workspaceId) {
        console.error('❌ Usage: npm run load-products <workspaceId>')
        console.error('   Example: npm run load-products 123e4567-e89b-12d3-a456-426614174000')
        process.exit(1)
    }
    
    console.log('🚀 Starting product loading process...')
    console.log(`🏢 Target workspace: ${workspaceId}`)
    
    const loader = new ProductLoader(workspaceId)
    
    try {
        await loader.initialize()
        await loader.loadData()
    } catch (error: any) {
        console.error('💥 Fatal error:', error.message)
        process.exit(1)
    } finally {
        await loader.close()
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error)
}

export { ProductLoader }
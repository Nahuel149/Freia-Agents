import path from 'path'
import fs from 'fs'
import { init as initDataSource, getDataSource } from '../DataSource'
import logger from '../utils/logger'

interface SeedData {
    product_inventory: any[]
    customers: any[]
    sales: any[]
    sale_record: any[]
}

async function insertBatch(table: string, rows: any[]) {
    if (!rows.length) return

    const ds = getDataSource()

    // Using query builder for efficient bulk insert
    await ds
        .createQueryBuilder()
        .insert()
        .into(table)
        .values(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined))))
        .orIgnore()
        .execute()
}

async function insertSales(rows: any[]) {
    if (!rows.length) return
    const ds = getDataSource()

    const columns = [
        'id',
        'created_at',
        'updated_at',
        'customer_id',
        'phone_number',
        'product_sku',
        'product_brand',
        'product_model',
        'wheel_size',
        'quantity',
        'unit_price',
        'total_price',
        'discount_percentage',
        'final_price',
        'payment_method',
        'delivery_method',
        'delivery_address',
        'sale_status',
        'negotiation_attempts',
        'agent_notes'
    ]

    // Build parameterized query
    const valuePlaceholders: string[] = []
    const values: any[] = []
    let paramIndex = 1

    rows.forEach((row) => {
        const filteredRow = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined))
        const placeholders: string[] = []
        columns.forEach((col) => {
            placeholders.push(`$${paramIndex++}`)
            values.push((filteredRow as any)[col] ?? null)
        })
        valuePlaceholders.push(`(${placeholders.join(',')})`)
    })

    const query = `INSERT INTO sales (${columns.join(',')}) VALUES ${valuePlaceholders.join(',')} ON CONFLICT DO NOTHING`

    await ds.query(query, values)
}

async function main() {
    try {
        const seedFilePath = path.resolve(__dirname, '../../../../docs/seed_data.json')
        logger.info(`Reading seed data from ${seedFilePath}`)
        const fileContent = fs.readFileSync(seedFilePath, 'utf-8')
        const seedData: SeedData = JSON.parse(fileContent)

        await initDataSource()
        await getDataSource().initialize()
        logger.info('Database connection established')

        // Clean existing data
        await getDataSource().query('TRUNCATE TABLE product_inventory, customers, sales, sale_record RESTART IDENTITY CASCADE')

        // Ensure unique phone numbers in customers to satisfy unique index
        const seenPhones = new Set<string>()
        const processedCustomers = seedData.customers.map((cust) => {
            let phone = cust.phone_number
            if (phone && seenPhones.has(phone)) {
                phone = `${phone}_${cust.id}`
            }
            seenPhones.add(phone)
            return { ...cust, phone_number: phone }
        })

        const customerMap = new Map<number, any>()
        processedCustomers.forEach((cust) => {
            if (!customerMap.has(cust.id)) customerMap.set(cust.id, cust)
        })
        const uniqueCustomers = Array.from(customerMap.values())

        // Ensure all customer ids used in sales exist
        const existingIds = new Set<number>(uniqueCustomers.map((c) => c.id))
        const missingCustomerRows = seedData.sales
            .map((s) => s.customer_id)
            .filter((id) => id && !existingIds.has(id))
            .map((id) => ({ id, phone_number: `+000000${id}` }))

        const finalCustomers = uniqueCustomers.concat(missingCustomerRows)

        // Insert order is important because of FK constraints
        await insertBatch('product_inventory', seedData.product_inventory)
        await insertBatch('customers', finalCustomers)

        // --- Ensure no missing customer ids remain after insertion ---
        const existingRows: Array<{ id: number }> = await getDataSource().query('SELECT id FROM customers')
        const presentIds = new Set<number>(existingRows.map((r) => Number(r.id)))
        const missingAfterInsert = seedData.sales
            .map((s) => s.customer_id)
            .filter((id) => id && !presentIds.has(id))
            .map((id) => ({ id, phone_number: `+999999${id}` }))

        if (missingAfterInsert.length) {
            logger.warn(`Inserting ${missingAfterInsert.length} placeholder customers to satisfy FK constraints`)
            await insertBatch('customers', missingAfterInsert)
        }

        await insertSales(seedData.sales)
        await insertBatch('sale_record', seedData.sale_record)

        logger.info('Seed data loaded successfully')
        process.exit(0)
    } catch (err) {
        logger.error(`Failed to load seed data: ${(err as Error).message}`)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}

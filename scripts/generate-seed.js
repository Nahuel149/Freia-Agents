#!/usr/bin/env node
/*
 * Script: generate-seed.js
 * ---------------------------------------
 * Lee docs/DATAFINALV1.0.json y genera docs/seed_data.json con:
 *   - product_inventory (productoId, name, brand, stock, price, updatedDate)
 *   - customers (10 clientes dummy)
 *   - sales + sale_record coherentes (cada venta enlaza un cliente y al menos 1 producto)
 * Timestamps usan NOW() por defecto (null en JSON) para que la BD aplique DEFAULT NOW().
 */
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// --- Config ---
const SRC_FILE = path.resolve(__dirname, '../docs/DATAFINALV1.0.json')
const DEST_FILE = path.resolve(__dirname, '../docs/seed_data.json')
const CUSTOMER_COUNT = 10
const SALES_COUNT = 20 // generamos un poco mas de ventas para tener datos

// --- Helpers simples de datos ---
const firstNames = ['Juan', 'María', 'Pedro', 'Lucía', 'Sofía', 'Carlos', 'Ana', 'Diego', 'Valentina', 'José']
const lastNames = ['Pérez', 'Gómez', 'Rodríguez', 'López', 'Martínez', 'García', 'Fernández', 'Sánchez', 'Díaz', 'Torres']
function randArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}
function randomPhone() {
    return `+54 9 11 ${Math.floor(40000000 + Math.random() * 59999999)}`
}

// --- Carga de productos ---
const raw = fs.readFileSync(SRC_FILE, 'utf8')
const data = JSON.parse(raw)
const products = data.productos || []

const productInventory = products.map((p) => ({
    productId: p.ID,
    name: p.Nombre,
    brand: p.Marca,
    stock: p.Stock,
    price: p.Precio,
    updatedDate: null // DEFAULT NOW() en la BD
}))

// --- Generar clientes ---
const customers = Array.from({ length: CUSTOMER_COUNT }).map((_, i) => {
    const first_name = randArray(firstNames)
    const last_name = randArray(lastNames)
    return {
        id: i + 1,
        first_name,
        last_name,
        email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@example.com`,
        phone_number: randomPhone(),
        default_address: 'Sin dirección',
        default_payment_method: 'efectivo',
        previous_purchases: '[]',
        created_at: null, // DEFAULT NOW()
        updated_at: null // DEFAULT NOW()
    }
})

// --- Generar ventas y líneas de venta ---
let saleIdCounter = 1000
let saleRecordIdCounter = 1
// --- Generar ventas y registros (sales + sale_record) totalmente alineados con la BD ---
let nextSaleId = 1
const sales = []
const sale_record = []

for (let s = 0; s < SALES_COUNT; s++) {
    const saleId = nextSaleId++
    // tomamos un cliente random
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const customer_id = customer.id
    const phone_number = customer.phone_number

    // armamos entre 1 y 4 ítems por venta
    const numItems = 1 + Math.floor(Math.random() * 4)
    const itemsArray = []
    let quantityTotal = 0
    let total_price = 0

    for (let i = 0; i < numItems; i++) {
        const prod = products[Math.floor(Math.random() * products.length)]
        const qty = 1 + Math.floor(Math.random() * 4)
        const unit_price = prod.Precio
        const subtotal = qty * unit_price

        quantityTotal += qty
        total_price += subtotal

        itemsArray.push({ productId: prod.ID, name: prod.Nombre, quantity: qty, unit_price })
    }

    const discount_percentage = [0, 5, 10][Math.floor(Math.random() * 3)]
    const final_price = total_price * (1 - discount_percentage / 100)

    // --- Tabla sales (columnas completas) ---
    sales.push({
        id: saleId,
        created_at: null,
        updated_at: null,
        customer_id,
        quantity: quantityTotal,
        unit_price: parseFloat((total_price / quantityTotal).toFixed(2)),
        total_price: parseFloat(total_price.toFixed(2)),
        discount_percentage,
        final_price: parseFloat(final_price.toFixed(2)),
        negotiation_attempts: Math.floor(Math.random() * 3),
        sale_status: 'completed',
        agent_notes: '',
        phone_number,
        product_sku: itemsArray[0].productId.toString(),
        product_brand: randArray(products).Marca,
        product_model: randArray(products).Nombre,
        wheel_size: ['13"', '14"', '15"', '16"'][Math.floor(Math.random() * 4)],
        payment_method: randArray(['efectivo', 'tarjeta', 'transferencia']),
        delivery_method: randArray(['retiro en tienda', 'envio']),
        delivery_address: 'Sin dirección'
    })

    // --- Tabla sale_record (agregado) ---
    sale_record.push({
        id: uuidv4(),
        ts: null,
        items: JSON.stringify(itemsArray),
        totalAmount: parseFloat(final_price.toFixed(2)),
        clientId: customer_id.toString(),
        agentId: '1',
        clientName: `${customer.first_name} ${customer.last_name}`
    })
}

// --- Construir JSON destino ---
const seed = {
    product_inventory: productInventory,
    customers,
    sales,
    sale_record
}

fs.writeFileSync(DEST_FILE, JSON.stringify(seed, null, 2))
console.log(`Seed generado: ${DEST_FILE}`)

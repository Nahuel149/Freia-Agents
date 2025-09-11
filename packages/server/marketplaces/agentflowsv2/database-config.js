// Configuración de base de datos para B2B Sales Agents
const { Pool } = require('pg');

// Configuración de conexión PostgreSQL
class B2BSalesDB {
    constructor(connectionString) {
        this.pool = new Pool({
            connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/b2b_sales'
        });
    }

    // Buscar cliente por número de teléfono
    async findCustomerByPhone(phoneNumber) {
        try {
            const query = 'SELECT * FROM customers WHERE phone_number = $1';
            const result = await this.pool.query(query, [phoneNumber]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding customer:', error);
            return null;
        }
    }

    // Crear o actualizar cliente
    async upsertCustomer(customerData) {
        try {
            const { phoneNumber, firstName, lastName, email, defaultAddress, defaultPaymentMethod, previousPurchases } = customerData;
            
            const query = `
                INSERT INTO customers (phone_number, first_name, last_name, email, default_address, default_payment_method, previous_purchases)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (phone_number) 
                DO UPDATE SET 
                    first_name = COALESCE($2, customers.first_name),
                    last_name = COALESCE($3, customers.last_name),
                    email = COALESCE($4, customers.email),
                    default_address = COALESCE($5, customers.default_address),
                    default_payment_method = COALESCE($6, customers.default_payment_method),
                    previous_purchases = COALESCE($7, customers.previous_purchases),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `;
            
            const result = await this.pool.query(query, [
                phoneNumber, firstName, lastName, email, defaultAddress, defaultPaymentMethod, 
                JSON.stringify(previousPurchases || [])
            ]);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error upserting customer:', error);
            return null;
        }
    }

    // Registrar venta
    async createSale(saleData) {
        try {
            const {
                customerId, phoneNumber, productSku, productBrand, productModel, wheelSize,
                quantity, unitPrice, totalPrice, discountPercentage, finalPrice,
                paymentMethod, deliveryMethod, deliveryAddress, negotiationAttempts, agentNotes
            } = saleData;

            const query = `
                INSERT INTO sales (
                    customer_id, phone_number, product_sku, product_brand, product_model, wheel_size,
                    quantity, unit_price, total_price, discount_percentage, final_price,
                    payment_method, delivery_method, delivery_address, negotiation_attempts, agent_notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *;
            `;

            const result = await this.pool.query(query, [
                customerId, phoneNumber, productSku, productBrand, productModel, wheelSize,
                quantity, unitPrice, totalPrice, discountPercentage, finalPrice,
                paymentMethod, deliveryMethod, deliveryAddress, negotiationAttempts, agentNotes
            ]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating sale:', error);
            return null;
        }
    }

    // Programar seguimiento
    async scheduleFollowUp(followUpData) {
        try {
            const {
                customerId, phoneNumber, saleId, followUpType, scheduledAt,
                attemptNumber, maxAttempts, messageSent, nextAction
            } = followUpData;

            const query = `
                INSERT INTO follow_ups (
                    customer_id, phone_number, sale_id, follow_up_type, scheduled_at,
                    attempt_number, max_attempts, message_sent, next_action
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *;
            `;

            const result = await this.pool.query(query, [
                customerId, phoneNumber, saleId, followUpType, scheduledAt,
                attemptNumber, maxAttempts, messageSent, nextAction
            ]);

            return result.rows[0];
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            return null;
        }
    }

    // Obtener seguimientos pendientes
    async getPendingFollowUps(limit = 50) {
        try {
            const query = `
                SELECT f.*, c.first_name, c.last_name, c.default_address, c.default_payment_method
                FROM follow_ups f
                JOIN customers c ON f.customer_id = c.id
                WHERE f.status = 'pending' 
                AND f.scheduled_at <= CURRENT_TIMESTAMP
                ORDER BY f.scheduled_at ASC
                LIMIT $1;
            `;

            const result = await this.pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Error getting pending follow-ups:', error);
            return [];
        }
    }

    // Marcar seguimiento como completado
    async completeFollowUp(followUpId, customerResponse, nextAction) {
        try {
            const query = `
                UPDATE follow_ups 
                SET status = 'completed', 
                    completed_at = CURRENT_TIMESTAMP,
                    customer_response = $2,
                    next_action = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            `;

            const result = await this.pool.query(query, [followUpId, customerResponse, nextAction]);
            return result.rows[0];
        } catch (error) {
            console.error('Error completing follow-up:', error);
            return null;
        }
    }

    // Cerrar conexión
    async close() {
        await this.pool.end();
    }
}

module.exports = B2BSalesDB;

// Ejemplo de uso:
// const db = new B2BSalesDB();
// const customer = await db.findCustomerByPhone('+5491123456789');
// console.log(customer);
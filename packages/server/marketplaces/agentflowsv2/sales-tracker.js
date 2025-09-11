// Sistema de registro y seguimiento de ventas B2B
const B2BSalesDB = require('./database-config');
const AddressManager = require('./address-manager');
const FollowUpSystem = require('./followup-system');

class SalesTracker {
    constructor(dbConnectionString) {
        this.db = new B2BSalesDB(dbConnectionString);
        this.addressManager = new AddressManager(dbConnectionString);
        this.followUpSystem = new FollowUpSystem(dbConnectionString);
    }

    // Registrar una venta completada
    async recordSale(saleData, flowState) {
        try {
            const {
                customerData,
                productDetails,
                negotiationDetails,
                deliveryInfo,
                paymentInfo
            } = saleData;

            // 1. Crear o actualizar cliente
            const customer = await this.db.upsertCustomer({
                phoneNumber: customerData.phoneNumber,
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                email: customerData.email,
                businessName: customerData.businessName,
                businessType: customerData.businessType,
                taxId: customerData.taxId
            });

            // 2. Gestionar dirección de entrega
            let deliveryAddressId = null;
            if (deliveryInfo && deliveryInfo.address) {
                deliveryAddressId = await this.addressManager.addAddress(
                    customer.id,
                    deliveryInfo.address,
                    'delivery'
                );
            }

            // 3. Crear registro de venta
            const saleRecord = {
                customerId: customer.id,
                productName: productDetails.name,
                productCategory: productDetails.category,
                quantity: parseInt(productDetails.quantity) || 1,
                unitPrice: parseFloat(productDetails.unitPrice) || 0,
                totalAmount: parseFloat(productDetails.totalAmount) || 0,
                currency: productDetails.currency || 'ARS',
                
                // Detalles de negociación
                originalPrice: parseFloat(negotiationDetails.originalPrice) || 0,
                finalPrice: parseFloat(negotiationDetails.finalPrice) || 0,
                discountApplied: parseFloat(negotiationDetails.discountApplied) || 0,
                discountPercentage: parseFloat(negotiationDetails.discountPercentage) || 0,
                negotiationAttempts: parseInt(negotiationDetails.attempts) || 1,
                
                // Información de entrega
                deliveryMethod: deliveryInfo?.method || 'standard',
                deliveryAddress: deliveryInfo?.fullAddress || '',
                deliveryAddressId: deliveryAddressId,
                estimatedDeliveryDate: deliveryInfo?.estimatedDate ? new Date(deliveryInfo.estimatedDate) : null,
                deliveryNotes: deliveryInfo?.notes || '',
                
                // Información de pago
                paymentMethod: paymentInfo?.method || 'cash',
                paymentStatus: paymentInfo?.status || 'pending',
                paymentTerms: paymentInfo?.terms || 'immediate',
                paymentNotes: paymentInfo?.notes || '',
                
                // Metadatos
                salesChannel: 'whatsapp_b2b',
                salesAgent: flowState.salesAgent || 'AI_Agent',
                campaignSource: flowState.campaignSource || 'organic',
                saleDate: new Date(),
                status: 'confirmed'
            };

            const sale = await this.db.createSale(saleRecord);
            
            // 4. Programar seguimientos post-venta
            await this.schedulePostSaleFollowUps(sale, customer, flowState);
            
            // 5. Generar resumen de venta
            const saleSummary = await this.generateSaleSummary(sale, customer);
            
            console.log(`✅ Sale recorded successfully: ID ${sale.id}`);
            
            return {
                success: true,
                saleId: sale.id,
                customerId: customer.id,
                summary: saleSummary,
                sale: sale
            };
            
        } catch (error) {
            console.error('Error recording sale:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Programar seguimientos post-venta
    async schedulePostSaleFollowUps(sale, customer, flowState) {
        try {
            const followUps = [
                {
                    type: 'delivery_confirmation',
                    delayHours: 24,
                    message: `¡Hola ${customer.first_name}! ¿Cómo andás? Te escribo para confirmar que tu pedido de ${sale.product_name} está en camino. ¿Recibiste alguna novedad del envío?`
                },
                {
                    type: 'satisfaction_check',
                    delayHours: 72,
                    message: `¡Hola ${customer.first_name}! Espero que hayas recibido tu ${sale.product_name} sin problemas. ¿Cómo te resultó? ¿Está todo como esperabas?`
                },
                {
                    type: 'upsell_opportunity',
                    delayHours: 168, // 1 semana
                    message: `¡Hola ${customer.first_name}! ¿Qué tal viene funcionando tu ${sale.product_name}? Te quería comentar que tenemos productos complementarios que te pueden interesar.`
                },
                {
                    type: 'loyalty_check',
                    delayHours: 720, // 1 mes
                    message: `¡Hola ${customer.first_name}! ¿Cómo va todo? Ya pasó un tiempo desde tu compra de ${sale.product_name}. ¿Necesitás algo más o tenés alguna consulta?`
                }
            ];

            for (const followUp of followUps) {
                const scheduledAt = new Date();
                scheduledAt.setHours(scheduledAt.getHours() + followUp.delayHours);
                
                const adjustedTime = this.followUpSystem.adjustToBusinessHours(scheduledAt, flowState);
                
                await this.db.scheduleFollowUp({
                    customerId: customer.id,
                    phoneNumber: customer.phone_number,
                    saleId: sale.id,
                    followUpType: followUp.type,
                    scheduledAt: adjustedTime,
                    attemptNumber: 1,
                    maxAttempts: 1, // Solo un intento para seguimientos post-venta
                    messageSent: followUp.message,
                    nextAction: 'send_followup_message'
                });
            }
            
            console.log(`📅 Scheduled ${followUps.length} post-sale follow-ups for customer ${customer.id}`);
            
        } catch (error) {
            console.error('Error scheduling post-sale follow-ups:', error);
        }
    }

    // Generar resumen de venta
    async generateSaleSummary(sale, customer) {
        const summary = {
            saleInfo: {
                id: sale.id,
                date: sale.sale_date,
                status: sale.status
            },
            customer: {
                name: `${customer.first_name} ${customer.last_name}`.trim(),
                phone: customer.phone_number,
                business: customer.business_name
            },
            product: {
                name: sale.product_name,
                category: sale.product_category,
                quantity: sale.quantity,
                unitPrice: sale.unit_price,
                totalAmount: sale.total_amount,
                currency: sale.currency
            },
            negotiation: {
                originalPrice: sale.original_price,
                finalPrice: sale.final_price,
                discountApplied: sale.discount_applied,
                discountPercentage: sale.discount_percentage,
                attempts: sale.negotiation_attempts
            },
            delivery: {
                method: sale.delivery_method,
                address: sale.delivery_address,
                estimatedDate: sale.estimated_delivery_date,
                notes: sale.delivery_notes
            },
            payment: {
                method: sale.payment_method,
                status: sale.payment_status,
                terms: sale.payment_terms
            }
        };
        
        return summary;
    }

    // Actualizar estado de venta
    async updateSaleStatus(saleId, newStatus, notes = '') {
        try {
            const query = `
                UPDATE sales 
                SET status = $1, 
                    updated_at = NOW(),
                    delivery_notes = CASE 
                        WHEN $3 != '' THEN CONCAT(COALESCE(delivery_notes, ''), '\n', $3)
                        ELSE delivery_notes 
                    END
                WHERE id = $2 
                RETURNING *;
            `;
            
            const result = await this.db.pool.query(query, [newStatus, saleId, notes]);
            
            if (result.rows.length > 0) {
                console.log(`📝 Sale ${saleId} status updated to: ${newStatus}`);
                return result.rows[0];
            }
            
            return null;
        } catch (error) {
            console.error('Error updating sale status:', error);
            return null;
        }
    }

    // Obtener ventas por cliente
    async getCustomerSales(customerId, limit = 10) {
        try {
            const query = `
                SELECT s.*, c.first_name, c.last_name, c.business_name
                FROM sales s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.customer_id = $1
                ORDER BY s.sale_date DESC
                LIMIT $2;
            `;
            
            const result = await this.db.pool.query(query, [customerId, limit]);
            return result.rows;
        } catch (error) {
            console.error('Error getting customer sales:', error);
            return [];
        }
    }

    // Obtener estadísticas de ventas
    async getSalesStats(dateFrom, dateTo) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_sales,
                    SUM(total_amount) as total_revenue,
                    AVG(total_amount) as avg_sale_amount,
                    AVG(negotiation_attempts) as avg_negotiation_attempts,
                    COUNT(DISTINCT customer_id) as unique_customers,
                    
                    -- Por método de pago
                    COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_sales,
                    COUNT(CASE WHEN payment_method = 'transfer' THEN 1 END) as transfer_sales,
                    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_sales,
                    
                    -- Por estado
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_sales,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_sales,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_sales,
                    
                    -- Descuentos
                    AVG(discount_percentage) as avg_discount_percentage,
                    SUM(discount_applied) as total_discounts_given
                    
                FROM sales 
                WHERE sale_date >= $1 AND sale_date <= $2;
            `;
            
            const result = await this.db.pool.query(query, [dateFrom, dateTo]);
            return result.rows[0];
        } catch (error) {
            console.error('Error getting sales stats:', error);
            return null;
        }
    }

    // Obtener top productos vendidos
    async getTopProducts(limit = 10, dateFrom = null, dateTo = null) {
        try {
            let query = `
                SELECT 
                    product_name,
                    product_category,
                    COUNT(*) as sales_count,
                    SUM(quantity) as total_quantity,
                    SUM(total_amount) as total_revenue,
                    AVG(unit_price) as avg_unit_price
                FROM sales 
            `;
            
            const params = [];
            
            if (dateFrom && dateTo) {
                query += ` WHERE sale_date >= $1 AND sale_date <= $2`;
                params.push(dateFrom, dateTo);
            }
            
            query += `
                GROUP BY product_name, product_category
                ORDER BY sales_count DESC, total_revenue DESC
                LIMIT $${params.length + 1};
            `;
            
            params.push(limit);
            
            const result = await this.db.pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error getting top products:', error);
            return [];
        }
    }

    // Generar reporte de ventas
    async generateSalesReport(dateFrom, dateTo) {
        try {
            const stats = await this.getSalesStats(dateFrom, dateTo);
            const topProducts = await this.getTopProducts(5, dateFrom, dateTo);
            
            const report = {
                period: {
                    from: dateFrom,
                    to: dateTo
                },
                summary: stats,
                topProducts: topProducts,
                generatedAt: new Date()
            };
            
            return report;
        } catch (error) {
            console.error('Error generating sales report:', error);
            return null;
        }
    }
}

module.exports = SalesTracker;

// Ejemplo de uso:
// const salesTracker = new SalesTracker(process.env.DB_CONNECTION_STRING);
// const result = await salesTracker.recordSale(saleData, flowState);
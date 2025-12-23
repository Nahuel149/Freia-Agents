// Integración principal del sistema B2B Sales
const B2BSalesDB = require('./database-config')
const AddressManager = require('./address-manager')
const FollowUpSystem = require('./followup-system')
const SalesTracker = require('./sales-tracker')
const ScheduledFollowUps = require('./scheduled-followups')

class B2BSalesIntegration {
    constructor(config = {}) {
        this.config = {
            dbConnectionString: config.dbConnectionString || process.env.DB_CONNECTION_STRING,
            autoStartScheduler: config.autoStartScheduler !== false,
            schedulerInterval: config.schedulerInterval || 5, // minutos
            followUpInterval: config.followUpInterval || 15, // minutos
            ...config
        }

        // Inicializar componentes
        this.db = new B2BSalesDB(this.config.dbConnectionString)
        this.addressManager = new AddressManager(this.config.dbConnectionString)
        this.followUpSystem = new FollowUpSystem(this.config.dbConnectionString)
        this.salesTracker = new SalesTracker(this.config.dbConnectionString)
        this.scheduledFollowUps = new ScheduledFollowUps(this.config.dbConnectionString)

        this.initialized = false
    }

    // Inicializar todo el sistema
    async initialize() {
        try {
            console.log('🚀 Initializing B2B Sales Integration System...')

            // Inicializar base de datos
            await this.db.initialize()

            // Inicializar componentes
            await this.addressManager.initialize()
            await this.followUpSystem.initialize()
            await this.scheduledFollowUps.initialize()

            // Iniciar procesadores automáticos si está configurado
            if (this.config.autoStartScheduler) {
                this.followUpSystem.startAutomaticProcessing(this.config.followUpInterval)
                this.scheduledFollowUps.startScheduler(this.config.schedulerInterval)
            }

            this.initialized = true
            console.log('✅ B2B Sales Integration System initialized successfully')
        } catch (error) {
            console.error('❌ Error initializing B2B Sales Integration:', error)
            throw error
        }
    }

    // Procesar interacción de cliente (para usar en el agente)
    async processCustomerInteraction(interactionData, flowState) {
        try {
            if (!this.initialized) {
                await this.initialize()
            }

            const {
                phoneNumber,
                firstName,
                lastName,
                email,
                businessName,
                businessType,
                productInterest,
                interactionType, // 'inquiry', 'negotiation', 'sale_completed', 'follow_up'
                saleData = null,
                customMessage = null
            } = interactionData

            let result = {
                success: true,
                customerId: null,
                actions: [],
                message: ''
            }

            // 1. Buscar o crear cliente
            let customer = await this.db.findCustomerByPhone(phoneNumber)
            if (!customer) {
                customer = await this.db.upsertCustomer({
                    phoneNumber,
                    firstName,
                    lastName,
                    email,
                    businessName,
                    businessType
                })
                result.actions.push('customer_created')
            } else {
                // Actualizar datos si hay cambios
                const updatedCustomer = await this.db.upsertCustomer({
                    phoneNumber,
                    firstName: firstName || customer.first_name,
                    lastName: lastName || customer.last_name,
                    email: email || customer.email,
                    businessName: businessName || customer.business_name,
                    businessType: businessType || customer.business_type
                })
                if (updatedCustomer.updated_at > customer.updated_at) {
                    result.actions.push('customer_updated')
                }
                customer = updatedCustomer
            }

            result.customerId = customer.id

            // 2. Procesar según tipo de interacción
            switch (interactionType) {
                case 'inquiry':
                    result.message = await this.handleInquiry(customer, productInterest, flowState)
                    break

                case 'negotiation':
                    result.message = await this.handleNegotiation(customer, productInterest, flowState)
                    break

                case 'sale_completed': {
                    const saleResult = await this.handleSaleCompleted(customer, saleData, flowState)
                    result.saleId = saleResult.saleId
                    result.message = saleResult.message
                    result.actions.push('sale_recorded')
                    break
                }

                case 'follow_up':
                    result.message = await this.handleFollowUp(customer, customMessage, flowState)
                    break

                default:
                    result.message = `Hola ${firstName || 'Cliente'}, ¿en qué te puedo ayudar hoy?`
            }

            return result
        } catch (error) {
            console.error('Error processing customer interaction:', error)
            return {
                success: false,
                error: error.message,
                message: 'Disculpá, tuve un problema técnico. ¿Podés intentar de nuevo?'
            }
        }
    }

    // Manejar consulta inicial
    async handleInquiry(customer, productInterest, flowState) {
        try {
            // Buscar ventas anteriores
            const previousSales = await this.salesTracker.getCustomerSales(customer.id, 3)

            let message = `¡Hola ${customer.first_name}! `

            if (previousSales.length > 0) {
                const lastSale = previousSales[0]
                message += `Veo que ya compraste ${lastSale.product_name} anteriormente. `
            }

            message += `Te ayudo con ${productInterest}. ¿Qué necesitás saber específicamente?`

            return message
        } catch (error) {
            console.error('Error handling inquiry:', error)
            return `¡Hola ${customer.first_name}! ¿En qué te puedo ayudar con ${productInterest}?`
        }
    }

    // Manejar negociación
    async handleNegotiation(customer, productInterest, flowState) {
        try {
            // Programar seguimiento si no cierra
            await this.followUpSystem.scheduleFollowUp(
                {
                    phoneNumber: customer.phone_number,
                    firstName: customer.first_name,
                    lastName: customer.last_name,
                    productInterest,
                    lastInteraction: new Date(),
                    negotiationAttempts: 1
                },
                flowState
            )

            return `Perfecto ${customer.first_name}, entiendo tu interés en ${productInterest}. Te voy a preparar la mejor propuesta. Si no llegamos a un acuerdo hoy, te contacto mañana con más opciones.`
        } catch (error) {
            console.error('Error handling negotiation:', error)
            return `Perfecto ${customer.first_name}, trabajemos juntos para encontrar la mejor opción para ${productInterest}.`
        }
    }

    // Manejar venta completada
    async handleSaleCompleted(customer, saleData, flowState) {
        try {
            const result = await this.salesTracker.recordSale(
                {
                    customerData: {
                        phoneNumber: customer.phone_number,
                        firstName: customer.first_name,
                        lastName: customer.last_name,
                        email: customer.email,
                        businessName: customer.business_name,
                        businessType: customer.business_type
                    },
                    ...saleData
                },
                flowState
            )

            if (result.success) {
                return {
                    saleId: result.saleId,
                    message: `¡Excelente ${customer.first_name}! Tu compra de ${saleData.productDetails.name} está confirmada. Te voy a estar contactando para confirmar la entrega y asegurarme de que todo salga perfecto. ¡Gracias por confiar en nosotros!`
                }
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            console.error('Error handling sale completion:', error)
            return {
                saleId: null,
                message: `¡Perfecto ${customer.first_name}! Tu compra está confirmada. Te contacto pronto con los detalles de entrega.`
            }
        }
    }

    // Manejar follow-up
    async handleFollowUp(customer, customMessage, flowState) {
        try {
            if (customMessage) {
                return customMessage
            }

            // Generar mensaje de follow-up automático
            const previousSales = await this.salesTracker.getCustomerSales(customer.id, 1)

            if (previousSales.length > 0) {
                const lastSale = previousSales[0]
                return `¡Hola ${customer.first_name}! ¿Cómo va todo con tu ${lastSale.product_name}? ¿Necesitás algo más o tenés alguna consulta?`
            } else {
                return `¡Hola ${customer.first_name}! ¿Cómo andás? Te escribo para ver si seguís interesado en nuestros productos. ¿Hay algo en lo que te pueda ayudar?`
            }
        } catch (error) {
            console.error('Error handling follow-up:', error)
            return `¡Hola ${customer.first_name}! ¿Cómo andás? ¿En qué te puedo ayudar hoy?`
        }
    }

    // Obtener información del cliente para el agente
    async getCustomerContext(phoneNumber) {
        try {
            const customer = await this.db.findCustomerByPhone(phoneNumber)
            if (!customer) {
                return {
                    isNewCustomer: true,
                    message: 'Cliente nuevo - recopilar información básica'
                }
            }

            const sales = await this.salesTracker.getCustomerSales(customer.id, 5)
            const addresses = await this.addressManager.getCustomerAddresses(customer.id)
            const pendingFollowUps = await this.db.getPendingFollowUps(10, customer.id)

            return {
                isNewCustomer: false,
                customer: {
                    id: customer.id,
                    name: `${customer.first_name} ${customer.last_name}`.trim(),
                    business: customer.business_name,
                    phone: customer.phone_number,
                    email: customer.email
                },
                salesHistory: sales.map((sale) => ({
                    product: sale.product_name,
                    date: sale.sale_date,
                    amount: sale.total_amount,
                    status: sale.status
                })),
                addresses: addresses,
                pendingFollowUps: pendingFollowUps.length,
                message: `Cliente existente: ${customer.first_name} - ${sales.length} compras anteriores`
            }
        } catch (error) {
            console.error('Error getting customer context:', error)
            return {
                isNewCustomer: true,
                message: 'Error obteniendo contexto - tratar como cliente nuevo'
            }
        }
    }

    // Obtener estadísticas del sistema
    async getSystemStats() {
        try {
            const today = new Date()
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

            const salesStats = await this.salesTracker.getSalesStats(weekAgo, today)
            const followUpStats = await this.scheduledFollowUps.getSchedulerStats()

            return {
                sales: salesStats,
                followUps: followUpStats,
                systemStatus: {
                    initialized: this.initialized,
                    followUpSystemRunning: this.followUpSystem.isRunning,
                    schedulerRunning: this.scheduledFollowUps.schedulerRunning
                }
            }
        } catch (error) {
            console.error('Error getting system stats:', error)
            return null
        }
    }

    // Cerrar conexiones y detener procesos
    async shutdown() {
        try {
            console.log('🔄 Shutting down B2B Sales Integration...')

            this.followUpSystem.stopAutomaticProcessing()
            this.scheduledFollowUps.stopScheduler()

            await this.db.close()

            console.log('✅ B2B Sales Integration shutdown complete')
        } catch (error) {
            console.error('Error during shutdown:', error)
        }
    }
}

module.exports = B2BSalesIntegration

// Ejemplo de uso en el agente:
/*
const B2BSalesIntegration = require('./b2b-sales-integration');

const b2bSystem = new B2BSalesIntegration({
    dbConnectionString: process.env.DB_CONNECTION_STRING,
    autoStartScheduler: true
});

// En el agente principal:
async function handleCustomerMessage(phoneNumber, message, flowState) {
    // Obtener contexto del cliente
    const context = await b2bSystem.getCustomerContext(phoneNumber);
    
    // Procesar interacción
    const result = await b2bSystem.processCustomerInteraction({
        phoneNumber,
        firstName: extractedFirstName,
        interactionType: 'inquiry',
        productInterest: extractedProduct
    }, flowState);
    
    return result.message;
}
*/

// Orquestador de Agentes B2B - Integración y Coordinación
const B2BSalesIntegration = require('./b2b-sales-integration')

class AgentOrchestrator {
    constructor(config = {}) {
        this.config = {
            dbConnectionString: config.dbConnectionString || process.env.DB_CONNECTION_STRING,
            agentflowApiUrl: config.agentflowApiUrl || process.env.AGENTFLOW_API_URL,
            wasenderApiUrl: config.wasenderApiUrl || process.env.WASENDER_API_URL,
            maxConcurrentAgents: config.maxConcurrentAgents || 5,
            agentTimeout: config.agentTimeout || 30000, // 30 segundos
            ...config
        }

        // Sistema B2B integrado
        this.b2bSystem = new B2BSalesIntegration({
            dbConnectionString: this.config.dbConnectionString,
            autoStartScheduler: true
        })

        // Cola de procesamiento
        this.processingQueue = []
        this.activeAgents = new Map()
        this.agentResults = new Map()

        this.initialized = false
    }

    // Inicializar el orquestador
    async initialize() {
        try {
            console.log('🎭 Initializing Agent Orchestrator...')

            // Inicializar sistema B2B
            await this.b2bSystem.initialize()

            this.initialized = true
            console.log('✅ Agent Orchestrator initialized successfully')
        } catch (error) {
            console.error('❌ Error initializing Agent Orchestrator:', error)
            throw error
        }
    }

    // Procesar mensaje de cliente con múltiples agentes
    async processCustomerMessage(messageData) {
        try {
            if (!this.initialized) {
                await this.initialize()
            }

            const {
                phoneNumber,
                message,
                flowState = {},
                agentStrategy = 'sequential' // 'sequential', 'parallel', 'conditional'
            } = messageData

            console.log(`📱 Processing message from ${phoneNumber}: "${message.substring(0, 50)}..."`)

            // 1. Obtener contexto del cliente
            const customerContext = await this.b2bSystem.getCustomerContext(phoneNumber)

            // 2. Determinar qué agentes usar según el contexto
            const agentPlan = await this.createAgentPlan(message, customerContext, flowState)

            // 3. Ejecutar agentes según la estrategia
            let result
            switch (agentStrategy) {
                case 'parallel':
                    result = await this.executeAgentsInParallel(agentPlan, messageData)
                    break
                case 'conditional':
                    result = await this.executeAgentsConditionally(agentPlan, messageData)
                    break
                default: // sequential
                    result = await this.executeAgentsSequentially(agentPlan, messageData)
            }

            // 4. Procesar resultado final
            const finalResponse = await this.processFinalResult(result, customerContext, flowState)

            return finalResponse
        } catch (error) {
            console.error('Error processing customer message:', error)
            return {
                success: false,
                response: 'Disculpá, tuve un problema técnico. ¿Podés intentar de nuevo?',
                error: error.message
            }
        }
    }

    // Crear plan de agentes según el contexto
    async createAgentPlan(message, customerContext, flowState) {
        const plan = {
            agents: [],
            strategy: 'sequential',
            priority: 'normal'
        }

        // Analizar el mensaje para determinar intención
        const intent = this.analyzeMessageIntent(message)

        switch (intent.type) {
            case 'product_inquiry':
                plan.agents = [
                    {
                        name: 'product_specialist',
                        agentId: 'agentAgentflow_0', // Agente principal del JSON
                        role: 'product_consultation',
                        priority: 'high',
                        context: { productInterest: intent.product }
                    },
                    {
                        name: 'pricing_agent',
                        agentId: 'pricing_specialist',
                        role: 'price_calculation',
                        priority: 'medium',
                        dependsOn: ['product_specialist']
                    }
                ]
                break

            case 'negotiation':
                plan.agents = [
                    {
                        name: 'negotiation_agent',
                        agentId: 'agentAgentflow_0',
                        role: 'price_negotiation',
                        priority: 'high',
                        context: {
                            customerHistory: customerContext.salesHistory,
                            maxDiscount: flowState.maxDiscount || 15
                        }
                    }
                ]
                break

            case 'closing':
                plan.agents = [
                    {
                        name: 'closing_agent',
                        agentId: 'agentAgentflow_1', // Agente de cierre del JSON
                        role: 'sale_closing',
                        priority: 'critical',
                        context: {
                            deliveryConfirmation: true,
                            paymentConfirmation: true
                        }
                    }
                ]
                break

            case 'support':
                plan.agents = [
                    {
                        name: 'support_agent',
                        agentId: 'support_specialist',
                        role: 'customer_support',
                        priority: 'medium'
                    }
                ]
                break

            default: // general_inquiry
                plan.agents = [
                    {
                        name: 'main_agent',
                        agentId: 'agentAgentflow_0',
                        role: 'general_assistance',
                        priority: 'normal'
                    }
                ]
        }

        // Agregar agente de seguimiento si es necesario
        if (!customerContext.isNewCustomer && intent.type !== 'support') {
            plan.agents.push({
                name: 'followup_scheduler',
                agentId: 'internal_followup',
                role: 'schedule_followup',
                priority: 'low',
                executeAfter: true // Ejecutar después de la respuesta principal
            })
        }

        return plan
    }

    // Analizar intención del mensaje
    analyzeMessageIntent(message) {
        const lowerMessage = message.toLowerCase()

        // Palabras clave para diferentes intenciones
        const keywords = {
            product_inquiry: ['precio', 'costo', 'producto', 'disponible', 'stock', 'características'],
            negotiation: ['descuento', 'rebaja', 'mejor precio', 'negociar', 'oferta'],
            closing: ['comprar', 'confirmar', 'pedido', 'orden', 'factura'],
            support: ['problema', 'ayuda', 'soporte', 'reclamo', 'garantía']
        }

        for (const [intentType, words] of Object.entries(keywords)) {
            if (words.some((word) => lowerMessage.includes(word))) {
                return {
                    type: intentType,
                    confidence: 0.8,
                    product: this.extractProductMention(message)
                }
            }
        }

        return {
            type: 'general_inquiry',
            confidence: 0.5,
            product: null
        }
    }

    // Extraer mención de producto del mensaje
    extractProductMention(message) {
        // Implementación simple - en producción usar NLP más avanzado
        const productKeywords = ['notebook', 'laptop', 'mouse', 'teclado', 'monitor', 'impresora']
        const lowerMessage = message.toLowerCase()

        for (const product of productKeywords) {
            if (lowerMessage.includes(product)) {
                return product
            }
        }

        return null
    }

    // Ejecutar agentes secuencialmente
    async executeAgentsSequentially(plan, messageData) {
        const results = []
        let previousResult = null

        for (const agentConfig of plan.agents) {
            if (agentConfig.executeAfter) continue // Ejecutar después

            try {
                console.log(`🤖 Executing agent: ${agentConfig.name}`)

                const agentResult = await this.executeAgent(agentConfig, {
                    ...messageData,
                    previousResult,
                    customerContext: await this.b2bSystem.getCustomerContext(messageData.phoneNumber)
                })

                results.push({
                    agent: agentConfig.name,
                    result: agentResult,
                    executedAt: new Date()
                })

                previousResult = agentResult
            } catch (error) {
                console.error(`Error executing agent ${agentConfig.name}:`, error)
                results.push({
                    agent: agentConfig.name,
                    error: error.message,
                    executedAt: new Date()
                })
            }
        }

        return {
            strategy: 'sequential',
            results,
            finalResult: previousResult
        }
    }

    // Ejecutar agentes en paralelo
    async executeAgentsInParallel(plan, messageData) {
        const agentsToExecute = plan.agents.filter((agent) => !agent.executeAfter)

        console.log(`🚀 Executing ${agentsToExecute.length} agents in parallel`)

        const promises = agentsToExecute.map(async (agentConfig) => {
            try {
                const agentResult = await this.executeAgent(agentConfig, {
                    ...messageData,
                    customerContext: await this.b2bSystem.getCustomerContext(messageData.phoneNumber)
                })

                return {
                    agent: agentConfig.name,
                    result: agentResult,
                    executedAt: new Date()
                }
            } catch (error) {
                console.error(`Error executing agent ${agentConfig.name}:`, error)
                return {
                    agent: agentConfig.name,
                    error: error.message,
                    executedAt: new Date()
                }
            }
        })

        const results = await Promise.all(promises)

        // Combinar resultados según prioridad
        const finalResult = this.combineParallelResults(results)

        return {
            strategy: 'parallel',
            results,
            finalResult
        }
    }

    // Ejecutar agentes condicionalmente
    async executeAgentsConditionally(plan, messageData) {
        const results = []
        let currentResult = null

        for (const agentConfig of plan.agents) {
            if (agentConfig.executeAfter) continue

            // Evaluar condición para ejecutar este agente
            const shouldExecute = await this.evaluateAgentCondition(agentConfig, currentResult, messageData)

            if (shouldExecute) {
                try {
                    console.log(`🎯 Conditionally executing agent: ${agentConfig.name}`)

                    const agentResult = await this.executeAgent(agentConfig, {
                        ...messageData,
                        previousResult: currentResult,
                        customerContext: await this.b2bSystem.getCustomerContext(messageData.phoneNumber)
                    })

                    results.push({
                        agent: agentConfig.name,
                        result: agentResult,
                        condition: 'met',
                        executedAt: new Date()
                    })

                    currentResult = agentResult
                } catch (error) {
                    console.error(`Error executing agent ${agentConfig.name}:`, error)
                    results.push({
                        agent: agentConfig.name,
                        error: error.message,
                        condition: 'error',
                        executedAt: new Date()
                    })
                }
            } else {
                console.log(`⏭️ Skipping agent ${agentConfig.name} - condition not met`)
                results.push({
                    agent: agentConfig.name,
                    condition: 'not_met',
                    skipped: true,
                    executedAt: new Date()
                })
            }
        }

        return {
            strategy: 'conditional',
            results,
            finalResult: currentResult
        }
    }

    // Ejecutar un agente individual
    async executeAgent(agentConfig, context) {
        const agentId = `${agentConfig.agentId}_${Date.now()}`

        try {
            // Marcar agente como activo
            this.activeAgents.set(agentId, {
                config: agentConfig,
                startTime: new Date(),
                status: 'running'
            })

            // Preparar datos para el agente
            const agentInput = {
                message: context.message,
                phoneNumber: context.phoneNumber,
                customerContext: context.customerContext,
                flowState: {
                    ...context.flowState,
                    ...agentConfig.context
                },
                previousResult: context.previousResult
            }

            // Simular llamada al agente (en producción sería llamada real a Agentflow)
            const agentResult = await this.callAgentflow(agentConfig.agentId, agentInput)

            // Procesar resultado con sistema B2B si es necesario
            if (agentConfig.role === 'sale_closing' && agentResult.saleCompleted) {
                const b2bResult = await this.b2bSystem.processCustomerInteraction(
                    {
                        phoneNumber: context.phoneNumber,
                        interactionType: 'sale_completed',
                        saleData: agentResult.saleData
                    },
                    context.flowState
                )

                agentResult.b2bIntegration = b2bResult
            }

            // Marcar como completado
            this.activeAgents.set(agentId, {
                ...this.activeAgents.get(agentId),
                status: 'completed',
                endTime: new Date()
            })

            return agentResult
        } catch (error) {
            // Marcar como error
            this.activeAgents.set(agentId, {
                ...this.activeAgents.get(agentId),
                status: 'error',
                error: error.message,
                endTime: new Date()
            })

            throw error
        }
    }

    // Simular llamada a Agentflow (reemplazar con llamada real)
    async callAgentflow(agentId, input) {
        // En producción, esto sería una llamada HTTP al API de Agentflow
        console.log(`📡 Calling Agentflow agent: ${agentId}`)

        // Simular procesamiento
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

        // Respuesta simulada según el tipo de agente
        const responses = {
            agentAgentflow_0: {
                response: `Hola ${input.customerContext?.customer?.name || 'Cliente'}! Te ayudo con ${
                    input.message
                }. Tengo varias opciones que te pueden interesar.`,
                confidence: 0.9,
                nextAction: 'continue_conversation'
            },
            agentAgentflow_1: {
                response: `Perfecto! Confirmemos los detalles de tu pedido. ¿La dirección de entrega es correcta? ¿Cómo preferís pagar?`,
                confidence: 0.95,
                saleCompleted: Math.random() > 0.5, // 50% probabilidad de cierre
                saleData: {
                    productDetails: {
                        name: 'Producto Demo',
                        quantity: 1,
                        unitPrice: 1000,
                        totalAmount: 1000
                    },
                    deliveryInfo: {
                        method: 'standard',
                        address: 'Dirección del cliente'
                    },
                    paymentInfo: {
                        method: 'transfer',
                        status: 'pending'
                    }
                }
            }
        }

        return (
            responses[agentId] || {
                response: 'Respuesta del agente simulada',
                confidence: 0.7,
                nextAction: 'continue_conversation'
            }
        )
    }

    // Evaluar condición para ejecutar agente
    async evaluateAgentCondition(agentConfig, previousResult, context) {
        // Lógica de condiciones personalizables
        if (agentConfig.dependsOn && agentConfig.dependsOn.length > 0) {
            // Verificar que los agentes dependientes se hayan ejecutado exitosamente
            return previousResult && previousResult.confidence > 0.7
        }

        if (agentConfig.role === 'price_negotiation') {
            // Solo ejecutar si el cliente mostró interés en precio
            return context.message.toLowerCase().includes('precio') || context.message.toLowerCase().includes('costo')
        }

        return true // Por defecto, ejecutar
    }

    // Combinar resultados de ejecución paralela
    combineParallelResults(results) {
        // Priorizar por confianza y prioridad del agente
        const successfulResults = results.filter((r) => r.result && !r.error)

        if (successfulResults.length === 0) {
            return {
                response: 'No pude procesar tu consulta correctamente. ¿Podés intentar de nuevo?',
                confidence: 0.1
            }
        }

        // Tomar el resultado con mayor confianza
        const bestResult = successfulResults.reduce((best, current) => {
            return (current.result.confidence || 0) > (best.result.confidence || 0) ? current : best
        })

        return bestResult.result
    }

    // Procesar resultado final
    async processFinalResult(executionResult, customerContext, flowState) {
        try {
            const finalResponse = {
                success: true,
                response: executionResult.finalResult?.response || 'Procesado correctamente',
                strategy: executionResult.strategy,
                agentsExecuted: executionResult.results.length,
                executionTime: new Date(),
                customerContext: customerContext.isNewCustomer ? 'new' : 'existing'
            }

            // Ejecutar agentes post-procesamiento
            const postAgents = executionResult.results.map((r) => r.agent).filter((name) => name.includes('followup'))

            if (postAgents.length > 0) {
                console.log('📅 Executing post-processing agents...')
                // Aquí se ejecutarían los agentes de seguimiento
            }

            return finalResponse
        } catch (error) {
            console.error('Error processing final result:', error)
            return {
                success: false,
                response: 'Hubo un problema procesando tu consulta.',
                error: error.message
            }
        }
    }

    // Obtener estado del orquestador
    getOrchestratorStatus() {
        return {
            initialized: this.initialized,
            activeAgents: this.activeAgents.size,
            queueLength: this.processingQueue.length,
            b2bSystemStatus: this.b2bSystem ? 'connected' : 'disconnected',
            uptime: this.initialized ? Date.now() - this.initTime : 0
        }
    }

    // Cerrar orquestador
    async shutdown() {
        try {
            console.log('🔄 Shutting down Agent Orchestrator...')

            // Esperar que terminen los agentes activos
            if (this.activeAgents.size > 0) {
                console.log(`⏳ Waiting for ${this.activeAgents.size} active agents to complete...`)
                await new Promise((resolve) => setTimeout(resolve, 5000))
            }

            // Cerrar sistema B2B
            await this.b2bSystem.shutdown()

            console.log('✅ Agent Orchestrator shutdown complete')
        } catch (error) {
            console.error('Error during orchestrator shutdown:', error)
        }
    }
}

module.exports = AgentOrchestrator

// Ejemplo de uso:
/*
const AgentOrchestrator = require('./agent-orchestrator');

const orchestrator = new AgentOrchestrator({
    dbConnectionString: process.env.DB_CONNECTION_STRING,
    maxConcurrentAgents: 3
});

// Procesar mensaje del cliente
const result = await orchestrator.processCustomerMessage({
    phoneNumber: '+5491123456789',
    message: 'Hola, quiero saber el precio de una notebook',
    agentStrategy: 'sequential' // o 'parallel' o 'conditional'
});

console.log('Response:', result.response);
*/

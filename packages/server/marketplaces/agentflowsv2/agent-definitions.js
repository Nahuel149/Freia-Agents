// Definiciones de Agentes para Orquestación B2B
// Este archivo define los diferentes tipos de agentes y sus configuraciones

class AgentDefinitions {
    constructor() {
        this.agentTypes = this.initializeAgentTypes()
        this.workflows = this.initializeWorkflows()
        this.integrationPoints = this.initializeIntegrationPoints()
    }

    // Definir tipos de agentes disponibles
    initializeAgentTypes() {
        return {
            // AGENTES PRINCIPALES
            main_sales_agent: {
                id: 'agentAgentflow_0', // Del JSON original
                name: 'Agente Principal de Ventas',
                role: 'primary_sales',
                capabilities: ['product_consultation', 'initial_contact', 'general_inquiry', 'customer_qualification'],
                priority: 'high',
                timeout: 30000,
                maxRetries: 2,
                context: {
                    useMemory: true,
                    trackInteractions: true,
                    b2bIntegration: true
                },
                prompts: {
                    system: 'Sos un experto vendedor B2B especializado en tecnología...',
                    fallback: 'Disculpá, no pude procesar tu consulta. ¿Podés ser más específico?'
                }
            },

            closing_agent: {
                id: 'agentAgentflow_1', // Del JSON original
                name: 'Agente de Cierre',
                role: 'sale_closing',
                capabilities: ['order_confirmation', 'payment_processing', 'delivery_coordination', 'contract_finalization'],
                priority: 'critical',
                timeout: 45000,
                maxRetries: 3,
                context: {
                    requiresConfirmation: true,
                    trackSales: true,
                    scheduleFollowUp: true
                },
                triggers: ['purchase_intent', 'price_agreement', 'ready_to_buy']
            },

            // AGENTES ESPECIALIZADOS
            product_specialist: {
                id: 'product_specialist_v1',
                name: 'Especialista en Productos',
                role: 'product_consultation',
                capabilities: ['product_details', 'technical_specs', 'compatibility_check', 'recommendations'],
                priority: 'high',
                timeout: 25000,
                context: {
                    productCatalog: true,
                    technicalKnowledge: 'advanced',
                    compareProducts: true
                },
                specialization: {
                    categories: ['notebooks', 'desktops', 'peripherals', 'servers'],
                    expertise: 'technical_specifications'
                }
            },

            pricing_agent: {
                id: 'pricing_specialist_v1',
                name: 'Especialista en Precios',
                role: 'price_calculation',
                capabilities: ['price_quotes', 'bulk_discounts', 'payment_terms', 'cost_analysis'],
                priority: 'medium',
                timeout: 20000,
                context: {
                    accessPricing: true,
                    calculateDiscounts: true,
                    paymentOptions: true
                },
                rules: {
                    maxDiscount: 20,
                    bulkThreshold: 10,
                    approvalRequired: 15 // % de descuento que requiere aprobación
                }
            },

            negotiation_agent: {
                id: 'negotiation_specialist_v1',
                name: 'Agente de Negociación',
                role: 'price_negotiation',
                capabilities: ['price_negotiation', 'terms_adjustment', 'value_proposition', 'objection_handling'],
                priority: 'high',
                timeout: 35000,
                context: {
                    negotiationTactics: true,
                    customerHistory: true,
                    competitorAnalysis: true
                },
                strategies: ['volume_discount', 'payment_terms', 'added_value', 'loyalty_program']
            },

            support_agent: {
                id: 'support_specialist_v1',
                name: 'Agente de Soporte',
                role: 'customer_support',
                capabilities: ['issue_resolution', 'technical_support', 'order_tracking', 'warranty_claims'],
                priority: 'medium',
                timeout: 30000,
                context: {
                    accessOrderHistory: true,
                    technicalKnowledge: true,
                    escalationRules: true
                },
                escalation: {
                    conditions: ['unresolved_after_10min', 'customer_angry', 'technical_complexity'],
                    target: 'human_supervisor'
                }
            },

            // AGENTES DE SEGUIMIENTO
            followup_scheduler: {
                id: 'followup_internal_v1',
                name: 'Programador de Seguimientos',
                role: 'schedule_followup',
                capabilities: ['schedule_calls', 'set_reminders', 'track_opportunities', 'nurture_leads'],
                priority: 'low',
                timeout: 15000,
                context: {
                    accessCalendar: true,
                    customerSegmentation: true,
                    automatedSequences: true
                },
                schedules: {
                    immediate: '1_hour',
                    short_term: '24_hours',
                    medium_term: '1_week',
                    long_term: '1_month'
                }
            },

            quality_assurance: {
                id: 'qa_agent_v1',
                name: 'Agente de Calidad',
                role: 'quality_control',
                capabilities: ['interaction_review', 'satisfaction_survey', 'process_improvement', 'compliance_check'],
                priority: 'low',
                timeout: 10000,
                context: {
                    reviewCriteria: true,
                    complianceRules: true,
                    improvementSuggestions: true
                },
                executeAfter: true // Siempre ejecutar después de la interacción principal
            },

            // AGENTES ANALÍTICOS
            analytics_agent: {
                id: 'analytics_internal_v1',
                name: 'Agente de Análisis',
                role: 'data_analysis',
                capabilities: ['interaction_analysis', 'performance_metrics', 'trend_identification', 'reporting'],
                priority: 'low',
                timeout: 20000,
                context: {
                    accessMetrics: true,
                    generateReports: true,
                    predictiveAnalysis: true
                },
                executeAfter: true,
                batchProcessing: true // Puede procesar múltiples interacciones
            }
        }
    }

    // Definir flujos de trabajo predefinidos
    initializeWorkflows() {
        return {
            // FLUJO ESTÁNDAR DE VENTA
            standard_sales_flow: {
                name: 'Flujo Estándar de Venta',
                strategy: 'sequential',
                agents: [
                    {
                        type: 'main_sales_agent',
                        required: true,
                        conditions: []
                    },
                    {
                        type: 'product_specialist',
                        required: false,
                        conditions: ['product_inquiry', 'technical_questions']
                    },
                    {
                        type: 'pricing_agent',
                        required: false,
                        conditions: ['price_request', 'quote_needed']
                    },
                    {
                        type: 'closing_agent',
                        required: false,
                        conditions: ['purchase_intent', 'ready_to_close']
                    }
                ],
                postProcessing: ['followup_scheduler', 'quality_assurance']
            },

            // FLUJO DE NEGOCIACIÓN
            negotiation_flow: {
                name: 'Flujo de Negociación',
                strategy: 'conditional',
                agents: [
                    {
                        type: 'main_sales_agent',
                        required: true,
                        conditions: []
                    },
                    {
                        type: 'pricing_agent',
                        required: true,
                        conditions: ['price_objection']
                    },
                    {
                        type: 'negotiation_agent',
                        required: true,
                        conditions: ['negotiation_needed']
                    },
                    {
                        type: 'closing_agent',
                        required: false,
                        conditions: ['agreement_reached']
                    }
                ],
                maxIterations: 3,
                escalation: {
                    condition: 'no_agreement_after_3_rounds',
                    action: 'human_intervention'
                }
            },

            // FLUJO DE SOPORTE
            support_flow: {
                name: 'Flujo de Soporte al Cliente',
                strategy: 'conditional',
                agents: [
                    {
                        type: 'support_agent',
                        required: true,
                        conditions: []
                    },
                    {
                        type: 'main_sales_agent',
                        required: false,
                        conditions: ['upsell_opportunity', 'new_purchase_interest']
                    }
                ],
                postProcessing: ['quality_assurance', 'analytics_agent'],
                priority: 'high' // Soporte tiene prioridad
            },

            // FLUJO PARALELO PARA CONSULTAS MÚLTIPLES
            parallel_inquiry_flow: {
                name: 'Consultas Múltiples en Paralelo',
                strategy: 'parallel',
                agents: [
                    {
                        type: 'product_specialist',
                        required: false,
                        conditions: ['product_questions']
                    },
                    {
                        type: 'pricing_agent',
                        required: false,
                        conditions: ['pricing_questions']
                    },
                    {
                        type: 'support_agent',
                        required: false,
                        conditions: ['support_questions']
                    }
                ],
                coordinator: 'main_sales_agent', // Agente que coordina las respuestas
                maxConcurrent: 3
            },

            // FLUJO DE VENTA EMPRESARIAL
            enterprise_sales_flow: {
                name: 'Venta Empresarial',
                strategy: 'sequential',
                agents: [
                    {
                        type: 'main_sales_agent',
                        required: true,
                        conditions: [],
                        context: { customerType: 'enterprise' }
                    },
                    {
                        type: 'product_specialist',
                        required: true,
                        conditions: [],
                        context: { focusOn: 'enterprise_solutions' }
                    },
                    {
                        type: 'pricing_agent',
                        required: true,
                        conditions: [],
                        context: { enterpriseDiscounts: true }
                    },
                    {
                        type: 'negotiation_agent',
                        required: false,
                        conditions: ['volume_negotiation']
                    },
                    {
                        type: 'closing_agent',
                        required: true,
                        conditions: ['enterprise_approval']
                    }
                ],
                requirements: {
                    minimumOrderValue: 10000,
                    approvalRequired: true,
                    contractGeneration: true
                }
            }
        }
    }

    // Definir puntos de integración con sistemas externos
    initializeIntegrationPoints() {
        return {
            b2b_system: {
                name: 'Sistema B2B Integrado',
                triggers: ['customer_interaction', 'sale_completed', 'followup_scheduled'],
                actions: ['update_customer_data', 'record_sale', 'schedule_followup', 'update_inventory']
            },

            crm_system: {
                name: 'Sistema CRM',
                triggers: ['new_lead', 'opportunity_created', 'deal_closed'],
                actions: ['create_lead', 'update_opportunity', 'log_interaction']
            },

            inventory_system: {
                name: 'Sistema de Inventario',
                triggers: ['product_inquiry', 'stock_check', 'reservation_needed'],
                actions: ['check_availability', 'reserve_stock', 'update_quantities']
            },

            notification_system: {
                name: 'Sistema de Notificaciones',
                triggers: ['high_priority_lead', 'escalation_needed', 'sale_completed'],
                actions: ['send_alert', 'notify_manager', 'update_dashboard']
            }
        }
    }

    // Obtener configuración de agente por tipo
    getAgentConfig(agentType) {
        const config = this.agentTypes[agentType]
        if (!config) {
            throw new Error(`Tipo de agente '${agentType}' no encontrado`)
        }
        return { ...config } // Retornar copia para evitar modificaciones
    }

    // Obtener flujo de trabajo por nombre
    getWorkflow(workflowName) {
        const workflow = this.workflows[workflowName]
        if (!workflow) {
            throw new Error(`Flujo de trabajo '${workflowName}' no encontrado`)
        }
        return { ...workflow }
    }

    // Determinar flujo de trabajo según contexto
    determineWorkflow(messageContext) {
        const { message, customerType, interactionType, urgency } = messageContext
        const lowerMessage = message.toLowerCase()

        // Reglas para determinar el flujo apropiado
        if (interactionType === 'support' || lowerMessage.includes('problema') || lowerMessage.includes('ayuda')) {
            return 'support_flow'
        }

        if (customerType === 'enterprise' || lowerMessage.includes('empresa') || lowerMessage.includes('corporativo')) {
            return 'enterprise_sales_flow'
        }

        if (lowerMessage.includes('precio') && lowerMessage.includes('negociar')) {
            return 'negotiation_flow'
        }

        if (this.hasMultipleQueries(message)) {
            return 'parallel_inquiry_flow'
        }

        // Flujo estándar por defecto
        return 'standard_sales_flow'
    }

    // Verificar si el mensaje tiene múltiples consultas
    hasMultipleQueries(message) {
        const queryIndicators = ['precio', 'producto', 'stock', 'entrega', 'pago', 'garantía']
        const foundIndicators = queryIndicators.filter((indicator) => message.toLowerCase().includes(indicator))
        return foundIndicators.length >= 2
    }

    // Obtener agentes recomendados para un contexto específico
    getRecommendedAgents(context) {
        const { intent, customerType, urgency, previousInteractions } = context
        const recommendations = []

        // Lógica de recomendación basada en contexto
        switch (intent) {
            case 'product_inquiry':
                recommendations.push('main_sales_agent', 'product_specialist')
                break
            case 'price_negotiation':
                recommendations.push('pricing_agent', 'negotiation_agent')
                break
            case 'purchase_intent':
                recommendations.push('closing_agent', 'followup_scheduler')
                break
            case 'support_request':
                recommendations.push('support_agent')
                break
            default:
                recommendations.push('main_sales_agent')
        }

        // Ajustar según tipo de cliente
        if (customerType === 'enterprise') {
            recommendations.push('negotiation_agent')
        }

        // Agregar agentes de calidad y análisis
        recommendations.push('quality_assurance', 'analytics_agent')

        return recommendations.map((type) => this.getAgentConfig(type))
    }

    // Validar configuración de agente
    validateAgentConfig(config) {
        const required = ['id', 'name', 'role', 'capabilities', 'priority']
        const missing = required.filter((field) => !config[field])

        if (missing.length > 0) {
            throw new Error(`Configuración de agente inválida. Campos faltantes: ${missing.join(', ')}`)
        }

        return true
    }

    // Obtener estadísticas de agentes
    getAgentStats() {
        const stats = {
            totalAgents: Object.keys(this.agentTypes).length,
            totalWorkflows: Object.keys(this.workflows).length,
            agentsByRole: {},
            agentsByPriority: {}
        }

        // Agrupar por rol y prioridad
        Object.values(this.agentTypes).forEach((agent) => {
            // Por rol
            if (!stats.agentsByRole[agent.role]) {
                stats.agentsByRole[agent.role] = 0
            }
            stats.agentsByRole[agent.role]++

            // Por prioridad
            if (!stats.agentsByPriority[agent.priority]) {
                stats.agentsByPriority[agent.priority] = 0
            }
            stats.agentsByPriority[agent.priority]++
        })

        return stats
    }
}

module.exports = AgentDefinitions

// Ejemplo de uso:
/*
const AgentDefinitions = require('./agent-definitions');
const definitions = new AgentDefinitions();

// Obtener configuración de un agente específico
const salesAgent = definitions.getAgentConfig('main_sales_agent');
console.log('Agente de ventas:', salesAgent);

// Determinar flujo de trabajo apropiado
const workflow = definitions.determineWorkflow({
    message: 'Hola, necesito precios de notebooks para mi empresa',
    customerType: 'enterprise',
    interactionType: 'inquiry'
});
console.log('Flujo recomendado:', workflow);

// Obtener agentes recomendados
const agents = definitions.getRecommendedAgents({
    intent: 'product_inquiry',
    customerType: 'enterprise',
    urgency: 'high'
});
console.log('Agentes recomendados:', agents.map(a => a.name));
*/

// Sales Agent CodeAgent Integration
// Self-contained version with all necessary functionality

const fs = require('fs');
const path = require('path');

/**
 * Conversation History Management Class
 */
class ConversationHistory {
    constructor() {
        this.history = [];
        this.maxHistory = 50;
    }

    addMessage(role, content, metadata = {}) {
        this.history.push({
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata
        });
        
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    getHistory() {
        return this.history;
    }

    getRecentHistory(count = 10) {
        return this.history.slice(-count);
    }

    clear() {
        this.history = [];
    }

    getContextSummary() {
        const recentMessages = this.getRecentHistory(5);
        return recentMessages.map(msg => `${msg.role}: ${msg.content.slice(0, 100)}...`).join('\n');
    }
}

/**
 * Simplified TireSalesAgent for CodeAgent integration
 */
class TireSalesAgent {
    constructor() {
        this.businessData = {
            products: [],
            clients: [],
            sales: [],
            salesManual: null
        };
        this.conversationHistory = new ConversationHistory();
        this.loadBusinessData();
    }

    loadBusinessData() {
        try {
            // Try to load from context or use default data
            this.businessData = {
                products: this.getDefaultProducts(),
                clients: this.getDefaultClients(),
                sales: [],
                salesManual: this.getDefaultSalesManual()
            };
            console.log('✅ Business data loaded successfully!');
        } catch (error) {
            console.error('❌ Error loading business data:', error.message);
            this.businessData = {
                products: [],
                clients: [],
                sales: [],
                salesManual: { strategies: [], objections: [] }
            };
        }
    }

    loadFromSelectedDocs(docs) {
        if (!docs || !Array.isArray(docs)) return;
        
        docs.forEach(doc => {
            try {
                const data = JSON.parse(doc.pageContent || doc.content || '{}');
                if (data.productos) this.businessData.products = data.productos;
                if (data.clientes) this.businessData.clients = data.clientes;
                if (data.ventas) this.businessData.sales = data.ventas;
            } catch (error) {
                console.log('Could not parse document:', error.message);
            }
        });
    }

    async provideSalesConsultation(clientQuery, clientId = null) {
        try {
            const consultation = {
                query: clientQuery,
                clientAnalysis: clientId ? this.analyzeClient(clientId) : null,
                recommendations: this.recommendProducts(clientQuery, clientId),
                strategy: this.generateSalesStrategy(clientQuery, clientId),
                objectionHandling: this.prepareObjectionHandling(),
                followUp: this.createFollowUpPlan(clientId)
            };
            
            return this.formatConsultationResponse(consultation);
        } catch (error) {
            console.error('Error in sales consultation:', error);
            return `❌ Error en la consulta: ${error.message}`;
        }
    }

    recommendProducts(query, clientId = null) {
        const queryLower = query.toLowerCase();
        const recommendations = [];
        
        // Simple product matching logic
        this.businessData.products.forEach(product => {
            let score = 0;
            
            // Map JSON fields to expected fields
            const mappedProduct = {
                ...product,
                marca: product.brand || product.marca,
                modelo: product.name || product.modelo,
                categoria: product.category || product.categoria,
                descripcion: product.description || product.descripcion,
                precio: product.price_ars || product.precio
            };
            
            if (mappedProduct.marca && queryLower.includes(mappedProduct.marca.toLowerCase())) score += 3;
            if (mappedProduct.modelo && queryLower.includes(mappedProduct.modelo.toLowerCase())) score += 3;
            if (mappedProduct.categoria && queryLower.includes(mappedProduct.categoria.toLowerCase())) score += 2;
            if (mappedProduct.descripcion && queryLower.includes(mappedProduct.descripcion.toLowerCase())) score += 1;
            
            if (score > 0) {
                recommendations.push({ ...mappedProduct, relevanceScore: score });
            }
        });
        
        return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
    }

    generateSalesStrategy(query, clientId) {
        return {
            approach: 'Consultiva y orientada a soluciones',
            keyPoints: [
                'Identificar necesidades específicas del cliente',
                'Destacar beneficios de calidad y durabilidad',
                'Ofrecer garantía y servicio post-venta'
            ],
            pricing: 'Competitivo con valor agregado'
        };
    }

    prepareObjectionHandling() {
        return [
            {
                objection: 'Precio muy alto',
                response: 'Nuestros precios reflejan la calidad superior y garantía extendida que ofrecemos.'
            },
            {
                objection: 'Necesito pensarlo',
                response: 'Entiendo perfectamente. ¿Hay alguna información específica que le ayudaría a decidir?'
            }
        ];
    }

    createFollowUpPlan(clientId) {
        return {
            timeline: '48-72 horas',
            actions: [
                'Llamada de seguimiento',
                'Envío de cotización detallada',
                'Programar visita si es necesario'
            ]
        };
    }

    analyzeClient(clientId) {
        const client = this.businessData.clients.find(c => c.id === clientId);
        if (!client) return null;
        
        return {
            client,
            segment: 'Regular',
            totalSpent: 0,
            orderCount: 0,
            preferences: [],
            paymentBehavior: 'Puntual'
        };
    }

    formatConsultationResponse(consultation) {
        let response = `🚗 **CONSULTA DE VENTAS - GOMERÍA "EL RUTERO EXPERTO"** 🛞\n\n`;
        
        response += `**Consulta:** ${consultation.query}\n\n`;
        
        if (consultation.recommendations && consultation.recommendations.length > 0) {
            response += `**📦 PRODUCTOS RECOMENDADOS:**\n`;
            consultation.recommendations.forEach((product, index) => {
                response += `${index + 1}. **${product.marca || 'N/A'} ${product.modelo || ''}**\n`;
                response += `   - Categoría: ${product.categoria || 'N/A'}\n`;
                response += `   - Precio: $${product.precio || 'Consultar'}\n`;
                if (product.descripcion) {
                    response += `   - ${product.descripcion}\n`;
                }
                response += `\n`;
            });
        }
        
        if (consultation.strategy) {
            response += `**🎯 ESTRATEGIA DE VENTA:**\n`;
            response += `- Enfoque: ${consultation.strategy.approach}\n`;
            consultation.strategy.keyPoints.forEach(point => {
                response += `- ${point}\n`;
            });
            response += `\n`;
        }
        
        if (consultation.objectionHandling && consultation.objectionHandling.length > 0) {
            response += `**💬 MANEJO DE OBJECIONES:**\n`;
            consultation.objectionHandling.forEach(obj => {
                response += `**Objeción:** "${obj.objection}"\n`;
                response += `**Respuesta:** ${obj.response}\n\n`;
            });
        }
        
        if (consultation.followUp) {
            response += `**📅 PLAN DE SEGUIMIENTO:**\n`;
            response += `- Tiempo: ${consultation.followUp.timeline}\n`;
            consultation.followUp.actions.forEach(action => {
                response += `- ${action}\n`;
            });
        }
        
        return response;
    }

    getDefaultProducts() {
        return [
            {
                id: 'P001',
                marca: 'Bridgestone',
                modelo: 'Turanza T005',
                categoria: 'Automóvil',
                precio: 25000,
                descripcion: 'Neumático premium para automóviles'
            },
            {
                id: 'P002',
                marca: 'Michelin',
                modelo: 'Primacy 4',
                categoria: 'Automóvil',
                precio: 28000,
                descripcion: 'Neumático de alta performance'
            },
            {
                id: 'P003',
                marca: 'Pirelli',
                modelo: 'Scorpion ATR',
                categoria: 'Camioneta',
                precio: 35000,
                descripcion: 'Neumático todo terreno para camionetas'
            }
        ];
    }

    getDefaultClients() {
        return [
            {
                id: 'BIZ-001',
                nombre: 'Transportes López',
                tipo: 'Empresa',
                vehiculos: ['Toyota Hilux', 'Ford Ranger']
            }
        ];
    }

    getDefaultSalesManual() {
        return {
            strategies: ['Consultiva', 'Orientada a soluciones'],
            objections: ['Precio', 'Calidad', 'Tiempo de entrega']
        };
    }
}

// Main CodeAgent function
module.exports = async function(input, context) {
    try {
        // Initialize the sales agent
        const agent = new TireSalesAgent();
        
        // Load conversation history from context
        if (context.chatHistory && Array.isArray(context.chatHistory)) {
            context.chatHistory.forEach(msg => {
                if (msg.content) {
                    agent.conversationHistory.addMessage(
                        msg.type === 'user' ? 'user' : 'assistant',
                        msg.content,
                        { source: 'codeagent' }
                    );
                }
            });
        }
        
        // Load data from selected documents if available
        if (context.selectedDocuments) {
            agent.loadFromSelectedDocs(context.selectedDocuments);
        }
        
        // Process the user input
        let response = '';
        
        if (!input || !input.trim()) {
            response = `🚗 ¡Bienvenido a Gomería "El Rutero Experto"! 🛞\n\n` +
                      `Soy tu asistente especializado en ventas de neumáticos y servicios automotrices.\n\n` +
                      `¿En qué puedo ayudarte hoy?\n` +
                      `• Recomendaciones de neumáticos\n` +
                      `• Consultas sobre vehículos\n` +
                      `• Análisis de clientes\n` +
                      `• Estrategias de venta\n` +
                      `• Información de productos`;
        } else if (input.toLowerCase().includes('load_data') || input.toLowerCase().includes('cargar datos')) {
            // Handle data loading command
            response = `📊 Datos del negocio cargados:\n` +
                      `• ${agent.businessData.products.length} productos\n` +
                      `• ${agent.businessData.clients.length} clientes\n` +
                      `• ${agent.businessData.sales.length} registros de ventas\n` +
                      `• Manual de procedimientos cargado\n\n` +
                      `¿Cómo puedo ayudarte?`;
        } else if (input.toLowerCase().includes('consulta completa') || input.toLowerCase().includes('análisis completo')) {
            // Handle comprehensive sales consultation
            const consultation = await agent.provideSalesConsultation(input);
            response = consultation;
        } else {
            // Handle regular queries
            const consultation = await agent.provideSalesConsultation(input);
            response = consultation;
        }
        
        // Return in the format expected by TestChat
        console.log(JSON.stringify({ reply: response }));
        
        return {
            reply: response,
            message: response,
            timestamp: new Date().toISOString(),
            agent: 'Gomería El Rutero Experto',
            type: 'sales_consultation'
        };
        
    } catch (error) {
        console.error('Sales Agent Error:', error);
        const errorMsg = `❌ Error en el agente de ventas: ${error.message}\n\n` +
                        `Por favor, verifica que el archivo sales-agent.js esté disponible y correctamente configurado.`;
        
        console.log(JSON.stringify({ reply: errorMsg }));
        
        return {
            reply: errorMsg,
            message: errorMsg,
            error: true,
            timestamp: new Date().toISOString()
        };
    }
};
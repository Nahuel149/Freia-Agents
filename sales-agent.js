const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

/**
 * GOMERÍA "EL RUTERO EXPERTO" - ADVANCED AI SALES AGENT
 * 
 * This is a comprehensive sales agent that knows everything about the tire business.
 * It integrates product knowledge, client history, sales patterns, and B2B strategies
 * to provide expert sales guidance and recommendations.
 */

/**
 * Conversation History Management Class
 */
class ConversationHistory {
    constructor() {
        this.history = [];
        this.maxHistory = 50; // Keep last 50 exchanges
    }

    addMessage(role, content, metadata = {}) {
        this.history.push({
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata
        });
        
        // Keep only recent history
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

class TireSalesAgent {
    constructor() {
        this.businessData = {
            products: [],
            clients: [],
            sales: [],
            salesManual: null
        };
        this.conversationHistory = new ConversationHistory();
        this.totalCost = 0;
        this.loadBusinessData();
    }

    /**
     * Load all business data from JSON files or selected documents
     */
    loadBusinessData() {
        try {
            // Try to load from FLOWISE_SELECTED_DOCS first (CodeAgent integration)
            const selectedDocs = process.env.FLOWISE_SELECTED_DOCS;
            if (selectedDocs) {
                const docs = JSON.parse(selectedDocs);
                this.loadFromSelectedDocs(docs);
            } else {
                // Fallback to local files
                this.loadFromLocalFiles();
            }

            console.log('✅ Business data loaded successfully!');
            console.log(`📦 Products: ${this.businessData.products.length}`);
            console.log(`👥 Clients: ${this.businessData.clients.length}`);
            console.log(`💰 Sales records: ${this.businessData.sales.length}`);
        } catch (error) {
            console.error('❌ Error loading business data:', error.message);
            // Initialize with empty arrays to prevent crashes
            this.businessData = {
                products: [],
                clients: [],
                sales: [],
                salesManual: { strategies: [], objections: [] }
            };
        }
    }

    /**
     * Load data from selected documents (CodeAgent integration)
     */
    loadFromSelectedDocs(docs) {
        docs.forEach(doc => {
            try {
                const data = JSON.parse(doc.pageContent);
                const filename = doc.metadata?.source?.toLowerCase() || '';
                
                if (filename.includes('productos')) {
                    this.businessData.products = Array.isArray(data) ? data : [];
                } else if (filename.includes('clientes')) {
                    this.businessData.clients = Array.isArray(data) ? data : [];
                } else if (filename.includes('ventas')) {
                    this.businessData.sales = Array.isArray(data) ? data : [];
                } else if (filename.includes('manual')) {
                    this.businessData.salesManual = data || { strategies: [], objections: [] };
                }
            } catch (parseError) {
                console.warn(`⚠️ Could not parse document: ${parseError.message}`);
            }
        });
    }

    /**
     * Load data from local files (fallback method)
     */
    loadFromLocalFiles() {
        const files = [
            { path: 'productosgomerias.json', key: 'products' },
            { path: 'clientesgomeria.json', key: 'clients' },
            { path: 'ventasgomeria.json', key: 'sales' },
            { path: 'manualgomeria.json', key: 'salesManual' }
        ];

        files.forEach(file => {
            try {
                const filePath = path.join(__dirname, file.path);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                this.businessData[file.key] = data;
            } catch (error) {
                console.warn(`⚠️ Could not load ${file.path}: ${error.message}`);
                this.businessData[file.key] = file.key === 'salesManual' ? { strategies: [], objections: [] } : [];
            }
        });
    }

    /**
     * MAIN SALES CONSULTATION METHOD
     * This is the primary interface for sales consultations
     */
    async provideSalesConsultation(clientQuery, clientId = null) {
        console.log('🎯 Starting sales consultation...');
        
        const consultation = {
            clientAnalysis: null,
            productRecommendations: [],
            salesStrategy: null,
            pricing: null,
            objectionHandling: [],
            followUpPlan: null
        };

        // Analyze client if ID provided
        if (clientId) {
            consultation.clientAnalysis = this.analyzeClient(clientId);
        }

        // Analyze query and recommend products
        consultation.productRecommendations = this.recommendProducts(clientQuery, clientId);
        
        // Generate sales strategy
        consultation.salesStrategy = this.generateSalesStrategy(clientQuery, consultation.clientAnalysis);
        
        // Calculate pricing strategy
        consultation.pricing = this.calculatePricingStrategy(consultation.productRecommendations, clientId);
        
        // Prepare objection handling
        consultation.objectionHandling = this.prepareObjectionHandling();
        
        // Create follow-up plan
        consultation.followUpPlan = this.createFollowUpPlan(consultation.clientAnalysis);

        return this.formatConsultationResponse(consultation);
    }

    /**
     * DEEP CLIENT ANALYSIS
     * Analyzes client history, preferences, and business patterns
     */
    analyzeClient(clientId) {
        const client = this.businessData.clients.find(c => c.business_id === clientId);
        if (!client) {
            return { 
                error: 'Client not found', 
                recommendation: 'Treat as new prospect',
                client: null,
                totalLifetimeValue: 0,
                totalOrders: 0,
                averageOrderValue: 0,
                productPreferences: { brands: [], categories: [] },
                seasonalPatterns: {},
                paymentBehavior: {},
                lastPurchase: null,
                clientSegment: 'New'
            };
        }

        const clientSales = this.businessData.sales.filter(s => s.client_id === clientId);
        const totalSpent = clientSales.reduce((sum, sale) => sum + sale.total_amount_ars, 0);
        
        // Analyze purchase patterns
        const productPreferences = this.analyzeProductPreferences(clientSales);
        const seasonalPatterns = this.analyzeSeasonalPatterns(clientSales);
        const paymentBehavior = this.analyzePaymentBehavior(clientSales);

        return {
            client: client,
            totalLifetimeValue: totalSpent,
            totalOrders: clientSales.length,
            averageOrderValue: clientSales.length > 0 ? totalSpent / clientSales.length : 0,
            productPreferences: productPreferences,
            seasonalPatterns: seasonalPatterns,
            paymentBehavior: paymentBehavior,
            lastPurchase: clientSales.length > 0 ? clientSales[clientSales.length - 1] : null,
            clientSegment: this.determineClientSegment(client, totalSpent, clientSales.length)
        };
    }

    /**
     * INTELLIGENT PRODUCT RECOMMENDATION ENGINE
     * Uses AI-like logic to recommend the best products based on query and client history
     */
    recommendProducts(query, clientId = null) {
        const queryLower = query.toLowerCase();
        let recommendations = [];

        // Get client analysis for personalized recommendations
        const clientAnalysis = clientId ? this.analyzeClient(clientId) : null;

        // Search products by category, brand, or specifications
        const relevantProducts = this.businessData.products.filter(product => {
            const searchText = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
            
            // Check for direct matches
            if (searchText.includes(queryLower)) return true;
            
            // Check for tire size patterns (e.g., "205/55 R16")
            if (queryLower.match(/\d{3}\/\d{2}\s*r?\d{2}/)) {
                const sizePattern = queryLower.match(/\d{3}\/\d{2}\s*r?\d{2}/)[0];
                if (searchText.includes(sizePattern.replace(/\s/g, ''))) return true;
            }
            
            // Check for vehicle type matches
            const vehicleKeywords = ['camioneta', 'auto', 'moto', 'hilux', 'gol', 'corsa'];
            for (let keyword of vehicleKeywords) {
                if (queryLower.includes(keyword) && searchText.includes(keyword)) return true;
            }
            
            return false;
        });

        // Score and rank products
        recommendations = relevantProducts.map(product => {
            let score = 0;
            let reasons = [];

            // Base relevance score
            score += this.calculateRelevanceScore(product, queryLower);

            // Client history bonus
            if (clientAnalysis && clientAnalysis.productPreferences) {
                if (clientAnalysis.productPreferences.brands.includes(product.brand)) {
                    score += 20;
                    reasons.push(`Cliente prefiere marca ${product.brand}`);
                }
                if (clientAnalysis.productPreferences.categories.includes(product.category)) {
                    score += 15;
                    reasons.push(`Cliente compra frecuentemente ${product.category}`);
                }
            }

            // Stock availability
            if (product.stock > 50) {
                score += 10;
                reasons.push('Stock abundante disponible');
            } else if (product.stock < 10) {
                score -= 10;
                reasons.push('Stock limitado - urgente');
            }

            // Price competitiveness
            const avgPrice = this.getAveragePriceByCategory(product.category);
            if (product.price_ars < avgPrice * 0.9) {
                score += 15;
                reasons.push('Precio muy competitivo');
            }

            return {
                ...product,
                recommendationScore: score,
                recommendationReasons: reasons,
                suggestedQuantity: this.suggestQuantity(product, clientAnalysis),
                crossSellOpportunities: this.findCrossSellOpportunities(product)
            };
        });

        // Sort by score and return top recommendations
        return recommendations
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, 10);
    }

    /**
     * ADVANCED SALES STRATEGY GENERATOR
     * Creates personalized sales strategies based on client type and query
     */
    generateSalesStrategy(query, clientAnalysis) {
        const strategy = {
            approach: 'consultative',
            keyMessages: [],
            valueProposition: [],
            urgencyFactors: [],
            trustBuilders: []
        };

        // Determine approach based on client segment
        if (clientAnalysis) {
            switch (clientAnalysis.clientSegment) {
                case 'VIP':
                    strategy.approach = 'partnership';
                    strategy.keyMessages.push('Como cliente VIP, tenemos productos exclusivos para usted');
                    strategy.valueProposition.push('Acceso prioritario a nuevos productos');
                    strategy.valueProposition.push('Descuentos especiales por volumen');
                    break;
                    
                case 'Regular':
                    strategy.approach = 'relationship';
                    strategy.keyMessages.push('Valoramos su confianza en nosotros');
                    strategy.valueProposition.push('Calidad consistente que ya conoce');
                    break;
                    
                case 'New':
                    strategy.approach = 'educational';
                    strategy.keyMessages.push('Permítanos demostrarle por qué somos líderes en el sector');
                    strategy.valueProposition.push('Garantía de satisfacción para nuevos clientes');
                    strategy.trustBuilders.push('Referencias de clientes similares');
                    break;
            }
        }

        // Add query-specific strategies
        if (query.toLowerCase().includes('urgente') || query.toLowerCase().includes('necesito ya')) {
            strategy.urgencyFactors.push('Stock inmediato disponible');
            strategy.urgencyFactors.push('Entrega el mismo día');
        }

        if (query.toLowerCase().includes('precio') || query.toLowerCase().includes('barato')) {
            strategy.valueProposition.push('Mejor relación calidad-precio del mercado');
            strategy.valueProposition.push('Financiación disponible');
        }

        // Add B2B specific strategies from manual
        if (clientAnalysis && clientAnalysis.client && clientAnalysis.client.cuit) {
            strategy.keyMessages.push('Soluciones integrales para su flota');
            strategy.valueProposition.push('Reducción de costos operativos');
            strategy.valueProposition.push('Minimización de tiempo de inactividad');
            strategy.trustBuilders.push('Experiencia con flotas similares');
        }

        return strategy;
    }

    /**
     * DYNAMIC PRICING STRATEGY
     * Calculates optimal pricing based on client history and market conditions
     */
    calculatePricingStrategy(recommendations, clientId) {
        const clientAnalysis = clientId ? this.analyzeClient(clientId) : null;
        
        return recommendations.map(product => {
            let finalPrice = product.price_ars;
            let discountPercentage = 0;
            let discountReasons = [];

            // Volume discounts
            if (product.suggestedQuantity >= 20) {
                discountPercentage += 8;
                discountReasons.push('Descuento por volumen (20+ unidades)');
            } else if (product.suggestedQuantity >= 10) {
                discountPercentage += 5;
                discountReasons.push('Descuento por volumen (10+ unidades)');
            }

            // Client loyalty discounts
            if (clientAnalysis) {
                if (clientAnalysis.clientSegment === 'VIP') {
                    discountPercentage += 10;
                    discountReasons.push('Descuento cliente VIP');
                } else if (clientAnalysis.clientSegment === 'Regular') {
                    discountPercentage += 5;
                    discountReasons.push('Descuento cliente regular');
                }
            }

            // Stock clearance discounts
            if (product.stock > 100) {
                discountPercentage += 3;
                discountReasons.push('Descuento por stock abundante');
            }

            // Calculate final price
            finalPrice = product.price_ars * (1 - discountPercentage / 100);

            return {
                product_id: product.product_id,
                originalPrice: product.price_ars,
                finalPrice: Math.round(finalPrice),
                discountPercentage: discountPercentage,
                discountReasons: discountReasons,
                totalValue: Math.round(finalPrice * product.suggestedQuantity),
                paymentTerms: this.suggestPaymentTerms(clientAnalysis)
            };
        });
    }

    /**
     * OBJECTION HANDLING SYSTEM
     * Prepares responses for common sales objections
     */
    prepareObjectionHandling() {
        return [
            {
                objection: "Su precio es muy alto",
                response: "Entiendo su preocupación por el precio. Nuestros productos ofrecen un 15% más de durabilidad que la competencia, lo que significa menor costo por kilómetro. ¿Le gustaría que le muestre el análisis de costo total de propiedad?",
                evidence: "Datos de rendimiento de clientes similares"
            },
            {
                objection: "Ya tengo proveedor",
                response: "Perfecto, eso habla bien de su planificación. No pretendo que cambie inmediatamente. ¿Podríamos ser su proveedor de respaldo para emergencias? Así puede evaluar nuestro servicio sin comprometer su operación actual.",
                evidence: "Casos de éxito como proveedor secundario"
            },
            {
                objection: "Necesito pensarlo",
                response: "Por supuesto, es una decisión importante. ¿Hay algún aspecto específico que le genera dudas? Me gustaría asegurarme de que tenga toda la información necesaria para tomar la mejor decisión.",
                evidence: "Información adicional específica"
            },
            {
                objection: "No tengo presupuesto ahora",
                response: "Comprendo perfectamente. ¿Cuándo sería un mejor momento para revisar esto? Mientras tanto, puedo mantenerle reservado el stock y avisarle si hay alguna promoción especial.",
                evidence: "Opciones de financiamiento disponibles"
            }
        ];
    }

    /**
     * FOLLOW-UP PLAN GENERATOR
     * Creates personalized follow-up strategies
     */
    createFollowUpPlan(clientAnalysis) {
        const plan = {
            immediate: [],
            shortTerm: [],
            longTerm: []
        };

        // Immediate actions (same day)
        plan.immediate.push('Enviar cotización detallada por email');
        plan.immediate.push('Confirmar disponibilidad de stock');
        
        if (clientAnalysis && clientAnalysis.clientSegment === 'New') {
            plan.immediate.push('Enviar referencias de clientes similares');
        }

        // Short-term actions (1-7 days)
        plan.shortTerm.push('Llamada de seguimiento en 2-3 días');
        plan.shortTerm.push('Verificar si necesita información adicional');
        
        if (clientAnalysis && clientAnalysis.lastPurchase) {
            const daysSinceLastPurchase = this.daysSince(clientAnalysis.lastPurchase.sale_date);
            if (daysSinceLastPurchase > 90) {
                plan.shortTerm.push('Ofrecer revisión de productos anteriores');
            }
        }

        // Long-term actions (1-4 weeks)
        plan.longTerm.push('Revisión mensual de necesidades');
        plan.longTerm.push('Invitación a eventos o promociones especiales');
        
        if (clientAnalysis && clientAnalysis.client && clientAnalysis.client.cuit) {
            plan.longTerm.push('Propuesta de acuerdo anual de suministro');
        }

        return plan;
    }

    // UTILITY METHODS

    analyzeProductPreferences(clientSales) {
        const brands = {};
        const categories = {};
        
        clientSales.forEach(sale => {
            sale.items_sold.forEach(item => {
                const product = this.businessData.products.find(p => p.product_id === item.product_id);
                if (product) {
                    brands[product.brand] = (brands[product.brand] || 0) + item.quantity;
                    categories[product.category] = (categories[product.category] || 0) + item.quantity;
                }
            });
        });

        return {
            brands: Object.keys(brands).sort((a, b) => brands[b] - brands[a]),
            categories: Object.keys(categories).sort((a, b) => categories[b] - categories[a])
        };
    }

    analyzeSeasonalPatterns(clientSales) {
        const monthlyPurchases = {};
        
        clientSales.forEach(sale => {
            const month = new Date(sale.sale_date).getMonth();
            monthlyPurchases[month] = (monthlyPurchases[month] || 0) + 1;
        });

        return monthlyPurchases;
    }

    analyzePaymentBehavior(clientSales) {
        const methods = {};
        
        clientSales.forEach(sale => {
            methods[sale.payment_method] = (methods[sale.payment_method] || 0) + 1;
        });

        return methods;
    }

    determineClientSegment(client, totalSpent, orderCount) {
        if (totalSpent > 10000000 && orderCount > 5) return 'VIP';
        if (totalSpent > 2000000 && orderCount > 2) return 'Regular';
        return 'New';
    }

    calculateRelevanceScore(product, query) {
        let score = 0;
        const searchableText = `${product.name} ${product.brand} ${product.description}`.toLowerCase();
        
        // Exact matches get highest score
        if (searchableText.includes(query)) score += 50;
        
        // Brand matches
        if (query.includes(product.brand.toLowerCase())) score += 30;
        
        // Category matches
        if (query.includes(product.category.toLowerCase())) score += 25;
        
        return score;
    }

    getAveragePriceByCategory(category) {
        const categoryProducts = this.businessData.products.filter(p => p.category === category);
        const totalPrice = categoryProducts.reduce((sum, p) => sum + p.price_ars, 0);
        return categoryProducts.length > 0 ? totalPrice / categoryProducts.length : 0;
    }

    suggestQuantity(product, clientAnalysis) {
        let baseQuantity = 4; // Default for tires
        
        if (product.category === 'Servicio') return 1;
        if (product.category === 'Accesorio') return 2;
        
        if (clientAnalysis) {
            if (clientAnalysis.clientSegment === 'VIP') baseQuantity *= 3;
            else if (clientAnalysis.clientSegment === 'Regular') baseQuantity *= 2;
        }
        
        return baseQuantity;
    }

    findCrossSellOpportunities(product) {
        const opportunities = [];
        
        if (product.category === 'Neumático') {
            opportunities.push('Servicio de alineación y balanceo');
            opportunities.push('Kit de seguridad reglamentario');
            opportunities.push('Válvulas y cámaras');
        }
        
        if (product.category === 'Repuesto' && product.name.includes('Aceite')) {
            opportunities.push('Filtro de aceite');
            opportunities.push('Servicio de cambio de aceite');
        }
        
        return opportunities;
    }

    suggestPaymentTerms(clientAnalysis) {
        if (!clientAnalysis) return ['Contado', 'Tarjeta de crédito'];
        
        const terms = ['Contado'];
        
        if (clientAnalysis.clientSegment === 'VIP') {
            terms.push('Cuenta corriente 60 días');
            terms.push('Financiación especial');
        } else if (clientAnalysis.clientSegment === 'Regular') {
            terms.push('Cuenta corriente 30 días');
        }
        
        terms.push('Tarjeta de crédito');
        terms.push('Transferencia bancaria');
        
        return terms;
    }

    daysSince(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        return Math.floor((now - date) / (1000 * 60 * 60 * 24));
    }

    /**
     * FORMAT CONSULTATION RESPONSE
     * Creates a comprehensive, professional sales consultation report
     */
    formatConsultationResponse(consultation) {
        let response = "\n🎯 CONSULTA DE VENTAS - GOMERÍA 'EL RUTERO EXPERTO'\n";
        response += "=".repeat(60) + "\n\n";

        // Client Analysis
        if (consultation.clientAnalysis && !consultation.clientAnalysis.error) {
            const client = consultation.clientAnalysis;
            response += "👤 ANÁLISIS DEL CLIENTE\n";
            response += "-".repeat(25) + "\n";
            response += `Empresa: ${client.client.business_name}\n`;
            response += `Segmento: ${client.clientSegment}\n`;
            response += `Valor total histórico: $${client.totalLifetimeValue.toLocaleString()}\n`;
            response += `Órdenes totales: ${client.totalOrders}\n`;
            response += `Valor promedio por orden: $${client.averageOrderValue.toLocaleString()}\n`;
            
            if (client.productPreferences.brands.length > 0) {
                response += `Marcas preferidas: ${client.productPreferences.brands.slice(0, 3).join(', ')}\n`;
            }
            response += "\n";
        }

        // Product Recommendations
        if (consultation.productRecommendations.length > 0) {
            response += "🛞 RECOMENDACIONES DE PRODUCTOS\n";
            response += "-".repeat(35) + "\n";
            
            consultation.productRecommendations.slice(0, 5).forEach((product, index) => {
                response += `${index + 1}. ${product.brand} ${product.name}\n`;
                response += `   💰 Precio: $${product.price_ars.toLocaleString()}\n`;
                response += `   📦 Stock: ${product.stock} unidades\n`;
                response += `   ⭐ Score: ${product.recommendationScore}/100\n`;
                response += `   📝 Razones: ${product.recommendationReasons.join(', ')}\n`;
                response += `   🔢 Cantidad sugerida: ${product.suggestedQuantity}\n`;
                if (product.crossSellOpportunities.length > 0) {
                    response += `   🔗 Venta cruzada: ${product.crossSellOpportunities.join(', ')}\n`;
                }
                response += "\n";
            });
        }

        // Sales Strategy
        if (consultation.salesStrategy) {
            const strategy = consultation.salesStrategy;
            response += "🎯 ESTRATEGIA DE VENTAS\n";
            response += "-".repeat(25) + "\n";
            response += `Enfoque: ${strategy.approach.toUpperCase()}\n\n`;
            
            if (strategy.keyMessages.length > 0) {
                response += "Mensajes clave:\n";
                strategy.keyMessages.forEach(msg => response += `• ${msg}\n`);
                response += "\n";
            }
            
            if (strategy.valueProposition.length > 0) {
                response += "Propuesta de valor:\n";
                strategy.valueProposition.forEach(prop => response += `• ${prop}\n`);
                response += "\n";
            }
        }

        // Pricing Strategy
        if (consultation.pricing && consultation.pricing.length > 0) {
            response += "💰 ESTRATEGIA DE PRECIOS\n";
            response += "-".repeat(28) + "\n";
            
            consultation.pricing.slice(0, 3).forEach(pricing => {
                const product = consultation.productRecommendations.find(p => p.product_id === pricing.product_id);
                if (product) {
                    response += `${product.name}:\n`;
                    response += `  Precio original: $${pricing.originalPrice.toLocaleString()}\n`;
                    response += `  Precio final: $${pricing.finalPrice.toLocaleString()}`;
                    if (pricing.discountPercentage > 0) {
                        response += ` (${pricing.discountPercentage}% desc.)`;
                    }
                    response += "\n";
                    response += `  Valor total: $${pricing.totalValue.toLocaleString()}\n`;
                    if (pricing.discountReasons.length > 0) {
                        response += `  Descuentos: ${pricing.discountReasons.join(', ')}\n`;
                    }
                    response += "\n";
                }
            });
        }

        // Objection Handling
        response += "🛡️ MANEJO DE OBJECIONES\n";
        response += "-".repeat(25) + "\n";
        consultation.objectionHandling.slice(0, 3).forEach(objection => {
            response += `❓ "${objection.objection}"\n`;
            response += `💬 Respuesta: ${objection.response}\n\n`;
        });

        // Follow-up Plan
        if (consultation.followUpPlan) {
            response += "📅 PLAN DE SEGUIMIENTO\n";
            response += "-".repeat(25) + "\n";
            
            response += "Acciones inmediatas:\n";
            consultation.followUpPlan.immediate.forEach(action => response += `• ${action}\n`);
            
            response += "\nCorto plazo (1-7 días):\n";
            consultation.followUpPlan.shortTerm.forEach(action => response += `• ${action}\n`);
            
            response += "\nLargo plazo (1-4 semanas):\n";
            consultation.followUpPlan.longTerm.forEach(action => response += `• ${action}\n`);
        }

        response += "\n" + "=".repeat(60) + "\n";
        response += "🏆 ¡El crecimiento de nuestros clientes es nuestro crecimiento!\n";
        
        return response;
    }

    /**
     * Enhanced semantic search for products with relevance scoring
     */
    searchProducts(query, limit = 10) {
        if (!this.businessData.products || this.businessData.products.length === 0) {
            return [];
        }
        
        const searchTerms = query.toLowerCase().split(' ');
        const results = this.businessData.products.map(product => {
            const productText = `${product.name} ${product.brand} ${product.category} ${product.description || ''}`.toLowerCase();
            
            // Calculate relevance score
            let score = 0;
            searchTerms.forEach(term => {
                if (productText.includes(term)) {
                    // Boost score for exact matches in name/brand
                    if (product.name.toLowerCase().includes(term) || product.brand.toLowerCase().includes(term)) {
                        score += 3;
                    } else if (product.category.toLowerCase().includes(term)) {
                        score += 2;
                    } else {
                        score += 1;
                    }
                }
            });
            
            return { ...product, relevanceScore: score };
        }).filter(product => product.relevanceScore > 0)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, limit);
        
        return results.map(product => ({
            id: product.product_id,
            name: `${product.brand} ${product.name}`,
            price: product.price_ars,
            stock: product.stock,
            category: product.category,
            relevanceScore: product.relevanceScore
        }));
    }
    
    /**
     * Semantic search across all business data
     */
    semanticSearch(query, dataTypes = ['products', 'clients', 'sales']) {
        const results = {
            products: [],
            clients: [],
            sales: [],
            manual: []
        };
        
        const searchTerms = query.toLowerCase().split(' ');
        
        // Search products
        if (dataTypes.includes('products') && this.businessData.products) {
            results.products = this.searchProducts(query, 5);
        }
        
        // Search clients
        if (dataTypes.includes('clients') && this.businessData.clients) {
            results.clients = this.businessData.clients.filter(client => {
                const clientText = `${client.business_name} ${client.contact_person || ''} ${client.email || ''} ${client.phone || ''}`.toLowerCase();
                return searchTerms.some(term => clientText.includes(term));
            }).slice(0, 5);
        }
        
        // Search sales
        if (dataTypes.includes('sales') && this.businessData.sales) {
            results.sales = this.businessData.sales.filter(sale => {
                const saleText = `${sale.client_id} ${sale.notes || ''}`.toLowerCase();
                return searchTerms.some(term => saleText.includes(term));
            }).slice(0, 5);
        }
        
        // Search manual/documentation
        if (dataTypes.includes('manual') && this.businessData.salesManual) {
            const manualText = JSON.stringify(this.businessData.salesManual).toLowerCase();
            if (searchTerms.some(term => manualText.includes(term))) {
                // Extract relevant sections
                const sections = this.extractRelevantSections(this.businessData.salesManual, searchTerms);
                results.manual = sections;
            }
        }
        
        return results;
    }
    
    /**
     * Extract relevant sections from manual/documentation
     */
    extractRelevantSections(manual, searchTerms) {
        const sections = [];
        
        // Search in strategies
        if (manual.strategies) {
            manual.strategies.forEach((strategy, index) => {
                const strategyText = JSON.stringify(strategy).toLowerCase();
                const relevance = searchTerms.filter(term => strategyText.includes(term)).length;
                if (relevance > 0) {
                    sections.push({
                        type: 'strategy',
                        content: strategy,
                        index: index,
                        relevance: relevance
                    });
                }
            });
        }
        
        // Search in objections
        if (manual.objections) {
            manual.objections.forEach((objection, index) => {
                const objectionText = JSON.stringify(objection).toLowerCase();
                const relevance = searchTerms.filter(term => objectionText.includes(term)).length;
                if (relevance > 0) {
                    sections.push({
                        type: 'objection',
                        content: objection,
                        index: index,
                        relevance: relevance
                    });
                }
            });
        }
        
        return sections.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
    }
    
    /**
     * Get contextual information for enhanced responses
     */
    getContextualInfo(query) {
        const context = {
            relevantProducts: [],
            relevantClients: [],
            relevantSales: [],
            manualSections: [],
            businessInsights: {}
        };
        
        // Perform semantic search
        const searchResults = this.semanticSearch(query);
        
        context.relevantProducts = searchResults.products;
        context.relevantClients = searchResults.clients;
        context.relevantSales = searchResults.sales;
        context.manualSections = searchResults.manual;
        
        // Add business insights
        context.businessInsights = {
            totalProducts: this.businessData.products.length,
            totalClients: this.businessData.clients.length,
            totalSales: this.businessData.sales.length,
            topCategories: this.getTopCategories(),
            recentSales: this.getRecentSales(5)
        };
        
        return context;
    }
    
    /**
     * Get top product categories
     */
    getTopCategories() {
        if (!this.businessData.products) return [];
        
        const categoryCount = {};
        this.businessData.products.forEach(product => {
            const category = product.category || 'Sin categoría';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([category, count]) => ({ category, count }));
    }
    
    /**
     * Get recent sales
     */
    getRecentSales(limit = 5) {
        if (!this.businessData.sales) return [];
        
        return this.businessData.sales
            .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
            .slice(0, limit);
    }

    /**
     * CLIENT LOOKUP
     * Quick client information retrieval
     */
    findClient(query) {
        const results = this.businessData.clients.filter(client => {
            const searchText = `${client.business_name} ${client.contact_person} ${client.cuit}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        });

        return results.map(client => ({
            id: client.business_id,
            name: client.business_name,
            contact: client.contact_person,
            phone: client.phone,
            email: client.email
        }));
    }

    /**
     * SALES ANALYTICS
     * Generate business insights and reports
     */
    generateSalesReport() {
        const totalSales = this.businessData.sales.reduce((sum, sale) => sum + sale.total_amount_ars, 0);
        const avgOrderValue = totalSales / this.businessData.sales.length;
        
        // Top products
        const productSales = {};
        this.businessData.sales.forEach(sale => {
            sale.items_sold.forEach(item => {
                productSales[item.product_id] = (productSales[item.product_id] || 0) + item.quantity;
            });
        });
        
        const topProducts = Object.entries(productSales)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([productId, quantity]) => {
                const product = this.businessData.products.find(p => p.product_id === productId);
                return { product: product?.name || productId, quantity };
            });

        // Top clients
        const clientSales = {};
        this.businessData.sales.forEach(sale => {
            clientSales[sale.client_id] = (clientSales[sale.client_id] || 0) + sale.total_amount_ars;
        });
        
        const topClients = Object.entries(clientSales)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([clientId, total]) => {
                const client = this.businessData.clients.find(c => c.business_id === clientId);
                return { client: client?.business_name || clientId, total };
            });

        return {
            totalSales: totalSales,
            totalOrders: this.businessData.sales.length,
            averageOrderValue: avgOrderValue,
            topProducts: topProducts,
            topClients: topClients
        };
    }
}

// USAGE EXAMPLES AND TESTING
if (require.main === module) {
    const agent = new TireSalesAgent();
    
    console.log('🚀 Gomería "El Rutero Experto" - AI Sales Agent Initialized!');
    console.log('\n📊 Business Overview:');
    const report = agent.generateSalesReport();
    console.log(`Total Sales: $${report.totalSales.toLocaleString()}`);
    console.log(`Total Orders: ${report.totalOrders}`);
    console.log(`Average Order: $${Math.round(report.averageOrderValue).toLocaleString()}`);
    
    // Example consultation
    console.log('\n🎯 Example Consultation:');
    agent.provideSalesConsultation('Necesito cubiertas para Toyota Hilux', 'BIZ-001')
        .then(consultation => {
            console.log(consultation);
        });
}

/**
 * Web Search Integration
 * Provides real-time information to enhance sales responses
 */
class WebSearchService {
    constructor() {
        this.searchEngines = {
            duckduckgo: 'https://api.duckduckgo.com/',
            brave: process.env.BRAVE_SEARCH_API_URL || 'https://api.search.brave.com/res/v1/web/search',
            google: process.env.GOOGLE_SEARCH_API_URL || 'https://www.googleapis.com/customsearch/v1'
        };
        this.apiKeys = {
            brave: process.env.BRAVE_API_KEY,
            google: process.env.GOOGLE_API_KEY
        };
    }

    /**
     * Perform web search using available search engines
     */
    async search(query, options = {}) {
        const { maxResults = 5, engine = 'auto', language = 'auto' } = options;
        
        try {
            // Try Brave Search first if API key is available
            if (this.apiKeys.brave && (engine === 'brave' || engine === 'auto')) {
                return await this.searchBrave(query, maxResults, language);
            }
            
            // Try Google Search if API key is available
            if (this.apiKeys.google && (engine === 'google' || engine === 'auto')) {
                return await this.searchGoogle(query, maxResults, language);
            }
            
            // Fallback to DuckDuckGo (no API key required)
            return await this.searchDuckDuckGo(query, maxResults);
            
        } catch (error) {
            console.error('Web search error:', error.message);
            return {
                results: [],
                error: 'No se pudo realizar la búsqueda web en este momento'
            };
        }
    }

    /**
     * Search using Brave Search API
     */
    async searchBrave(query, maxResults, language) {
        const url = new URL(this.searchEngines.brave);
        url.searchParams.append('q', query);
        url.searchParams.append('count', maxResults.toString());
        url.searchParams.append('country', language === 'es' ? 'AR' : 'US');
        
        const options = {
            method: 'GET',
            headers: {
                'X-Subscription-Token': this.apiKeys.brave,
                'Accept': 'application/json'
            }
        };
        
        const response = await this.makeRequest(url.toString(), options);
        const data = JSON.parse(response);
        
        return {
            results: data.web?.results?.slice(0, maxResults).map(result => ({
                title: result.title,
                url: result.url,
                snippet: result.description,
                source: 'Brave Search'
            })) || [],
            query: query,
            source: 'brave'
        };
    }

    /**
     * Search using Google Custom Search API
     */
    async searchGoogle(query, maxResults, language) {
        const url = new URL(this.searchEngines.google);
        url.searchParams.append('key', this.apiKeys.google);
        url.searchParams.append('cx', process.env.GOOGLE_SEARCH_ENGINE_ID || '');
        url.searchParams.append('q', query);
        url.searchParams.append('num', maxResults.toString());
        url.searchParams.append('lr', language === 'es' ? 'lang_es' : 'lang_en');
        
        const response = await this.makeRequest(url.toString());
        const data = JSON.parse(response);
        
        return {
            results: data.items?.slice(0, maxResults).map(result => ({
                title: result.title,
                url: result.link,
                snippet: result.snippet,
                source: 'Google Search'
            })) || [],
            query: query,
            source: 'google'
        };
    }

    /**
     * Search using DuckDuckGo Instant Answer API (limited but free)
     */
    async searchDuckDuckGo(query, maxResults) {
        const url = `${this.searchEngines.duckduckgo}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        
        const response = await this.makeRequest(url);
        const data = JSON.parse(response);
        
        const results = [];
        
        // Add abstract if available
        if (data.Abstract) {
            results.push({
                title: data.Heading || 'Información general',
                url: data.AbstractURL || '#',
                snippet: data.Abstract,
                source: 'DuckDuckGo'
            });
        }
        
        // Add related topics
        if (data.RelatedTopics) {
            data.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
                if (topic.Text && topic.FirstURL) {
                    results.push({
                        title: topic.Text.split(' - ')[0] || 'Tema relacionado',
                        url: topic.FirstURL,
                        snippet: topic.Text,
                        source: 'DuckDuckGo'
                    });
                }
            });
        }
        
        return {
            results: results.slice(0, maxResults),
            query: query,
            source: 'duckduckgo'
        };
    }

    /**
     * Make HTTP request using Node.js built-in modules
     */
    makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };
            
            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }

    /**
     * Search for tire-related information
     */
    async searchTireInfo(query, vehicleModel = '', language = 'es') {
        const tireTerms = {
            'es': 'neumáticos Argentina',
            'en': 'tires Argentina',
            'pt': 'pneus Argentina'
        };
        
        const tireTerm = tireTerms[language] || tireTerms['es'];
        const searchQuery = vehicleModel 
            ? `${query} ${vehicleModel} ${tireTerm}`
            : `${query} ${tireTerm}`;
            
        const results = await this.search(searchQuery, { maxResults: 3, language });
        
        return {
            ...results,
            context: 'tire_information',
            enhancedQuery: searchQuery
        };
    }

    /**
     * Search for market prices and competitor information
     */
    async searchMarketInfo(productName, brand = '', language = 'es') {
        const priceTerms = {
            'es': 'precio',
            'en': 'price',
            'pt': 'preço'
        };
        
        const marketTerms = {
            'es': 'mercado',
            'en': 'market',
            'pt': 'mercado'
        };
        
        const priceTerm = priceTerms[language] || priceTerms['es'];
        const marketTerm = marketTerms[language] || marketTerms['es'];
        
        const searchQuery = brand 
            ? `${productName} ${brand} ${priceTerm} Argentina 2024`
            : `${productName} ${priceTerm} ${marketTerm} Argentina 2024`;
            
        const results = await this.search(searchQuery, { maxResults: 3, language });
        
        return {
            ...results,
            context: 'market_pricing',
            enhancedQuery: searchQuery
        };
    }
}

// Global web search service instance
const webSearchService = new WebSearchService();

/**
 * Enhanced LLM completion function with conversation history and multiple modes
 * - Reads env: OPENAI_API_KEY, OPENAI_BASE_URL (optional)
 * - Uses CODEAGENT_MODEL (default gpt-4o-mini), CODEAGENT_TEMPERATURE (default 0.2)
 */
async function llmComplete({ system, user, messages = [], mode = 'default', temperature = null }) {
  if (!process.env.OPENAI_API_KEY) return { reply: '', cost: 0, error: null }
  
  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    })
    
    // Model selection based on mode
    let model = process.env.CODEAGENT_MODEL || 'gpt-4o-mini'
    if (mode === 'think') {
      model = 'o1-mini' // Use reasoning model for think mode
    }
    
    const temp = temperature !== null ? temperature : parseFloat(process.env.CODEAGENT_TEMPERATURE || '0.2')
    
    // Build message array
    const messageArray = []
    if (system && mode !== 'think') {
      messageArray.push({ role: 'system', content: system })
      console.log('🔍 DEBUG - System prompt language check:', system.includes('You are') ? 'English' : system.includes('Eres') ? 'Spanish' : 'Unknown')
    }
    
    // Add conversation history
    if (messages && messages.length > 0) {
      messageArray.push(...messages)
    }
    
    // Add current user message
    if (user) {
      if (mode === 'think' && system) {
        // For o1 models, combine system and user messages
        messageArray.push({ role: 'user', content: `${system}\n\n${user}` })
      } else {
        messageArray.push({ role: 'user', content: user })
      }
    }
    
    // API call parameters
    const params = {
      model,
      messages: messageArray
    }
    
    // Add temperature only for non-o1 models
    if (!model.startsWith('o1')) {
      params.temperature = temp
    }
    
    const resp = await client.chat.completions.create(params)
    
    const reply = (resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || ''
    
    // Calculate approximate cost (simplified)
    const inputTokens = JSON.stringify(messageArray).length / 4 // rough estimate
    const outputTokens = reply.length / 4 // rough estimate
    const cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000 // approximate GPT-4 pricing
    
    return { reply: reply || '', cost, error: null, usage: resp.usage }
  } catch (error) {
    return { reply: '', cost: 0, error: error.message }
  }
}

/**
 * Main chat processing function that orchestrates all features
 * Similar to get_chat_response in chat.py
 */
async function getChatResponseMain(userInput, conversationHistory = [], systemPrompt = '', context = {}, mode = 'auto') {
  try {
    // Initialize conversation history if not provided
    const messages = conversationHistory || [];
    
    // Extract client ID if present in the input
    const clientId = extractClientId(userInput);
    
    // Determine processing mode if auto
    let processingMode = mode;
    if (mode === 'auto') {
      processingMode = determineProcessingMode(userInput);
    }
    
    // Log processing information
    console.log(`\n=== PROCESANDO CONSULTA ===`);
    console.log(`Modo: ${processingMode}`);
    console.log(`Cliente ID: ${clientId || 'No detectado'}`);
    console.log(`Input: ${userInput.substring(0, 100)}${userInput.length > 100 ? '...' : ''}`);
    
    // Process based on mode
    let result;
    switch (processingMode) {
      case 'think':
        result = await processThinkRequest(userInput, messages, systemPrompt, context);
        break;
      case 'deepsearch':
        result = await processDeepSearchRequest(userInput, messages, systemPrompt, context);
        break;
      case 'deepersearch':
        result = await processDeeperSearchRequest(userInput, messages, systemPrompt, context);
        break;
      default:
        result = await processDefaultRequest(userInput, messages, systemPrompt, context);
        break;
    }
    
    // Add conversation to history
    if (result.reply && !result.error) {
      messages.push({ role: 'user', content: userInput });
      messages.push({ role: 'assistant', content: result.reply });
    }
    
    // Return comprehensive result
    return {
      ...result,
      conversationHistory: messages,
      clientId: clientId,
      processingMode: processingMode,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in getChatResponseMain:', error);
    return {
      reply: 'Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, inténtalo de nuevo.',
      error: error.message,
      cost: 0,
      mode: 'error',
      conversationHistory: conversationHistory,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Determine the appropriate processing mode based on user input
 */
function determineProcessingMode(userInput, explicitMode = 'auto') {
  if (explicitMode !== 'auto') {
    return explicitMode;
  }
  
  const input = userInput.toLowerCase();
  
  // Check for explicit mode commands (like chat.py)
  if (input.startsWith('/think ') || input.startsWith('/t ')) {
    return 'think';
  }
  if (input.startsWith('/deepsearch ') || input.startsWith('/ds ')) {
    return 'deepsearch';
  }
  if (input.startsWith('/deepersearch ') || input.startsWith('/dds ') || input.startsWith('\\deepersearch ') || input.startsWith('\\dds ')) {
    return 'deepersearch';
  }
  
  // Keywords that suggest deeper analysis
  const deepSearchKeywords = ['análisis', 'comparar', 'comparación', 'evaluar', 'evaluación', 'recomendación detallada', 'opciones', 'research', 'investigate'];
  const deeperSearchKeywords = ['exhaustivo', 'completo', 'profundo', 'estrategia', 'plan', 'optimización', 'máximo detalle', 'comprehensive', 'thorough'];
  const thinkKeywords = ['pensar', 'reflexionar', 'considerar', 'analizar paso a paso', 'explicar proceso', 'think', 'analyze', 'reasoning'];
  
  // Check for explicit mode requests
  if (input.includes('modo think') || input.includes('modo pensamiento') || thinkKeywords.some(keyword => input.includes(keyword))) {
    return 'think';
  }
  
  if (input.includes('búsqueda exhaustiva') || input.includes('análisis completo') || deeperSearchKeywords.some(keyword => input.includes(keyword))) {
    return 'deepersearch';
  }
  
  if (input.includes('búsqueda profunda') || input.includes('información detallada') || deepSearchKeywords.some(keyword => input.includes(keyword))) {
    return 'deepsearch';
  }
  
  // Default mode for simple queries
  return 'default';
}

/**
 * Enhanced chat processing function that handles different modes and conversation flow
 */
async function getChatResponse(userInput, chatHistory = [], mode = 'default', context = {}) {
  try {
    // Process conversation history into OpenAI format
    const messages = chatHistory.map(msg => ({
      role: msg.role || (msg.type === 'human' ? 'user' : 'assistant'),
      content: msg.content || msg.message || ''
    })).filter(msg => msg.content.trim())
    
    // Determine processing mode
    let processingMode = mode
    if (userInput.toLowerCase().includes('piensa') || userInput.toLowerCase().includes('analiza profundamente')) {
      processingMode = 'think'
    } else if (userInput.toLowerCase().includes('busca información') || userInput.toLowerCase().includes('investiga')) {
      processingMode = 'deepsearch'
    }
    
    // Build system prompt based on context and mode
    let systemPrompt = buildSystemPrompt(context, processingMode, userInput)
    
    // Process based on mode
    switch (processingMode) {
      case 'think':
        return await processThinkRequest(userInput, messages, systemPrompt, context)
      case 'deepsearch':
        return await processDeepSearchRequest(userInput, messages, systemPrompt, context)
      case 'deepersearch':
        return await processDeeperSearchRequest(userInput, messages, systemPrompt, context)
      default:
        return await processDefaultRequest(userInput, messages, systemPrompt, context)
    }
  } catch (error) {
    return {
      reply: `Error procesando la consulta: ${error.message}`,
      cost: 0,
      error: error.message,
      mode: mode
    }
  }
}

/**
 * Build system prompt based on context and mode
 */
// Detecta la intención del cliente basándose en su consulta
function detectIntent(userInput) {
  const input = userInput.toLowerCase();
  
  // Intenciones de compra
  if (input.match(/(necesito|quiero|busco|comprar|precio|costo|cuanto|vale).*?(cubierta|neumático|llanta|goma)/)) {
    return 'purchase_intent';
  }
  
  // Consultas técnicas
  if (input.match(/(medida|tamaño|especificación|compatible|presión|índice|velocidad|carga)/)) {
    return 'technical_inquiry';
  }
  
  // Comparación de productos
  if (input.match(/(comparar|diferencia|mejor|recomienda|versus|vs|cual)/)) {
    return 'product_comparison';
  }
  
  // Problemas o quejas
  if (input.match(/(problema|defecto|garantía|reclamo|devolver|cambiar|falla)/)) {
    return 'complaint_support';
  }
  
  // Información general
  if (input.match(/(información|horario|ubicación|contacto|servicio|instalación)/)) {
    return 'general_info';
  }
  
  return 'general_inquiry';
}

// Detecta el tipo de cliente basándose en su consulta y contexto
function detectCustomerPersona(userInput, clientId = null, context = {}) {
  const input = userInput.toLowerCase();
  
  // Cliente comercial/empresarial
  if (input.match(/(flota|empresa|comercial|camión|camioneta|trabajo|negocio|factura)/)) {
    return 'business_customer';
  }
  
  // Cliente particular con conocimiento técnico
  if (input.match(/(especificación|índice|presión|compound|tread|sidewall|ply)/)) {
    return 'technical_customer';
  }
  
  // Cliente sensible al precio
  if (input.match(/(barato|económico|precio|descuento|oferta|promoción|financiación)/)) {
    return 'price_sensitive';
  }
  
  // Cliente premium/calidad
  if (input.match(/(premium|calidad|marca|mejor|duración|garantía|confiable)/)) {
    return 'quality_focused';
  }
  
  // Cliente urgente
  if (input.match(/(urgente|rápido|hoy|ahora|inmediato|emergencia)/)) {
    return 'urgent_customer';
  }
  
  return 'regular_customer';
}

function buildSystemPrompt(context, mode, userInput = '', clientId = null) {
  const intent = detectIntent(userInput);
  const persona = detectCustomerPersona(userInput, clientId, context);
  const language = detectLanguage(userInput);
  const messages = getLocalizedMessages(language);
  
  let basePrompt = `${messages.systemRole}

${messages.businessData}:
- ${messages.availableProducts}: ${context.products ? context.products.length : 0}
- ${messages.registeredClients}: ${context.clients ? context.clients.length : 0}
- ${messages.salesHistory}: ${context.sales ? context.sales.length : 0}

${messages.objectives}:
1. ${messages.helpClients}
2. ${messages.recommendProducts}
3. ${messages.providePricing}
4. ${messages.generateStrategies}
5. ${messages.handleObjections}`;

  // Personalización basada en intención
  switch (intent) {
    case 'purchase_intent':
      basePrompt += `\n\n🎯 ${messages.intentDetected}: ${messages.purchaseIntent}
- ${messages.focusOnClosing}
- ${messages.presentOptions}
- ${messages.offerPromotions}`;
      break;
    case 'technical_inquiry':
      basePrompt += `\n\n🔧 ${messages.intentDetected}: ${messages.technicalInquiry}
- ${messages.provideTechnical}
- ${messages.explainSpecs}
- ${messages.usePreciseTerms}`;
      break;
    case 'product_comparison':
      basePrompt += `\n\n⚖️ ${messages.intentDetected}: ${messages.productComparison}
- ${messages.presentComparisons}
- ${messages.highlightAdvantages}
- ${messages.helpDecision}`;
      break;
    case 'complaint_support':
      basePrompt += `\n\n🛠️ ${messages.intentDetected}: ${messages.complaintSupport}
- ${messages.showEmpathy}
- ${messages.offerSolutions}
- ${messages.prioritizeSatisfaction}`;
      break;
  }

  // Personalización basada en tipo de cliente
  switch (persona) {
    case 'business_customer':
      basePrompt += `\n\n🏢 ${messages.clientProfile}: ${messages.businessCustomer}
- ${messages.focusOnVolume}
- ${messages.mentionBilling}
- ${messages.highlightDurability}`;
      break;
    case 'technical_customer':
      basePrompt += `\n\n🎓 ${messages.clientProfile}: ${messages.technicalCustomer}
- ${messages.useTechnicalTerms}
- ${messages.provideSpecificData}
- ${messages.respectKnowledge}`;
      break;
    case 'price_sensitive':
      basePrompt += `\n\n💰 ${messages.clientProfile}: ${messages.priceSensitive}
- ${messages.highlightValue}
- ${messages.offerEconomicOptions}
- ${messages.mentionPromotions}`;
      break;
    case 'quality_focused':
      basePrompt += `\n\n⭐ ${messages.clientProfile}: ${messages.qualityFocused}
- ${messages.highlightPremium}
- ${messages.focusOnDurability}
- ${messages.justifyInvestment}`;
      break;
    case 'urgent_customer':
      basePrompt += `\n\n⚡ ${messages.clientProfile}: ${messages.urgentCustomer}
- ${messages.prioritizeAvailability}
- ${messages.offerQuickInstall}
- ${messages.provideSolutions}`;
      break;
  }

  basePrompt += `\n\n${messages.alwaysRespond}`;
  
  switch (mode) {
    case 'think':
      return `${basePrompt}\n\n${messages.thinkMode}`
    case 'deepsearch':
      return `${basePrompt}\n\n${messages.deepSearchMode}`
    case 'deepersearch':
      return `${basePrompt}\n\n${messages.deeperSearchMode}`
    default:
      return basePrompt
  }
}

/**
 * Process default chat requests
 */
async function processDefaultRequest(userInput, messages, systemPrompt, context) {
  // Extract client ID and build personalized system prompt
  const clientId = extractClientId(userInput);
  const personalizedPrompt = buildSystemPrompt(context, 'default', userInput, clientId);
  
  const result = await llmComplete({
    system: personalizedPrompt,
    user: userInput,
    messages: messages,
    mode: 'default'
  })
  
  return {
    reply: result.reply,
    cost: result.cost,
    error: result.error,
    mode: 'default',
    usage: result.usage
  }
}

/**
 * Process think mode requests (using reasoning models)
 */
async function processThinkRequest(userInput, messages, systemPrompt, context) {
  // Extract client ID and build personalized system prompt
  const clientId = extractClientId(userInput);
  const personalizedPrompt = buildSystemPrompt(context, 'think', userInput, clientId);
  
  const result = await llmComplete({
    system: personalizedPrompt,
    user: userInput,
    messages: messages,
    mode: 'think'
  })
  
  return {
    reply: result.reply,
    cost: result.cost,
    error: result.error,
    mode: 'think',
    usage: result.usage
  }
}

/**
 * Process deep search requests (enhanced with document retrieval)
 */
async function processDeepSearchRequest(userInput, messages, systemPrompt, context) {
  // Extract client ID and build personalized system prompt
  const clientId = extractClientId(userInput);
  const detectedLanguage = detectLanguage(userInput);
  const localizedMessages = getLocalizedMessages(detectedLanguage);
  const personalizedPrompt = buildSystemPrompt(context, 'deepsearch', userInput, clientId);
  
  // Get contextual information from documents and data
  const agent = new TireSalesAgent();
  agent.businessData = {
    products: context.products || [],
    clients: context.clients || [],
    sales: context.sales || []
  };
  
  const contextualInfo = agent.getContextualInfo(userInput);
  
  // Build enhanced prompt with retrieved information
  let enhancedPrompt = `${personalizedPrompt}\n\n${localizedMessages.deepSearchMode || 'Modo de búsqueda profunda activado'}.\n\n`;
  
  // Add relevant products
  if (contextualInfo.relevantProducts.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantProducts || 'Productos relevantes encontrados'}:\n`;
    contextualInfo.relevantProducts.forEach(product => {
      enhancedPrompt += `- ${product.name} (${product.brand}) - $${product.price} - ${localizedMessages.stock || 'Stock'}: ${product.stock}\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add relevant clients
  if (contextualInfo.relevantClients.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantClients || 'Clientes relevantes encontrados'}:\n`;
    contextualInfo.relevantClients.forEach(client => {
      enhancedPrompt += `- ${client.business_name} - ${client.contact_person}\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add manual sections
  if (contextualInfo.manualSections.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantManualInfo || 'Información relevante del manual'}:\n`;
    contextualInfo.manualSections.forEach(section => {
      enhancedPrompt += `- ${section.type}: ${JSON.stringify(section.content).slice(0, 200)}...\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add business insights
  enhancedPrompt += `${localizedMessages.businessInsights || 'Insights del negocio'}:\n`;
  enhancedPrompt += `- ${localizedMessages.totalProducts || 'Total productos'}: ${contextualInfo.businessInsights.totalProducts}\n`;
  enhancedPrompt += `- ${localizedMessages.totalClients || 'Total clientes'}: ${contextualInfo.businessInsights.totalClients}\n`;
  enhancedPrompt += `- ${localizedMessages.mainCategories || 'Categorías principales'}: ${contextualInfo.businessInsights.topCategories.map(c => c.category).join(', ')}\n\n`;
  
  // Add web search results for enhanced information
  try {
    console.log(`🔍 ${localizedMessages.searchingWeb || 'Realizando búsqueda web para información actualizada'}...`);
    const webResults = await webSearchService.searchTireInfo(userInput, '', detectedLanguage);
    
    if (webResults.results && webResults.results.length > 0) {
      enhancedPrompt += `${localizedMessages.updatedWebInfo || 'INFORMACIÓN WEB ACTUALIZADA'}:\n`;
      webResults.results.forEach(result => {
        enhancedPrompt += `- ${result.title}\n`;
        enhancedPrompt += `  ${result.snippet}\n`;
        enhancedPrompt += `  ${localizedMessages.source || 'Fuente'}: ${result.source}\n\n`;
      });
    }
  } catch (error) {
    console.log(`⚠️ ${localizedMessages.webSearchError || 'No se pudo obtener información web adicional'}:`, error.message);
  }
  
  enhancedPrompt += `${localizedMessages.useAllInfo || 'Utiliza toda esta información para proporcionar una respuesta completa y detallada'}.`;
  
  const result = await llmComplete({
    system: enhancedPrompt,
    user: userInput,
    messages: messages,
    mode: 'deepsearch',
    temperature: 0.1 // Lower temperature for more focused responses
  });
  
  return {
    reply: result.reply,
    cost: result.cost,
    error: result.error,
    mode: 'deepsearch',
    usage: result.usage,
    retrievedContext: contextualInfo
  };
}

/**
 * Process deeper search requests (most comprehensive analysis)
 */
async function processDeeperSearchRequest(userInput, messages, systemPrompt, context) {
  // Extract client ID and build personalized system prompt
  const clientId = extractClientId(userInput);
  const detectedLanguage = detectLanguage(userInput);
  const localizedMessages = getLocalizedMessages(detectedLanguage);
  const personalizedPrompt = buildSystemPrompt(context, 'deepersearch', userInput, clientId);
  
  // Get comprehensive contextual information
  const agent = new TireSalesAgent();
  agent.businessData = {
    products: context.products || [],
    clients: context.clients || [],
    sales: context.sales || []
  };
  
  const contextualInfo = agent.getContextualInfo(userInput);
  
  // Build most comprehensive prompt with all available information
  let enhancedPrompt = `${personalizedPrompt}\n\n${localizedMessages.deeperSearchModeActivated}.\n\n`;
  
  // Add all relevant products with detailed information
  if (contextualInfo.relevantProducts.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantProductsComplete}:\n`;
    contextualInfo.relevantProducts.forEach(product => {
      enhancedPrompt += `- ${product.name} (${product.brand})\n`;
      enhancedPrompt += `  Precio: $${product.price} | Stock: ${product.stock} | Categoría: ${product.category}\n`;
      enhancedPrompt += `  Relevancia: ${product.relevanceScore}/10\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add comprehensive client information
  if (contextualInfo.relevantClients.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantClientsDetailed}:\n`;
    contextualInfo.relevantClients.forEach(client => {
      enhancedPrompt += `- Empresa: ${client.business_name}\n`;
      enhancedPrompt += `  Contacto: ${client.contact_person}\n`;
      enhancedPrompt += `  Segmento: ${client.segment || 'No definido'}\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add sales history analysis
  if (contextualInfo.relevantSales.length > 0) {
    enhancedPrompt += `${localizedMessages.relevantSalesHistory}:\n`;
    contextualInfo.relevantSales.forEach(sale => {
      enhancedPrompt += `- Cliente: ${sale.client_id} | Fecha: ${sale.sale_date}\n`;
      enhancedPrompt += `  Total: $${sale.total_amount} | Productos: ${sale.items?.length || 1}\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add comprehensive manual information
  if (contextualInfo.manualSections.length > 0) {
    enhancedPrompt += `${localizedMessages.salesManualInfo}:\n`;
    contextualInfo.manualSections.forEach(section => {
      enhancedPrompt += `- Tipo: ${section.type.toUpperCase()}\n`;
      enhancedPrompt += `  Contenido: ${JSON.stringify(section.content, null, 2)}\n`;
      enhancedPrompt += `  Relevancia: ${section.relevance}/10\n\n`;
    });
  }
  
  // Add comprehensive business insights
  enhancedPrompt += `${localizedMessages.completeBusinessAnalysis}:\n`;
  enhancedPrompt += `- ${localizedMessages.totalInventory}: ${contextualInfo.businessInsights.totalProducts} ${localizedMessages.products}\n`;
  enhancedPrompt += `- ${localizedMessages.clientBase}: ${contextualInfo.businessInsights.totalClients} ${localizedMessages.clients}\n`;
  enhancedPrompt += `- ${localizedMessages.salesHistory}: ${contextualInfo.businessInsights.totalSales} ${localizedMessages.transactions}\n\n`;
  
  enhancedPrompt += `${localizedMessages.mainCategories}:\n`;
  contextualInfo.businessInsights.topCategories.forEach(cat => {
    enhancedPrompt += `- ${cat.category}: ${cat.count} ${localizedMessages.products}\n`;
  });
  enhancedPrompt += `\n`;
  
  if (contextualInfo.businessInsights.recentSales.length > 0) {
    enhancedPrompt += `${localizedMessages.recentSales}:\n`;
    contextualInfo.businessInsights.recentSales.forEach(sale => {
      enhancedPrompt += `- ${sale.sale_date}: $${sale.total_amount} (Cliente: ${sale.client_id})\n`;
    });
    enhancedPrompt += `\n`;
  }
  
  // Add comprehensive web search results
  try {
    console.log(`🔍 ${localizedMessages.deepSearchActivated}...`);
    const webResults = await webSearchService.searchTireInfo(userInput, '', detectedLanguage);
    const marketResults = await webSearchService.searchMarketInfo(userInput, '', detectedLanguage);
    
    if (webResults.results && webResults.results.length > 0) {
      enhancedPrompt += `${localizedMessages.updatedWebInfoProducts}:\n`;
      webResults.results.forEach(result => {
        enhancedPrompt += `- ${result.title}\n`;
        enhancedPrompt += `  ${result.snippet}\n`;
        enhancedPrompt += `  ${localizedMessages.source}: ${result.source}\n\n`;
      });
    }
    
    if (marketResults.results && marketResults.results.length > 0) {
      enhancedPrompt += `${localizedMessages.updatedMarketInfo}:\n`;
      marketResults.results.forEach(result => {
        enhancedPrompt += `- ${result.title}\n`;
        enhancedPrompt += `  ${result.snippet}\n`;
        enhancedPrompt += `  ${localizedMessages.source}: ${result.source}\n\n`;
      });
    }
  } catch (error) {
    console.log(`⚠️ ${localizedMessages.webSearchErrorDeeper}:`, error.message);
  }
  
  enhancedPrompt += `${localizedMessages.exhaustiveAnalysisInstructions}:\n`;
  enhancedPrompt += `1. ${localizedMessages.analyzeMultiplePerspectives}\n`;
  enhancedPrompt += `2. ${localizedMessages.identifyPatterns}\n`;
  enhancedPrompt += `3. ${localizedMessages.provideRecommendations}\n`;
  enhancedPrompt += `4. ${localizedMessages.considerBusinessContext}\n`;
  enhancedPrompt += `5. ${localizedMessages.includeInsights}\n`;
  enhancedPrompt += `6. ${localizedMessages.integrateWebInfo}\n\n`;
  
  enhancedPrompt += `${localizedMessages.completeAnalysisPrompt}`;
  
  console.log('🔍 DEBUG - Detected language:', detectedLanguage);
  console.log('🔍 DEBUG - System prompt starts with:', enhancedPrompt.substring(0, 100));
  
  const result = await llmComplete({
    system: enhancedPrompt,
    user: userInput,
    messages: messages,
    mode: 'deepersearch',
    temperature: 0.05 // Very low temperature for maximum precision
  });
  
  return {
    reply: result.reply,
    cost: result.cost,
    error: result.error,
    mode: 'deepersearch',
    usage: result.usage,
    retrievedContext: contextualInfo,
    comprehensiveAnalysis: true
  };
}

// CodeAgent Integration - Main Execution
if (require.main === module) {
    (async () => {
        try {
            // Get environment variables from CodeAgent system or command line arguments
            const input = process.env.FLOWISE_INPUT || process.argv[2] || '';
            const chatHistory = JSON.parse(process.env.FLOWISE_CHAT_HISTORY || '[]');
            const selectedDocs = JSON.parse(process.env.FLOWISE_SELECTED_DOCS || '{}');
            
            // Initialize the sales agent
            const agent = new TireSalesAgent();
            
            // Load conversation history
            if (chatHistory && chatHistory.length > 0) {
                chatHistory.forEach(msg => {
                    agent.conversationHistory.addMessage(
                        msg.role || (msg.type === 'human' ? 'user' : 'assistant'),
                        msg.content || msg.message || '',
                        { source: 'flowise' }
                    );
                });
            }
            
            // Load data from selected documents if available
            if (selectedDocs && selectedDocs.stores) {
                for (const store of selectedDocs.stores) {
                    if (store.name === 'productos' && store.data) {
                        agent.businessData.products = Array.isArray(store.data) ? store.data : [];
                    } else if (store.name === 'clientes' && store.data) {
                        agent.businessData.clients = Array.isArray(store.data) ? store.data : [];
                    } else if (store.name === 'ventas' && store.data) {
                        agent.businessData.sales = Array.isArray(store.data) ? store.data : [];
                    } else if (store.name === 'manual' && store.data) {
                        agent.businessData.salesManual = store.data;
                    }
                }
            }
            
            // Process the user input
            let response = '';
            const events = [];
            let totalCost = 0;
            
            if (!input.trim()) {
                const language = detectLanguage('');
                const messages = getLocalizedMessages(language);
                response = messages.welcomeMessage;
            } else if (input.toLowerCase().includes('load_data')) {
                // Handle data loading command
                const language = detectLanguage(input);
                const messages = getLocalizedMessages(language);
                response = `${messages.dataLoaded}\n`;
                response += `• ${agent.businessData.products.length} ${messages.products}\n`;
                response += `• ${agent.businessData.clients.length} ${messages.clients}\n`;
                response += `• ${agent.businessData.sales.length} ${messages.salesRecords}\n`;
                response += `• Manual de procedimientos cargado\n\n${messages.howCanIHelp}`;
            } else if (input.toLowerCase().includes('consulta completa') || input.toLowerCase().includes('análisis completo')) {
                // Handle comprehensive sales consultation
                const clientId = extractClientId(input);
                const consultation = await agent.provideSalesConsultation(input, clientId);
                response = consultation;
                
                events.push({
                    type: 'comprehensive_consultation',
                    timestamp: new Date().toISOString(),
                    client_id: clientId,
                    input_length: input.length
                });
            } else {
                // Add user message to conversation history
                agent.conversationHistory.addMessage('user', input);
                
                // Get conversation context
                const conversationContext = agent.conversationHistory.getContextSummary();
                
                // Create enhanced system prompt with business context and conversation history
                const clientId = extractClientId(input);
                const detectedLanguage = detectLanguage(input);
                const messages = getLocalizedMessages(detectedLanguage);
                const systemPrompt = buildSystemPrompt({
                    products: agent.businessData.products,
                    clients: agent.businessData.clients,
                    sales: agent.businessData.sales
                }, 'default', input, clientId) + `\n\n${messages.conversationContext || 'Contexto de conversación reciente'}:\n${conversationContext}\n\n${messages.professionalResponse || 'Siempre responde de manera profesional, amigable y enfocada en las necesidades del cliente'}.`;
                
                // Get AI response using enhanced chat processing
                const chatResult = await getChatResponseMain(
                    input, 
                    agent.conversationHistory.getRecentHistory(10), 
                    systemPrompt,
                    {
                        products: agent.businessData.products,
                        clients: agent.businessData.clients,
                        sales: agent.businessData.sales
                    },
                    'auto' // Auto-detect processing mode
                );
                
                // Fallback to simple response if no AI response
                if (!chatResult.reply) {
                    response = `Gracias por tu consulta sobre "${input}". Como experto en neumáticos y repuestos, puedo ayudarte con recomendaciones específicas. ¿Podrías contarme más detalles sobre tu vehículo o necesidades específicas?`;
                } else {
                    response = chatResult.reply;
                    totalCost += chatResult.cost || 0;
                }
                
                // Add assistant response to conversation history
                agent.conversationHistory.addMessage('assistant', response, {
                    cost: chatResult.cost,
                    mode: chatResult.mode
                });
                
                // Add cost and usage information to events
                if (chatResult.cost > 0) {
                    events.push({
                        type: 'ai_usage',
                        timestamp: new Date().toISOString(),
                        cost: chatResult.cost,
                        mode: chatResult.mode,
                        usage: chatResult.usage
                    });
                }
                
                // Add analytics events
                events.push({
                    type: 'ai_consultation',
                    timestamp: new Date().toISOString(),
                    input: input.slice(0, 100),
                    ai_used: !!process.env.OPENAI_API_KEY,
                    conversation_length: agent.conversationHistory.getHistory().length
                });
            }
            
            // Update total cost
            agent.totalCost += totalCost;
            
            // Return JSON response for CodeAgent system
            const result = {
                reply: response,
                events: events,
                metadata: {
                    conversation_length: agent.conversationHistory.getHistory().length,
                    total_cost: agent.totalCost,
                    products_loaded: agent.businessData.products.length,
                    clients_loaded: agent.businessData.clients.length,
                    sales_loaded: agent.businessData.sales.length
                }
            };
            
            console.log(JSON.stringify(result));
            
        } catch (error) {
            console.log(JSON.stringify({
                reply: `Error: ${error.message}`,
                events: [{
                    type: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                }]
            }));
        }
    })();
}

/**
 * Helper function to extract client ID from input
 */
function extractClientId(input) {
    const clientIdMatch = input.match(/cliente[:\s]+([A-Z0-9-]+)/i);
    return clientIdMatch ? clientIdMatch[1] : null;
}

/**
 * Detect the language of the input text
 */
function detectLanguage(text) {
    // Simple language detection based on common patterns
    const spanishPatterns = [
        /\b(necesito|busco|quiero|precio|cuánto|dónde|cómo|neumáticos|cubiertas|ruedas|auto|coche|vehículo)\b/i,
        /\b(gracias|por favor|buenos días|buenas tardes|hola|saludos)\b/i,
        /\b(información|consulta|presupuesto|cotización|disponibilidad)\b/i
    ];
    
    const englishPatterns = [
        /\b(need|want|looking|price|how much|where|how|tires|tyres|wheels|car|vehicle|truck|heavy|duty|specifications|technical|spec)\b/i,
        /\b(thank you|please|good morning|good afternoon|hello|hi|for|the|and|or|with)\b/i,
        /\b(information|quote|budget|availability|consultation|heavy-duty|commercial|industrial)\b/i
    ];
    
    const portuguesePatterns = [
        /\b(preciso|quero|procuro|preço|quanto|onde|como|pneus|rodas|carro|veículo)\b/i,
        /\b(obrigado|por favor|bom dia|boa tarde|olá|oi)\b/i,
        /\b(informação|consulta|orçamento|cotação|disponibilidade)\b/i
    ];
    
    let spanishScore = 0;
    let englishScore = 0;
    let portugueseScore = 0;
    
    spanishPatterns.forEach(pattern => {
        if (pattern.test(text)) spanishScore++;
    });
    
    englishPatterns.forEach(pattern => {
        if (pattern.test(text)) englishScore++;
    });
    
    portuguesePatterns.forEach(pattern => {
        if (pattern.test(text)) portugueseScore++;
    });
    
    // Determine language based on highest score
    if (spanishScore >= englishScore && spanishScore >= portugueseScore) {
        return 'es'; // Spanish
    } else if (englishScore >= portugueseScore) {
        return 'en'; // English
    } else if (portugueseScore > 0) {
        return 'pt'; // Portuguese
    }
    
    // Default to English if no clear pattern is detected
    return 'en';
}

/**
 * Get localized messages based on language
 */
function getLocalizedMessages(language) {
    const messages = {
        es: {
            greeting: 'Hola, soy tu asistente de ventas especializado en neumáticos.',
            dataLoaded: 'Datos cargados correctamente. Tengo acceso a:',
            products: 'productos',
            clients: 'clientes',
            salesRecords: 'ventas registradas',
            howCanIHelp: '¿En qué puedo ayudarte?',
            welcomeMessage: '¡Hola! Soy El Rutero Experto, tu asistente de ventas especializado en neumáticos. ¿En qué puedo ayudarte hoy? Puedo ayudarte con:\n\n• Consultas sobre productos y precios\n• Análisis de clientes y historial de compras\n• Recomendaciones personalizadas\n• Estrategias de venta\n• Manejo de objeciones\n\n¿Qué necesitas?',
            searchingWeb: '🔍 Realizando búsqueda web para información actualizada...',
            webSearchError: '⚠️ No se pudo obtener información web adicional:',
            businessInsights: 'Insights del negocio:',
            relevantProducts: 'Productos relevantes encontrados:',
            relevantClients: 'Clientes relevantes encontrados:',
            manualInfo: 'Información relevante del manual:',
            webInfo: 'INFORMACIÓN WEB ACTUALIZADA:',
            marketInfo: 'INFORMACIÓN DE MERCADO ACTUALIZADA:',
            analysisInstructions: 'INSTRUCCIONES PARA ANÁLISIS EXHAUSTIVO:',
            useAllInfo: 'Utiliza toda esta información para proporcionar una respuesta completa y detallada.',
            systemRole: 'Eres un asistente de ventas especializado en neumáticos y productos automotrices',
            businessData: 'DATOS DEL NEGOCIO',
            availableProducts: 'Productos disponibles',
            registeredClients: 'Clientes registrados',
            salesHistory: 'Historial de ventas',
            objectives: 'OBJETIVOS',
            increaseRevenue: 'Incrementar ingresos mediante ventas consultivas',
            buildRelationships: 'Construir relaciones duraderas con clientes',
            provideValue: 'Proporcionar valor agregado en cada interacción',
            maintainExcellence: 'Mantener excelencia en servicio al cliente',
            optimizeInventory: 'Optimizar rotación de inventario',
            intentDetected: 'Intención detectada',
            purchaseIntent: 'El cliente muestra intención de compra. Enfócate en cerrar la venta con propuestas concretas y manejo de objeciones.',
            technicalInquiry: 'Consulta técnica identificada. Proporciona información detallada y demuestra expertise técnico.',
            priceComparison: 'El cliente está comparando precios. Enfatiza valor agregado, calidad y beneficios únicos.',
            generalInquiry: 'Consulta general. Identifica necesidades específicas y guía hacia soluciones apropiadas.',
            clientProfile: 'Perfil del cliente identificado',
            businessCustomer: 'Cliente empresarial: Enfócate en ROI, eficiencia operativa y soluciones a gran escala.',
            technicalCustomer: 'Cliente técnico: Proporciona especificaciones detalladas, datos de rendimiento y comparativas técnicas.',
            priceConsciousCustomer: 'Cliente consciente del precio: Destaca relación calidad-precio y beneficios a largo plazo.',
            loyalCustomer: 'Cliente leal: Mantén la relación, ofrece productos premium y programas de fidelización.',
            newCustomer: 'Cliente nuevo: Construye confianza, educa sobre productos y establece valor de la marca.',
            thinkMode: 'Modo THINK: Análisis estratégico profundo',
            searchMode: 'Modo SEARCH: Búsqueda contextual avanzada',
            deepSearchMode: 'Modo DEEPSEARCH: Investigación exhaustiva con web',
            helpClients: 'Ayudar a los clientes a encontrar los neumáticos perfectos',
            recommendProducts: 'Recomendar productos basados en necesidades específicas',
            providePricing: 'Proporcionar información de precios transparente y competitiva',
            generateStrategies: 'Generar estrategias de venta personalizadas',
            handleObjections: 'Manejar objeciones de manera profesional y efectiva',
            focusOnClosing: 'Enfócate en técnicas de cierre efectivas',
            presentOptions: 'Presenta opciones claras y beneficios específicos',
            offerPromotions: 'Ofrece promociones y descuentos disponibles',
            provideTechnical: 'Proporciona información técnica detallada',
            explainSpecs: 'Explica especificaciones y características técnicas',
            conversationContext: 'Contexto de conversación reciente',
            professionalResponse: 'Siempre responde de manera profesional, amigable y enfocada en las necesidades del cliente',
            usePreciseTerms: 'Usa terminología técnica precisa',
            productComparison: 'Comparación de productos solicitada',
            presentComparisons: 'Presenta comparaciones claras entre productos',
            highlightAdvantages: 'Destaca ventajas y diferenciadores únicos',
            helpDecision: 'Ayuda en la toma de decisiones informadas',
            deepSearchActivated: 'Modo de búsqueda profunda activado',
            relevantProductsFound: 'Productos relevantes encontrados',
            relevantClientsFound: 'Clientes relevantes encontrados',
            relevantManualInfo: 'Información relevante del manual',
            totalProducts: 'Total productos',
            totalClients: 'Total clientes',
            mainCategories: 'Categorías principales',
            stock: 'Stock',
            updatedWebInfo: 'INFORMACIÓN WEB ACTUALIZADA',
            source: 'Fuente',
            webSearchFailed: 'No se pudo obtener información web adicional',
            useAllInfoPrompt: 'Utiliza toda esta información para proporcionar una respuesta completa y detallada',
            intentDetected: 'Intención detectada',
            purchaseIntent: 'El cliente muestra intención de compra. Enfócate en cerrar la venta con propuestas concretas y manejo de objeciones.',
            technicalInquiry: 'Consulta técnica identificada. Proporciona información detallada y demuestra expertise técnico.',
            complaintSupport: 'Problema o queja identificada. Muestra empatía y ofrece soluciones inmediatas.',
            showEmpathy: 'Muestra empatía y comprensión',
            offerSolutions: 'Ofrece soluciones inmediatas',
            prioritizeSatisfaction: 'Prioriza la satisfacción del cliente',
            clientProfile: 'Perfil del cliente identificado',
            focusOnVolume: 'Enfócate en volumen y descuentos por cantidad',
            mentionBilling: 'Menciona opciones de facturación empresarial',
            highlightDurability: 'Destaca durabilidad y ROI',
            useTechnicalTerms: 'Usa terminología técnica apropiada',
            provideSpecificData: 'Proporciona datos específicos de rendimiento',
            respectKnowledge: 'Respeta su conocimiento técnico',
            priceSensitive: 'Cliente consciente del precio: Destaca relación calidad-precio y beneficios a largo plazo.',
            highlightValue: 'Destaca valor y relación calidad-precio',
            offerEconomicOptions: 'Ofrece opciones económicas',
            mentionPromotions: 'Menciona promociones disponibles',
            qualityFocused: 'Cliente enfocado en calidad: Destaca productos premium y características superiores.',
            highlightPremium: 'Destaca características premium',
            focusOnDurability: 'Enfócate en durabilidad y calidad',
            justifyInvestment: 'Justifica la inversión en calidad',
            urgentCustomer: 'Cliente urgente: Prioriza disponibilidad inmediata y instalación rápida.',
            prioritizeAvailability: 'Prioriza disponibilidad inmediata',
            offerQuickInstall: 'Ofrece instalación rápida',
            provideSolutions: 'Proporciona soluciones inmediatas',
            alwaysRespond: 'Siempre responde de manera profesional, amigable y enfocada en las necesidades del cliente',
            deeperSearchMode: 'Modo DEEPERSEARCH: Análisis exhaustivo con múltiples fuentes',
            thinkMode: 'Modo THINK: Análisis paso a paso con razonamiento detallado',
            focusOnClosing: 'Enfócate en cerrar la venta',
            presentOptions: 'Presenta opciones concretas',
            offerPromotions: 'Ofrece promociones disponibles',
            provideTechnical: 'Proporciona información técnica detallada',
            explainSpecs: 'Explica especificaciones claramente',
            usePreciseTerms: 'Usa términos técnicos precisos',
            presentComparisons: 'Presenta comparaciones claras',
            highlightAdvantages: 'Destaca ventajas competitivas',
            productComparison: 'Comparación de productos solicitada. Presenta opciones claras con ventajas y desventajas.',
            businessCustomer: 'Cliente empresarial: Enfócate en volumen, facturación y beneficios comerciales.',
            technicalCustomer: 'Cliente técnico: Usa terminología especializada y proporciona datos específicos.',
            regularCustomer: 'Cliente regular: Mantén un enfoque equilibrado y amigable.',
            updatedWebInfoProducts: 'INFORMACIÓN WEB ACTUALIZADA (PRODUCTOS)',
            updatedMarketInfo: 'INFORMACIÓN DE MERCADO ACTUALIZADA',
            webSearchErrorDeeper: 'No se pudo obtener información web adicional',
            exhaustiveAnalysisInstructions: 'INSTRUCCIONES PARA ANÁLISIS EXHAUSTIVO',
            analyzeMultiplePerspectives: 'Analiza todos los datos proporcionados desde múltiples perspectivas',
            identifyPatterns: 'Identifica patrones, tendencias y oportunidades',
            provideRecommendations: 'Proporciona recomendaciones específicas y accionables',
            considerBusinessContext: 'Considera el contexto completo del negocio',
            includeInsights: 'Incluye insights profundos y estratégicos',
            integrateWebInfo: 'Integra la información web actualizada en tu análisis',
            completeAnalysisPrompt: 'Realiza un análisis completo y proporciona una respuesta exhaustiva con recomendaciones específicas.',
            relevantProductsFound: 'PRODUCTOS RELEVANTES ENCONTRADOS',
            relevantClientsInfo: 'INFORMACIÓN DE CLIENTES RELEVANTES',
            relevantSalesHistory: 'HISTORIAL DE VENTAS RELEVANTE',
            deepSearchActivated: 'Realizando búsqueda web exhaustiva',
            updatedMarketInfo: 'INFORMACIÓN DE MERCADO ACTUALIZADA',
            source: 'Fuente',
            webSearchErrorDeeper: 'No se pudo obtener información web adicional',
            deeperSearchModeActivated: 'Modo de búsqueda exhaustiva activado',
            relevantProductsComplete: 'PRODUCTOS RELEVANTES (análisis completo)',
            relevantClientsDetailed: 'CLIENTES RELEVANTES (análisis detallado)',
            salesManualInfo: 'INFORMACIÓN DEL MANUAL DE VENTAS',
            completeBusinessAnalysis: 'ANÁLISIS COMPLETO DEL NEGOCIO',
            totalInventory: 'Inventario total',
            clientBase: 'Base de clientes',
            salesHistory: 'Historial de ventas',
            transactions: 'transacciones',
            mainCategories: 'CATEGORÍAS PRINCIPALES',
            recentSales: 'VENTAS RECIENTES',
            products: 'productos',
            clients: 'clientes'
        },
        en: {
            greeting: 'Hello, I am your specialized tire sales assistant.',
            dataLoaded: 'Data loaded successfully. I have access to:',
            products: 'products',
            clients: 'clients',
            salesRecords: 'sales records',
            howCanIHelp: 'How can I help you?',
            welcomeMessage: 'Hello! I am El Rutero Experto, your specialized tire sales assistant. How can I help you today? I can assist you with:\n\n• Product and pricing inquiries\n• Client analysis and purchase history\n• Personalized recommendations\n• Sales strategies\n• Objection handling\n\nWhat do you need?',
            searchingWeb: '🔍 Performing web search for updated information...',
            webSearchError: '⚠️ Could not obtain additional web information:',
            businessInsights: 'Business insights:',
            relevantProducts: 'Relevant products found:',
            relevantClients: 'Relevant clients found:',
            manualInfo: 'Relevant manual information:',
            webInfo: 'UPDATED WEB INFORMATION:',
            marketInfo: 'UPDATED MARKET INFORMATION:',
            analysisInstructions: 'COMPREHENSIVE ANALYSIS INSTRUCTIONS:',
            useAllInfo: 'Use all this information to provide a complete and detailed response.',
            systemRole: 'You are a specialized sales assistant for tires and automotive products',
            businessData: 'BUSINESS DATA',
            availableProducts: 'Available products',
            registeredClients: 'Registered clients',
            salesHistory: 'Sales history',
            objectives: 'OBJECTIVES',
            increaseRevenue: 'Increase revenue through consultative sales',
            buildRelationships: 'Build lasting relationships with clients',
            provideValue: 'Provide added value in every interaction',
            maintainExcellence: 'Maintain excellence in customer service',
            optimizeInventory: 'Optimize inventory turnover',
            intentDetected: 'Intent detected',
            purchaseIntent: 'Customer shows purchase intent. Focus on closing the sale with concrete proposals and objection handling.',
            technicalInquiry: 'Technical inquiry identified. Provide detailed information and demonstrate technical expertise.',
            priceComparison: 'Customer is comparing prices. Emphasize added value, quality and unique benefits.',
            generalInquiry: 'General inquiry. Identify specific needs and guide towards appropriate solutions.',
            clientProfile: 'Client profile identified',
            businessCustomer: 'Business customer: Focus on ROI, operational efficiency and large-scale solutions.',
            technicalCustomer: 'Technical customer: Provide detailed specifications, performance data and technical comparisons.',
            priceConsciousCustomer: 'Price-conscious customer: Highlight quality-price ratio and long-term benefits.',
            loyalCustomer: 'Loyal customer: Maintain relationship, offer premium products and loyalty programs.',
            newCustomer: 'New customer: Build trust, educate about products and establish brand value.',
            thinkMode: 'THINK Mode: Deep strategic analysis',
            searchMode: 'SEARCH Mode: Advanced contextual search',
            deepSearchMode: 'DEEPSEARCH Mode: Comprehensive research with web',
            helpClients: 'Help clients find the perfect tires',
            recommendProducts: 'Recommend products based on specific needs',
            providePricing: 'Provide transparent and competitive pricing information',
            generateStrategies: 'Generate personalized sales strategies',
            handleObjections: 'Handle objections professionally and effectively',
            focusOnClosing: 'Focus on effective closing techniques',
            presentOptions: 'Present clear options and specific benefits',
            offerPromotions: 'Offer available promotions and discounts',
            provideTechnical: 'Provide detailed technical information',
            explainSpecs: 'Explain specifications and technical features',
            conversationContext: 'Recent conversation context',
            professionalResponse: 'Always respond professionally, friendly and focused on customer needs',
            usePreciseTerms: 'Use precise technical terminology',
            productComparison: 'Product comparison requested',
            presentComparisons: 'Present clear comparisons between products',
            highlightAdvantages: 'Highlight advantages and unique differentiators',
            helpDecision: 'Help in making informed decisions',
            deepSearchActivated: 'Deep search mode activated',
            relevantProductsFound: 'Relevant products found',
            relevantClientsFound: 'Relevant clients found',
            relevantManualInfo: 'Relevant manual information',
            totalProducts: 'Total products',
            totalClients: 'Total clients',
            mainCategories: 'Main categories',
            stock: 'Stock',
            updatedWebInfo: 'UPDATED WEB INFORMATION',
            source: 'Source',
            webSearchFailed: 'Could not obtain additional web information',
            useAllInfoPrompt: 'Use all this information to provide a complete and detailed response',
            intentDetected: 'Intent detected',
            purchaseIntent: 'Customer shows purchase intent. Focus on closing the sale with concrete proposals and objection handling.',
            technicalInquiry: 'Technical inquiry identified. Provide detailed information and demonstrate technical expertise.',
            complaintSupport: 'Problem or complaint identified. Show empathy and offer immediate solutions.',
            showEmpathy: 'Show empathy and understanding',
            offerSolutions: 'Offer immediate solutions',
            prioritizeSatisfaction: 'Prioritize customer satisfaction',
            clientProfile: 'Client profile identified',
            focusOnVolume: 'Focus on volume and quantity discounts',
            mentionBilling: 'Mention business billing options',
            highlightDurability: 'Highlight durability and ROI',
            useTechnicalTerms: 'Use appropriate technical terminology',
            provideSpecificData: 'Provide specific performance data',
            respectKnowledge: 'Respect their technical knowledge',
            priceSensitive: 'Price-conscious customer: Highlight value proposition and long-term benefits.',
            highlightValue: 'Highlight value and cost-effectiveness',
            offerEconomicOptions: 'Offer economic options',
            mentionPromotions: 'Mention available promotions',
            qualityFocused: 'Quality-focused customer: Highlight premium products and superior features.',
            highlightPremium: 'Highlight premium features',
            focusOnDurability: 'Focus on durability and quality',
            justifyInvestment: 'Justify the investment in quality',
            urgentCustomer: 'Urgent customer: Prioritize immediate availability and quick installation.',
            prioritizeAvailability: 'Prioritize immediate availability',
            offerQuickInstall: 'Offer quick installation',
            provideSolutions: 'Provide immediate solutions',
            alwaysRespond: 'Always respond professionally, friendly and focused on customer needs',
            deeperSearchMode: 'DEEPERSEARCH Mode: Comprehensive analysis with multiple sources',
            thinkMode: 'THINK Mode: Step-by-step analysis with detailed reasoning',
            focusOnClosing: 'Focus on closing the sale',
            presentOptions: 'Present concrete options',
            offerPromotions: 'Offer available promotions',
            provideTechnical: 'Provide detailed technical information',
            explainSpecs: 'Explain specifications clearly',
            usePreciseTerms: 'Use precise technical terms',
            presentComparisons: 'Present clear comparisons',
            highlightAdvantages: 'Highlight competitive advantages',
            productComparison: 'Product comparison requested. Present clear options with advantages and disadvantages.',
            businessCustomer: 'Business customer: Focus on volume, billing and commercial benefits.',
            technicalCustomer: 'Technical customer: Use specialized terminology and provide specific data.',
            regularCustomer: 'Regular customer: Maintain a balanced and friendly approach.',
            updatedWebInfoProducts: 'UPDATED WEB INFORMATION (PRODUCTS)',
            updatedMarketInfo: 'UPDATED MARKET INFORMATION',
            webSearchErrorDeeper: 'Could not obtain additional web information',
            exhaustiveAnalysisInstructions: 'INSTRUCTIONS FOR EXHAUSTIVE ANALYSIS',
            analyzeMultiplePerspectives: 'Analyze all provided data from multiple perspectives',
            identifyPatterns: 'Identify patterns, trends and opportunities',
            provideRecommendations: 'Provide specific and actionable recommendations',
            considerBusinessContext: 'Consider the complete business context',
            includeInsights: 'Include deep and strategic insights',
            integrateWebInfo: 'Integrate updated web information in your analysis',
            completeAnalysisPrompt: 'Perform a complete analysis and provide an exhaustive response with specific recommendations.',
            relevantProductsFound: 'RELEVANT PRODUCTS FOUND',
            relevantClientsInfo: 'RELEVANT CLIENT INFORMATION',
            relevantSalesHistory: 'RELEVANT SALES HISTORY',
            deepSearchActivated: 'Performing exhaustive web search',
            updatedMarketInfo: 'UPDATED MARKET INFORMATION',
            source: 'Source',
            webSearchErrorDeeper: 'Could not obtain additional web information',
            deeperSearchModeActivated: 'Exhaustive search mode activated',
            relevantProductsComplete: 'RELEVANT PRODUCTS (complete analysis)',
            relevantClientsDetailed: 'RELEVANT CLIENTS (detailed analysis)',
            salesManualInfo: 'SALES MANUAL INFORMATION',
            completeBusinessAnalysis: 'COMPLETE BUSINESS ANALYSIS',
            totalInventory: 'Total inventory',
            clientBase: 'Client base',
            salesHistory: 'Sales history',
            transactions: 'transactions',
            mainCategories: 'MAIN CATEGORIES',
            recentSales: 'RECENT SALES',
            products: 'products',
            clients: 'clients'
        },
        pt: {
            greeting: 'Olá, sou seu assistente de vendas especializado em pneus.',
            dataLoaded: 'Dados carregados com sucesso. Tenho acesso a:',
            products: 'produtos',
            clients: 'clientes',
            salesRecords: 'registros de vendas',
            howCanIHelp: 'Como posso ajudá-lo?',
            welcomeMessage: 'Olá! Sou El Rutero Experto, seu assistente de vendas especializado em pneus. Como posso ajudá-lo hoje? Posso ajudá-lo com:\n\n• Consultas sobre produtos e preços\n• Análise de clientes e histórico de compras\n• Recomendações personalizadas\n• Estratégias de vendas\n• Tratamento de objeções\n\nO que você precisa?',
            searchingWeb: '🔍 Realizando busca na web para informações atualizadas...',
            webSearchError: '⚠️ Não foi possível obter informações web adicionais:',
            businessInsights: 'Insights do negócio:',
            relevantProducts: 'Produtos relevantes encontrados:',
            relevantClients: 'Clientes relevantes encontrados:',
            manualInfo: 'Informações relevantes do manual:',
            webInfo: 'INFORMAÇÕES WEB ATUALIZADAS:',
            marketInfo: 'INFORMAÇÕES DE MERCADO ATUALIZADAS:',
            analysisInstructions: 'INSTRUÇÕES PARA ANÁLISE ABRANGENTE:',
            useAllInfo: 'Use todas essas informações para fornecer uma resposta completa e detalhada.',
            systemRole: 'Você é um assistente de vendas especializado em pneus e produtos automotivos',
            businessData: 'DADOS DO NEGÓCIO',
            availableProducts: 'Produtos disponíveis',
            registeredClients: 'Clientes registrados',
            salesHistory: 'Histórico de vendas',
            objectives: 'OBJETIVOS',
            increaseRevenue: 'Aumentar receita através de vendas consultivas',
            buildRelationships: 'Construir relacionamentos duradouros com clientes',
            provideValue: 'Fornecer valor agregado em cada interação',
            maintainExcellence: 'Manter excelência no atendimento ao cliente',
            optimizeInventory: 'Otimizar rotatividade do estoque',
            intentDetected: 'Intenção detectada',
            purchaseIntent: 'Cliente mostra intenção de compra. Foque em fechar a venda com propostas concretas e tratamento de objeções.',
            technicalInquiry: 'Consulta técnica identificada. Forneça informações detalhadas e demonstre expertise técnica.',
            priceComparison: 'Cliente está comparando preços. Enfatize valor agregado, qualidade e benefícios únicos.',
            generalInquiry: 'Consulta geral. Identifique necessidades específicas e guie para soluções apropriadas.',
            clientProfile: 'Perfil do cliente identificado',
            businessCustomer: 'Cliente empresarial: Foque em ROI, eficiência operacional e soluções em grande escala.',
            technicalCustomer: 'Cliente técnico: Forneça especificações detalhadas, dados de desempenho e comparações técnicas.',
            priceConsciousCustomer: 'Cliente consciente do preço: Destaque relação qualidade-preço e benefícios a longo prazo.',
            loyalCustomer: 'Cliente fiel: Mantenha o relacionamento, ofereça produtos premium e programas de fidelidade.',
            newCustomer: 'Cliente novo: Construa confiança, eduque sobre produtos e estabeleça valor da marca.',
            thinkMode: 'Modo THINK: Análise estratégica profunda',
            searchMode: 'Modo SEARCH: Busca contextual avançada',
            deepSearchMode: 'Modo DEEPSEARCH: Pesquisa abrangente com web',
            helpClients: 'Ajudar clientes a encontrar os pneus perfeitos',
            recommendProducts: 'Recomendar produtos baseados em necessidades específicas',
            providePricing: 'Fornecer informações de preços transparentes e competitivas',
            generateStrategies: 'Gerar estratégias de vendas personalizadas',
            handleObjections: 'Lidar com objeções de forma profissional e eficaz',
            focusOnClosing: 'Foque em técnicas de fechamento eficazes',
            presentOptions: 'Apresente opções claras e benefícios específicos',
            offerPromotions: 'Ofereça promoções e descontos disponíveis',
            provideTechnical: 'Forneça informações técnicas detalhadas',
            explainSpecs: 'Explique especificações e características técnicas',
            conversationContext: 'Contexto de conversa recente',
            professionalResponse: 'Sempre responda de forma profissional, amigável e focada nas necessidades do cliente',
            usePreciseTerms: 'Use terminologia técnica precisa',
            productComparison: 'Comparação de produtos solicitada',
            presentComparisons: 'Apresente comparações claras entre produtos',
            highlightAdvantages: 'Destaque vantagens e diferenciadores únicos',
            helpDecision: 'Ajude na tomada de decisões informadas',
            deepSearchActivated: 'Modo de busca profunda ativado',
            relevantProductsFound: 'Produtos relevantes encontrados',
            relevantClientsFound: 'Clientes relevantes encontrados',
            relevantManualInfo: 'Informações relevantes do manual',
            totalProducts: 'Total produtos',
            totalClients: 'Total clientes',
            mainCategories: 'Categorias principais',
            stock: 'Estoque',
            updatedWebInfo: 'INFORMAÇÕES WEB ATUALIZADAS',
            source: 'Fonte',
            webSearchFailed: 'Não foi possível obter informações web adicionais',
            useAllInfoPrompt: 'Use todas essas informações para fornecer uma resposta completa e detalhada',
            intentDetected: 'Intenção detectada',
            purchaseIntent: 'Cliente mostra intenção de compra. Foque em fechar a venda com propostas concretas e tratamento de objeções.',
            technicalInquiry: 'Consulta técnica identificada. Forneça informações detalhadas e demonstre expertise técnica.',
            complaintSupport: 'Problema ou reclamação identificada. Mostre empatia e ofereça soluções imediatas.',
            showEmpathy: 'Mostre empatia e compreensão',
            offerSolutions: 'Ofereça soluções imediatas',
            prioritizeSatisfaction: 'Priorize a satisfação do cliente',
            clientProfile: 'Perfil do cliente identificado',
            focusOnVolume: 'Foque em volume e descontos por quantidade',
            mentionBilling: 'Mencione opções de faturamento empresarial',
            highlightDurability: 'Destaque durabilidade e ROI',
            useTechnicalTerms: 'Use terminologia técnica apropriada',
            provideSpecificData: 'Forneça dados específicos de desempenho',
            respectKnowledge: 'Respeite seu conhecimento técnico',
            priceSensitive: 'Cliente consciente do preço: Destaque proposta de valor e benefícios a longo prazo.',
            highlightValue: 'Destaque valor e custo-benefício',
            offerEconomicOptions: 'Ofereça opções econômicas',
            mentionPromotions: 'Mencione promoções disponíveis',
            qualityFocused: 'Cliente focado em qualidade: Destaque produtos premium e características superiores.',
            highlightPremium: 'Destaque características premium',
            focusOnDurability: 'Foque em durabilidade e qualidade',
            justifyInvestment: 'Justifique o investimento em qualidade',
            urgentCustomer: 'Cliente urgente: Priorize disponibilidade imediata e instalação rápida.',
            prioritizeAvailability: 'Priorize disponibilidade imediata',
            offerQuickInstall: 'Ofereça instalação rápida',
            provideSolutions: 'Forneça soluções imediatas',
            alwaysRespond: 'Sempre responda de forma profissional, amigável e focada nas necessidades do cliente',
            deeperSearchMode: 'Modo DEEPERSEARCH: Análise abrangente com múltiplas fontes',
            thinkMode: 'Modo THINK: Análise passo a passo com raciocínio detalhado',
            focusOnClosing: 'Foque em fechar a venda',
            presentOptions: 'Apresente opções concretas',
            offerPromotions: 'Ofereça promoções disponíveis',
            provideTechnical: 'Forneça informações técnicas detalhadas',
            explainSpecs: 'Explique especificações claramente',
            usePreciseTerms: 'Use termos técnicos precisos',
            presentComparisons: 'Apresente comparações claras',
            highlightAdvantages: 'Destaque vantagens competitivas',
            productComparison: 'Comparação de produtos solicitada. Apresente opções claras com vantagens e desvantagens.',
            businessCustomer: 'Cliente empresarial: Foque em volume, faturamento e benefícios comerciais.',
            technicalCustomer: 'Cliente técnico: Use terminologia especializada e forneça dados específicos.',
            regularCustomer: 'Cliente regular: Mantenha uma abordagem equilibrada e amigável.',
            updatedWebInfoProducts: 'INFORMAÇÕES WEB ATUALIZADAS (PRODUTOS)',
            updatedMarketInfo: 'INFORMAÇÕES DE MERCADO ATUALIZADAS',
            webSearchErrorDeeper: 'Não foi possível obter informações web adicionais',
            exhaustiveAnalysisInstructions: 'INSTRUÇÕES PARA ANÁLISE EXAUSTIVA',
            analyzeMultiplePerspectives: 'Analise todos os dados fornecidos de múltiplas perspectivas',
            identifyPatterns: 'Identifique padrões, tendências e oportunidades',
            provideRecommendations: 'Forneça recomendações específicas e acionáveis',
            considerBusinessContext: 'Considere o contexto completo do negócio',
            includeInsights: 'Inclua insights profundos e estratégicos',
            integrateWebInfo: 'Integre as informações web atualizadas em sua análise',
            completeAnalysisPrompt: 'Realize uma análise completa e forneça uma resposta exaustiva com recomendações específicas.',
            relevantProductsFound: 'PRODUTOS RELEVANTES ENCONTRADOS',
            relevantClientsInfo: 'INFORMAÇÕES DE CLIENTES RELEVANTES',
            relevantSalesHistory: 'HISTÓRICO DE VENDAS RELEVANTE',
            deepSearchActivated: 'Realizando busca web exaustiva',
            updatedMarketInfo: 'INFORMAÇÕES DE MERCADO ATUALIZADAS',
            source: 'Fonte',
            webSearchErrorDeeper: 'Não foi possível obter informações web adicionais',
            deeperSearchModeActivated: 'Modo de busca exaustiva ativado',
            relevantProductsComplete: 'PRODUTOS RELEVANTES (análise completa)',
            relevantClientsDetailed: 'CLIENTES RELEVANTES (análise detalhada)',
            salesManualInfo: 'INFORMAÇÕES DO MANUAL DE VENDAS',
            completeBusinessAnalysis: 'ANÁLISE COMPLETA DO NEGÓCIO',
            totalInventory: 'Inventário total',
            clientBase: 'Base de clientes',
            salesHistory: 'Histórico de vendas',
            transactions: 'transações',
            mainCategories: 'CATEGORIAS PRINCIPAIS',
            recentSales: 'VENDAS RECENTES',
            products: 'produtos',
            clients: 'clientes'
        }
    };
    
    return messages[language] || messages.es;
}

module.exports = TireSalesAgent;
module.exports.detectLanguage = detectLanguage;
module.exports.getLocalizedMessages = getLocalizedMessages;
module.exports.buildSystemPrompt = buildSystemPrompt;
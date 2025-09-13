const fs = require('fs');
const path = require('path');

/**
 * GOMERÍA "EL RUTERO EXPERTO" - ADVANCED AI SALES AGENT
 * 
 * This is a comprehensive sales agent that knows everything about the tire business.
 * It integrates product knowledge, client history, sales patterns, and B2B strategies
 * to provide expert sales guidance and recommendations.
 */

class TireSalesAgent {
    constructor() {
        this.businessData = {
            products: [],
            clients: [],
            sales: [],
            salesManual: null
        };
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
     * QUICK PRODUCT SEARCH
     * Fast product lookup for immediate queries
     */
    searchProducts(query) {
        const results = this.businessData.products.filter(product => {
            const searchText = `${product.name} ${product.brand} ${product.category}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        });

        return results.map(product => ({
            id: product.product_id,
            name: `${product.brand} ${product.name}`,
            price: product.price_ars,
            stock: product.stock,
            category: product.category
        }));
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
 * LLM completion using OpenAI-compatible API
 * - Reads env: OPENAI_API_KEY, OPENAI_BASE_URL (optional)
 * - Uses CODEAGENT_MODEL (default gpt-4o-mini), CODEAGENT_TEMPERATURE (default 0.2)
 */
async function llmComplete({ system, user }) {
  if (!process.env.OPENAI_API_KEY) return ''
  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    })
    const model = process.env.CODEAGENT_MODEL || 'gpt-4o-mini'
    const temperature = parseFloat(process.env.CODEAGENT_TEMPERATURE || '0.2')
    const resp = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
    const reply = (resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || ''
    return reply || ''
  } catch {
    return ''
  }
}

// CodeAgent Integration - Main Execution
if (require.main === module) {
    (async () => {
        try {
            // Get environment variables from CodeAgent system
            const input = process.env.FLOWISE_INPUT || '';
            const chatHistory = JSON.parse(process.env.FLOWISE_CHAT_HISTORY || '[]');
            const selectedDocs = JSON.parse(process.env.FLOWISE_SELECTED_DOCS || '{}');
            
            // Initialize the sales agent
            const agent = new TireSalesAgent();
            
            // Load data from selected documents if available
            if (selectedDocs && selectedDocs.stores) {
                for (const store of selectedDocs.stores) {
                    if (store.name === 'productos' && store.data) {
                        agent.productos = store.data;
                    } else if (store.name === 'clientes' && store.data) {
                        agent.clientes = store.data;
                    } else if (store.name === 'ventas' && store.data) {
                        agent.ventas = store.data;
                    } else if (store.name === 'manual' && store.data) {
                        agent.manual = store.data;
                    }
                }
            }
            
            // Process the user input
            let response = '';
            const events = [];
            
            if (!input.trim()) {
                response = '¡Hola! Soy El Rutero Experto, tu asistente de ventas especializado en neumáticos. ¿En qué puedo ayudarte hoy? Puedo ayudarte con:\n\n• Consultas sobre productos y precios\n• Análisis de clientes y historial de compras\n• Recomendaciones personalizadas\n• Estrategias de venta\n• Manejo de objeciones\n\n¿Qué necesitas?';
            } else if (input.toLowerCase().includes('load_data')) {
                // Handle data loading command
                response = 'Datos cargados correctamente. Tengo acceso a:\n';
                response += `• ${Object.keys(agent.productos || {}).length} productos\n`;
                response += `• ${(agent.clientes || []).length} clientes\n`;
                response += `• ${(agent.ventas || []).length} ventas registradas\n`;
                response += `• Manual de procedimientos cargado\n\n¿En qué puedo ayudarte?`;
            } else {
                // Create system prompt with business context
                const systemPrompt = `Eres un asistente de ventas experto para la Gomería "El Rutero Experto".

Datos del negocio:
- Productos disponibles: ${agent.businessData.products ? agent.businessData.products.length : 0}
- Clientes registrados: ${agent.businessData.clients ? agent.businessData.clients.length : 0}
- Historial de ventas: ${agent.businessData.sales ? agent.businessData.sales.length : 0}

Tu objetivo es:
1. Ayudar a los clientes con consultas sobre productos
2. Recomendar productos basándote en sus necesidades
3. Proporcionar información de precios y stock
4. Generar estrategias de venta personalizadas
5. Manejar objeciones de manera profesional

Siempre responde de manera profesional, amigable y enfocada en las necesidades del cliente.`;
                
                // Get AI response using OpenAI
                let aiResponse = await llmComplete({
                    system: systemPrompt,
                    user: input
                });
                
                // Fallback to simple response if no AI response
                    if (!aiResponse) {
                        aiResponse = `Gracias por tu consulta sobre "${input}". Como experto en neumáticos y repuestos, puedo ayudarte con recomendaciones específicas. ¿Podrías contarme más detalles sobre tu vehículo o necesidades específicas?`;
                    }
                
                response = aiResponse;
                
                // Add analytics events
                events.push({
                    type: 'ai_consultation',
                    timestamp: new Date().toISOString(),
                    input: input.slice(0, 100),
                    ai_used: !!process.env.OPENAI_API_KEY
                });
            }
            
            // Return JSON response for CodeAgent system
            const result = {
                reply: response,
                events: events
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

module.exports = TireSalesAgent;
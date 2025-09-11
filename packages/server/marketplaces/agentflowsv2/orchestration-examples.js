// Ejemplos de Orquestación de Agentes B2B
const AgentOrchestrator = require('./agent-orchestrator');

class OrchestrationExamples {
    constructor() {
        this.orchestrator = new AgentOrchestrator({
            dbConnectionString: process.env.DB_CONNECTION_STRING,
            maxConcurrentAgents: 5,
            agentTimeout: 30000
        });
    }

    async initialize() {
        await this.orchestrator.initialize();
        console.log('🎭 Orchestration Examples initialized');
    }

    // EJEMPLO 1: Procesamiento Secuencial
    // Útil cuando cada agente necesita el resultado del anterior
    async sequentialProcessingExample() {
        console.log('\n=== EJEMPLO 1: PROCESAMIENTO SECUENCIAL ===');
        
        const customerMessage = {
            phoneNumber: '+5491123456789',
            message: 'Hola, necesito una cotización para 10 notebooks para mi empresa',
            flowState: {
                customerType: 'business',
                urgency: 'high'
            },
            agentStrategy: 'sequential'
        };

        console.log('📝 Escenario: Cliente empresarial solicita cotización');
        console.log('🔄 Estrategia: Los agentes se ejecutan uno después del otro');
        console.log('📋 Flujo: Consultor → Especialista en Precios → Agente de Cierre');
        
        const result = await this.orchestrator.processCustomerMessage(customerMessage);
        
        console.log('✅ Resultado:', {
            strategy: result.strategy,
            agentsExecuted: result.agentsExecuted,
            response: result.response.substring(0, 100) + '...'
        });
        
        return result;
    }

    // EJEMPLO 2: Procesamiento Paralelo
    // Útil cuando múltiples agentes pueden trabajar independientemente
    async parallelProcessingExample() {
        console.log('\n=== EJEMPLO 2: PROCESAMIENTO PARALELO ===');
        
        const customerMessage = {
            phoneNumber: '+5491198765432',
            message: 'Quiero información sobre productos, precios y formas de pago',
            flowState: {
                customerType: 'individual',
                multipleQueries: true
            },
            agentStrategy: 'parallel'
        };

        console.log('📝 Escenario: Cliente con múltiples consultas simultáneas');
        console.log('🚀 Estrategia: Múltiples agentes trabajan al mismo tiempo');
        console.log('📋 Flujo: Productos || Precios || Pagos (en paralelo)');
        
        const result = await this.orchestrator.processCustomerMessage(customerMessage);
        
        console.log('✅ Resultado:', {
            strategy: result.strategy,
            agentsExecuted: result.agentsExecuted,
            response: result.response.substring(0, 100) + '...'
        });
        
        return result;
    }

    // EJEMPLO 3: Procesamiento Condicional
    // Útil cuando la ejecución depende de condiciones específicas
    async conditionalProcessingExample() {
        console.log('\n=== EJEMPLO 3: PROCESAMIENTO CONDICIONAL ===');
        
        const customerMessage = {
            phoneNumber: '+5491155555555',
            message: 'Tengo un problema con mi pedido anterior',
            flowState: {
                customerType: 'existing',
                hasActiveOrder: true,
                issueType: 'delivery'
            },
            agentStrategy: 'conditional'
        };

        console.log('📝 Escenario: Cliente existente con problema específico');
        console.log('🎯 Estrategia: Agentes se ejecutan según condiciones');
        console.log('📋 Flujo: Soporte → (si necesario) Logística → (si necesario) Compensación');
        
        const result = await this.orchestrator.processCustomerMessage(customerMessage);
        
        console.log('✅ Resultado:', {
            strategy: result.strategy,
            agentsExecuted: result.agentsExecuted,
            response: result.response.substring(0, 100) + '...'
        });
        
        return result;
    }

    // EJEMPLO 4: Orquestación Compleja - Venta B2B Completa
    async complexB2BSaleExample() {
        console.log('\n=== EJEMPLO 4: VENTA B2B COMPLEJA ===');
        
        // Simular conversación completa de venta
        const conversation = [
            {
                step: 1,
                message: 'Hola, soy Juan de TechCorp. Necesitamos equipar nuestra nueva oficina con 25 notebooks',
                strategy: 'sequential',
                expectedAgents: ['product_specialist', 'pricing_agent']
            },
            {
                step: 2,
                message: 'Me interesan las Dell Latitude, pero el precio está un poco alto. ¿Tienen algún descuento por volumen?',
                strategy: 'conditional',
                expectedAgents: ['negotiation_agent', 'pricing_agent']
            },
            {
                step: 3,
                message: 'Perfecto, acepto la oferta. ¿Cómo procedemos con el pedido?',
                strategy: 'sequential',
                expectedAgents: ['closing_agent', 'followup_scheduler']
            }
        ];

        const phoneNumber = '+5491144444444';
        const results = [];

        for (const step of conversation) {
            console.log(`\n--- PASO ${step.step} ---`);
            console.log(`💬 Cliente: "${step.message}"`);
            console.log(`🎯 Estrategia: ${step.strategy}`);
            
            const result = await this.orchestrator.processCustomerMessage({
                phoneNumber,
                message: step.message,
                flowState: {
                    conversationStep: step.step,
                    customerType: 'business',
                    companyName: 'TechCorp'
                },
                agentStrategy: step.strategy
            });
            
            console.log(`🤖 Respuesta: "${result.response.substring(0, 80)}..."`);
            console.log(`📊 Agentes ejecutados: ${result.agentsExecuted}`);
            
            results.push(result);
            
            // Simular pausa entre mensajes
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n✅ VENTA COMPLETA PROCESADA');
        console.log(`📈 Total de interacciones: ${results.length}`);
        console.log(`🤖 Total de agentes ejecutados: ${results.reduce((sum, r) => sum + r.agentsExecuted, 0)}`);
        
        return results;
    }

    // EJEMPLO 5: Manejo de Múltiples Clientes Simultáneos
    async multipleCustomersExample() {
        console.log('\n=== EJEMPLO 5: MÚLTIPLES CLIENTES SIMULTÁNEOS ===');
        
        const customers = [
            {
                phoneNumber: '+5491111111111',
                message: 'Quiero comprar una impresora',
                strategy: 'sequential'
            },
            {
                phoneNumber: '+5491122222222',
                message: '¿Tienen stock de mouse inalámbricos?',
                strategy: 'parallel'
            },
            {
                phoneNumber: '+5491133333333',
                message: 'Necesito soporte técnico urgente',
                strategy: 'conditional'
            },
            {
                phoneNumber: '+5491144444444',
                message: 'Cotización para 50 teclados mecánicos',
                strategy: 'sequential'
            }
        ];

        console.log(`👥 Procesando ${customers.length} clientes simultáneamente`);
        
        // Procesar todos los clientes en paralelo
        const promises = customers.map(async (customer, index) => {
            console.log(`🔄 Iniciando procesamiento para cliente ${index + 1}`);
            
            const result = await this.orchestrator.processCustomerMessage({
                phoneNumber: customer.phoneNumber,
                message: customer.message,
                flowState: {
                    customerId: `customer_${index + 1}`,
                    priority: index === 2 ? 'high' : 'normal' // Soporte técnico tiene prioridad
                },
                agentStrategy: customer.strategy
            });
            
            console.log(`✅ Cliente ${index + 1} procesado: ${result.agentsExecuted} agentes`);
            return { customerId: index + 1, ...result };
        });
        
        const results = await Promise.all(promises);
        
        console.log('\n📊 RESUMEN DE PROCESAMIENTO MÚLTIPLE:');
        results.forEach(result => {
            console.log(`   Cliente ${result.customerId}: ${result.strategy} - ${result.agentsExecuted} agentes`);
        });
        
        return results;
    }

    // EJEMPLO 6: Integración con Sistema B2B
    async b2bIntegrationExample() {
        console.log('\n=== EJEMPLO 6: INTEGRACIÓN B2B COMPLETA ===');
        
        const phoneNumber = '+5491199999999';
        
        // Simular flujo completo con integración B2B
        const steps = [
            {
                action: 'inquiry',
                message: 'Hola, soy María de InnovateTech. Necesitamos 15 monitores 4K para nuestro equipo de diseño'
            },
            {
                action: 'negotiation',
                message: 'Los precios están bien, pero necesitaríamos entrega en dos direcciones diferentes'
            },
            {
                action: 'closing',
                message: 'Perfecto, confirmamos el pedido. Pueden facturar a nombre de InnovateTech SA'
            }
        ];

        for (const [index, step] of steps.entries()) {
            console.log(`\n--- ${step.action.toUpperCase()} (Paso ${index + 1}) ---`);
            
            const result = await this.orchestrator.processCustomerMessage({
                phoneNumber,
                message: step.message,
                flowState: {
                    step: step.action,
                    companyName: 'InnovateTech',
                    customerType: 'business',
                    multipleAddresses: step.action === 'negotiation'
                },
                agentStrategy: step.action === 'closing' ? 'sequential' : 'parallel'
            });
            
            console.log(`🤖 Respuesta: "${result.response.substring(0, 100)}..."`);
            
            // Mostrar integración B2B si está disponible
            if (result.b2bIntegration) {
                console.log('🔗 Integración B2B activada:');
                console.log(`   - Cliente: ${result.b2bIntegration.customer ? 'Actualizado' : 'Nuevo'}`);
                console.log(`   - Venta: ${result.b2bIntegration.sale ? 'Registrada' : 'Pendiente'}`);
                console.log(`   - Seguimiento: ${result.b2bIntegration.followUp ? 'Programado' : 'No requerido'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        console.log('\n✅ INTEGRACIÓN B2B COMPLETA');
    }

    // Ejecutar todos los ejemplos
    async runAllExamples() {
        try {
            await this.initialize();
            
            console.log('🚀 INICIANDO EJEMPLOS DE ORQUESTACIÓN DE AGENTES');
            console.log('=' .repeat(60));
            
            // Ejecutar ejemplos uno por uno
            await this.sequentialProcessingExample();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.parallelProcessingExample();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.conditionalProcessingExample();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.complexB2BSaleExample();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.multipleCustomersExample();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.b2bIntegrationExample();
            
            console.log('\n' + '=' .repeat(60));
            console.log('🎉 TODOS LOS EJEMPLOS COMPLETADOS');
            
            // Mostrar estadísticas finales
            const status = this.orchestrator.getOrchestratorStatus();
            console.log('\n📊 ESTADÍSTICAS FINALES:');
            console.log(`   - Sistema inicializado: ${status.initialized}`);
            console.log(`   - Agentes activos: ${status.activeAgents}`);
            console.log(`   - Estado B2B: ${status.b2bSystemStatus}`);
            
        } catch (error) {
            console.error('❌ Error ejecutando ejemplos:', error);
        } finally {
            await this.orchestrator.shutdown();
        }
    }

    // Ejemplo específico para testing
    async testSpecificScenario(scenario) {
        await this.initialize();
        
        const scenarios = {
            'simple_inquiry': {
                phoneNumber: '+5491100000001',
                message: 'Hola, ¿tienen notebooks disponibles?',
                strategy: 'sequential'
            },
            'price_negotiation': {
                phoneNumber: '+5491100000002',
                message: 'Me gusta el producto pero el precio está alto, ¿pueden hacer algo?',
                strategy: 'conditional'
            },
            'bulk_order': {
                phoneNumber: '+5491100000003',
                message: 'Necesito cotizar 100 unidades para mi empresa',
                strategy: 'parallel'
            },
            'support_issue': {
                phoneNumber: '+5491100000004',
                message: 'Tengo un problema con mi pedido de ayer',
                strategy: 'conditional'
            }
        };
        
        const testCase = scenarios[scenario];
        if (!testCase) {
            throw new Error(`Escenario '${scenario}' no encontrado`);
        }
        
        console.log(`🧪 TESTING ESCENARIO: ${scenario.toUpperCase()}`);
        
        const result = await this.orchestrator.processCustomerMessage({
            ...testCase,
            flowState: {
                testMode: true,
                scenario: scenario
            },
            agentStrategy: testCase.strategy
        });
        
        console.log('✅ Resultado del test:', {
            scenario,
            strategy: result.strategy,
            success: result.success,
            agentsExecuted: result.agentsExecuted
        });
        
        await this.orchestrator.shutdown();
        return result;
    }
}

module.exports = OrchestrationExamples;

// Script para ejecutar ejemplos directamente
if (require.main === module) {
    const examples = new OrchestrationExamples();
    
    // Verificar argumentos de línea de comandos
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Ejecutar escenario específico
        const scenario = args[0];
        examples.testSpecificScenario(scenario)
            .then(() => console.log('✅ Test completado'))
            .catch(error => console.error('❌ Error en test:', error));
    } else {
        // Ejecutar todos los ejemplos
        examples.runAllExamples()
            .then(() => console.log('✅ Todos los ejemplos completados'))
            .catch(error => console.error('❌ Error ejecutando ejemplos:', error));
    }
}

/*
EJEMPLOS DE USO:

1. Ejecutar todos los ejemplos:
   node orchestration-examples.js

2. Ejecutar escenario específico:
   node orchestration-examples.js simple_inquiry
   node orchestration-examples.js price_negotiation
   node orchestration-examples.js bulk_order
   node orchestration-examples.js support_issue

3. Usar en código:
   const OrchestrationExamples = require('./orchestration-examples');
   const examples = new OrchestrationExamples();
   await examples.sequentialProcessingExample();
*/
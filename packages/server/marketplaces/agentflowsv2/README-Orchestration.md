# Sistema de Orquestación de Agentes B2B

## 📋 Descripción General

Este sistema permite coordinar múltiples agentes de IA para trabajar juntos de manera eficiente en procesos de venta B2B. Los agentes pueden ejecutarse de forma **secuencial**, **paralela** o **condicional** según las necesidades del negocio.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (WhatsApp)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                AGENT ORCHESTRATOR                           │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │   SEQUENTIAL    │    PARALLEL     │  CONDITIONAL    │   │
│  │   PROCESSING    │   PROCESSING    │   PROCESSING    │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 AGENTES ESPECIALIZADOS                     │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │   Ventas     │  Productos   │   Precios    │ Soporte │  │
│  │  Principal   │              │              │         │  │
│  └──────────────┴──────────────┴──────────────┴─────────┘  │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │ Negociación  │    Cierre    │ Seguimiento  │ Calidad │  │
│  │              │              │              │         │  │
│  └──────────────┴──────────────┴──────────────┴─────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                SISTEMA B2B INTEGRADO                       │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │   Base de    │  Gestión de  │ Seguimientos │ Reportes│  │
│  │    Datos     │ Direcciones  │              │         │  │
│  └──────────────┴──────────────┴──────────────┴─────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estructura de Archivos

```
agentflowsv2/
├── 📄 B2B Sales Agents Demo.json     # Configuración original de agentes
├── 🗄️ b2b_sales_schema.sql           # Esquema de base de datos
├── ⚙️ database-config.js             # Configuración de BD
├── 📍 address-manager.js             # Gestión de direcciones
├── 📅 followup-system.js             # Sistema de seguimientos
├── 📊 sales-tracker.js               # Seguimiento de ventas
├── ⏰ scheduled-followups.js         # Seguimientos programados
├── 🔗 b2b-sales-integration.js       # Integración principal
├── 🎭 agent-orchestrator.js          # ORQUESTADOR PRINCIPAL
├── 🎯 agent-definitions.js           # Definiciones de agentes
├── 📚 orchestration-examples.js      # Ejemplos de uso
└── 📖 README-Orchestration.md        # Esta documentación
```

## 🚀 Inicio Rápido

### 1. Configuración Inicial

```javascript
const AgentOrchestrator = require('./agent-orchestrator');

// Crear instancia del orquestador
const orchestrator = new AgentOrchestrator({
    dbConnectionString: process.env.DB_CONNECTION_STRING,
    maxConcurrentAgents: 5,
    agentTimeout: 30000
});

// Inicializar
await orchestrator.initialize();
```

### 2. Procesar Mensaje de Cliente

```javascript
const result = await orchestrator.processCustomerMessage({
    phoneNumber: '+5491123456789',
    message: 'Hola, necesito cotizar 10 notebooks para mi empresa',
    flowState: {
        customerType: 'business',
        urgency: 'high'
    },
    agentStrategy: 'sequential' // 'sequential', 'parallel', 'conditional'
});

console.log('Respuesta:', result.response);
```

## 🎯 Estrategias de Orquestación

### 1. **Procesamiento Secuencial**
```javascript
agentStrategy: 'sequential'
```
- Los agentes se ejecutan uno después del otro
- Cada agente recibe el resultado del anterior
- **Ideal para:** Procesos de venta paso a paso, validaciones
- **Ejemplo:** Consulta → Especialista → Precios → Cierre

### 2. **Procesamiento Paralelo**
```javascript
agentStrategy: 'parallel'
```
- Múltiples agentes trabajan simultáneamente
- Resultados se combinan al final
- **Ideal para:** Consultas múltiples, análisis independientes
- **Ejemplo:** Productos || Precios || Stock (en paralelo)

### 3. **Procesamiento Condicional**
```javascript
agentStrategy: 'conditional'
```
- Agentes se ejecutan según condiciones específicas
- Flujo dinámico basado en contexto
- **Ideal para:** Soporte técnico, negociaciones complejas
- **Ejemplo:** Soporte → (si necesario) Técnico → (si necesario) Escalación

## 🤖 Tipos de Agentes Disponibles

### Agentes Principales
- **`main_sales_agent`**: Agente principal de ventas
- **`closing_agent`**: Especialista en cierre de ventas

### Agentes Especializados
- **`product_specialist`**: Experto en productos y especificaciones
- **`pricing_agent`**: Especialista en precios y cotizaciones
- **`negotiation_agent`**: Experto en negociación
- **`support_agent`**: Soporte al cliente

### Agentes de Proceso
- **`followup_scheduler`**: Programación de seguimientos
- **`quality_assurance`**: Control de calidad
- **`analytics_agent`**: Análisis y métricas

## 📋 Flujos de Trabajo Predefinidos

### 1. Flujo Estándar de Venta
```javascript
const workflow = 'standard_sales_flow';
// Agente Principal → Especialista → Precios → Cierre
```

### 2. Flujo de Negociación
```javascript
const workflow = 'negotiation_flow';
// Principal → Precios → Negociación → Cierre
```

### 3. Flujo de Soporte
```javascript
const workflow = 'support_flow';
// Soporte → (opcional) Ventas
```

### 4. Flujo Empresarial
```javascript
const workflow = 'enterprise_sales_flow';
// Principal → Productos → Precios → Negociación → Cierre
```

## 💡 Ejemplos Prácticos

### Ejemplo 1: Consulta Simple
```javascript
const OrchestrationExamples = require('./orchestration-examples');
const examples = new OrchestrationExamples();

// Ejecutar ejemplo secuencial
await examples.sequentialProcessingExample();
```

### Ejemplo 2: Múltiples Clientes
```javascript
// Procesar varios clientes simultáneamente
await examples.multipleCustomersExample();
```

### Ejemplo 3: Venta Compleja B2B
```javascript
// Simular proceso completo de venta empresarial
await examples.complexB2BSaleExample();
```

### Ejemplo 4: Ejecutar Todos los Ejemplos
```bash
# Desde línea de comandos
node orchestration-examples.js

# Ejecutar escenario específico
node orchestration-examples.js simple_inquiry
node orchestration-examples.js price_negotiation
node orchestration-examples.js bulk_order
```

## 🔧 Configuración Avanzada

### Variables de Entorno
```bash
# Base de datos
DB_CONNECTION_STRING=postgresql://user:pass@localhost:5432/b2b_sales

# APIs externas
AGENTFLOW_API_URL=https://api.agentflow.com
WASENDER_API_URL=https://api.wasender.com

# Configuración de orquestación
MAX_CONCURRENT_AGENTS=5
AGENT_TIMEOUT=30000
```

### Personalizar Agentes
```javascript
const AgentDefinitions = require('./agent-definitions');
const definitions = new AgentDefinitions();

// Obtener configuración de agente
const agentConfig = definitions.getAgentConfig('main_sales_agent');

// Modificar configuración
agentConfig.timeout = 45000;
agentConfig.maxRetries = 3;
```

### Crear Flujo Personalizado
```javascript
const customWorkflow = {
    name: 'Mi Flujo Personalizado',
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
            conditions: ['product_inquiry']
        }
    ]
};
```

## 📊 Monitoreo y Métricas

### Estado del Orquestador
```javascript
const status = orchestrator.getOrchestratorStatus();
console.log({
    initialized: status.initialized,
    activeAgents: status.activeAgents,
    queueLength: status.queueLength,
    b2bSystemStatus: status.b2bSystemStatus
});
```

### Métricas de Agentes
```javascript
const AgentDefinitions = require('./agent-definitions');
const definitions = new AgentDefinitions();
const stats = definitions.getAgentStats();

console.log({
    totalAgents: stats.totalAgents,
    agentsByRole: stats.agentsByRole,
    agentsByPriority: stats.agentsByPriority
});
```

## 🔄 Integración con Sistema B2B

El orquestador se integra automáticamente con el sistema B2B desarrollado:

- **Base de Datos**: Almacena interacciones y resultados
- **Gestión de Direcciones**: Maneja múltiples direcciones por cliente
- **Seguimientos**: Programa follow-ups automáticos
- **Ventas**: Registra y trackea todas las ventas
- **Análisis**: Genera reportes y métricas

## 🚨 Manejo de Errores

### Reintentos Automáticos
```javascript
// Los agentes tienen reintentos configurables
const agentConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
};
```

### Escalación
```javascript
// Escalación automática en caso de errores
const escalation = {
    conditions: ['timeout', 'multiple_failures'],
    action: 'human_intervention',
    notifyManager: true
};
```

### Fallbacks
```javascript
// Respuestas de fallback cuando fallan los agentes
const fallbackResponse = {
    response: 'Disculpá, tuve un problema técnico. Un representante te contactará pronto.',
    scheduleHumanFollowup: true
};
```

## 🔒 Seguridad y Mejores Prácticas

### 1. **Validación de Entrada**
- Todos los mensajes se validan antes del procesamiento
- Sanitización de datos de entrada
- Límites de longitud y frecuencia

### 2. **Control de Concurrencia**
- Límite máximo de agentes simultáneos
- Cola de procesamiento para evitar sobrecarga
- Timeouts configurables

### 3. **Logging y Auditoría**
- Todas las interacciones se registran
- Trazabilidad completa del flujo
- Métricas de rendimiento

### 4. **Manejo de Datos Sensibles**
- No se almacenan datos de pago en logs
- Encriptación de información personal
- Cumplimiento de GDPR/LGPD

## 🧪 Testing

### Tests Unitarios
```bash
# Ejecutar tests específicos
node orchestration-examples.js simple_inquiry
node orchestration-examples.js price_negotiation
```

### Tests de Integración
```javascript
// Test completo del sistema
const examples = new OrchestrationExamples();
await examples.runAllExamples();
```

### Tests de Carga
```javascript
// Simular múltiples clientes simultáneos
await examples.multipleCustomersExample();
```

## 📈 Escalabilidad

### Configuración para Alto Volumen
```javascript
const orchestrator = new AgentOrchestrator({
    maxConcurrentAgents: 20,
    agentTimeout: 15000,
    queueSize: 1000,
    batchProcessing: true
});
```

### Distribución de Carga
- Múltiples instancias del orquestador
- Load balancer para distribuir requests
- Base de datos compartida para estado

## 🔧 Troubleshooting

### Problemas Comunes

1. **Agentes no responden**
   - Verificar conectividad de red
   - Revisar timeouts configurados
   - Comprobar logs de errores

2. **Base de datos desconectada**
   - Verificar string de conexión
   - Comprobar permisos de BD
   - Revisar esquema de tablas

3. **Rendimiento lento**
   - Reducir número de agentes concurrentes
   - Optimizar queries de BD
   - Revisar uso de memoria

### Logs Útiles
```javascript
// Habilitar logging detallado
process.env.DEBUG = 'orchestrator:*';
process.env.LOG_LEVEL = 'debug';
```

## 🤝 Contribución

Para contribuir al sistema:

1. Crear nuevos tipos de agentes en `agent-definitions.js`
2. Agregar flujos de trabajo personalizados
3. Implementar nuevas estrategias de orquestación
4. Mejorar ejemplos y documentación

## 📞 Soporte

Para soporte técnico:
- Revisar logs del sistema
- Ejecutar ejemplos de diagnóstico
- Verificar configuración de BD
- Comprobar variables de entorno

---

## 🎉 ¡Listo para Usar!

El sistema de orquestación está completamente configurado y listo para coordinar múltiples agentes en procesos de venta B2B complejos. 

**Próximos pasos:**
1. Configurar variables de entorno
2. Inicializar base de datos con el schema
3. Ejecutar ejemplos para familiarizarse
4. Personalizar agentes según necesidades
5. Integrar con sistemas existentes

¡Que tengas excelentes ventas! 🚀
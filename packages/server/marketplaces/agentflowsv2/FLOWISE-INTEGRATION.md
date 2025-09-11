# Integración con Flowise - Sistema de Orquestación B2B

## 📋 Configuración en Flowise Frontend

### 1. Cargar Templates en Flowise

#### Paso 1: Importar el Template Principal
1. Abrí Flowise en tu navegador
2. Andá a **"Chatflows"** → **"Import Chatflow"**
3. Seleccioná el archivo `B2B Sales Agents Demo.json`
4. El template se cargará con toda la configuración de agentes

#### Paso 2: Configurar Variables de Entorno en Flowise
```javascript
// En Flowise, andá a Settings → Environment Variables
// Agregá estas variables:

DB_CONNECTION_STRING=postgresql://user:pass@localhost:5432/b2b_sales
AGENTFLOW_API_URL=https://api.agentflow.com
WASENDER_API_URL=https://api.wasender.com
MAX_CONCURRENT_AGENTS=5
AGENT_TIMEOUT=30000
```

### 2. Estructura de Templates en Flowise

```
Flowise Dashboard/
├── 📊 Chatflows/
│   ├── 🎯 B2B Sales Main Agent        # Template principal
│   ├── 💰 Pricing Specialist Agent    # Agente de precios
│   ├── 📦 Product Specialist Agent    # Agente de productos
│   ├── 🤝 Negotiation Agent          # Agente de negociación
│   ├── 🎯 Closing Agent              # Agente de cierre
│   ├── 📞 Support Agent              # Agente de soporte
│   └── 📅 Follow-up Scheduler        # Programador de seguimientos
├── 🔧 Tools/
│   ├── 🗄️ Database Connector         # Conexión a PostgreSQL
│   ├── 📍 Address Manager            # Gestión de direcciones
│   ├── 📊 Sales Tracker              # Seguimiento de ventas
│   └── ⏰ Follow-up System           # Sistema de seguimientos
└── 🎭 Agent Orchestrator/
    ├── Sequential Flow               # Flujo secuencial
    ├── Parallel Flow                 # Flujo paralelo
    └── Conditional Flow              # Flujo condicional
```

### 3. Configuración de Nodos en Flowise

#### Nodo Principal: Agent Orchestrator
```json
{
  "id": "agentOrchestrator_0",
  "type": "customFunction",
  "data": {
    "name": "Agent Orchestrator",
    "description": "Coordina múltiples agentes B2B",
    "code": "// Código del agent-orchestrator.js",
    "inputs": {
      "customerMessage": "{{msg}}",
      "phoneNumber": "{{phoneNumber}}",
      "strategy": "{{strategy}}",
      "flowState": "{{flowState}}"
    }
  }
}
```

#### Nodo de Base de Datos
```json
{
  "id": "databaseConnector_0",
  "type": "customFunction",
  "data": {
    "name": "B2B Database",
    "description": "Conexión a PostgreSQL B2B",
    "code": "// Código del database-config.js",
    "connectionString": "{{DB_CONNECTION_STRING}}"
  }
}
```

### 4. Vincular Templates - Configuración de Flujos

#### Opción A: Flujo Secuencial
```
[Entrada del Cliente] 
       ↓
[Agent Orchestrator]
       ↓
[Agente Principal] → [Especialista] → [Precios] → [Cierre]
       ↓
[Respuesta Final]
```

**Configuración en Flowise:**
1. Arrastrá el nodo "Agent Orchestrator" al canvas
2. Conectá la entrada del cliente al orchestrator
3. Configurá `strategy: "sequential"`
4. El orchestrator manejará automáticamente la secuencia

#### Opción B: Flujo Paralelo
```
[Entrada del Cliente]
       ↓
[Agent Orchestrator]
       ↓
[Agente A] || [Agente B] || [Agente C]
       ↓
[Combinador de Resultados]
       ↓
[Respuesta Final]
```

**Configuración en Flowise:**
1. Configurá `strategy: "parallel"`
2. Los agentes se ejecutarán simultáneamente
3. Los resultados se combinarán automáticamente

#### Opción C: Flujo Condicional
```
[Entrada del Cliente]
       ↓
[Análisis de Intención]
       ↓
[Decisión Condicional]
    ↙     ↘
[Agente A] [Agente B]
    ↘     ↙
[Respuesta Final]
```

### 5. Configuración Paso a Paso en Flowise

#### Paso 1: Crear Nuevo Chatflow
1. **Nuevo Chatflow**: Clic en "+ Add New Chatflow"
2. **Nombre**: "B2B Sales Orchestrator"
3. **Descripción**: "Sistema de orquestación de agentes B2B"

#### Paso 2: Agregar Nodos Base
```javascript
// 1. Nodo de Entrada (Chat Input)
{
  "type": "chatInput",
  "config": {
    "inputType": "text",
    "placeholder": "Escribí tu consulta B2B..."
  }
}

// 2. Nodo Orchestrator (Custom Function)
{
  "type": "customFunction",
  "config": {
    "functionName": "processB2BMessage",
    "code": `
      const AgentOrchestrator = require('./agent-orchestrator');
      
      async function processB2BMessage(input) {
        const orchestrator = new AgentOrchestrator({
          dbConnectionString: process.env.DB_CONNECTION_STRING,
          maxConcurrentAgents: 5
        });
        
        await orchestrator.initialize();
        
        const result = await orchestrator.processCustomerMessage({
          phoneNumber: input.phoneNumber || '+5491123456789',
          message: input.message,
          flowState: input.flowState || {},
          agentStrategy: input.strategy || 'sequential'
        });
        
        return result;
      }
    `
  }
}

// 3. Nodo de Salida (Chat Output)
{
  "type": "chatOutput",
  "config": {
    "outputFormat": "text"
  }
}
```

#### Paso 3: Conectar Nodos
1. **Chat Input** → **Custom Function** (Orchestrator)
2. **Custom Function** → **Chat Output**
3. Configurar variables de entrada y salida

#### Paso 4: Configurar Variables Dinámicas
```javascript
// En el nodo Orchestrator, configurá estas variables:
{
  "variables": {
    "strategy": {
      "type": "select",
      "options": ["sequential", "parallel", "conditional"],
      "default": "sequential",
      "description": "Estrategia de procesamiento"
    },
    "customerType": {
      "type": "select", 
      "options": ["individual", "business", "enterprise"],
      "default": "business"
    },
    "urgency": {
      "type": "select",
      "options": ["low", "medium", "high"],
      "default": "medium"
    }
  }
}
```

### 6. Configuración Avanzada de Agentes

#### Template de Agente Individual
```json
{
  "id": "salesAgent_{{agentId}}",
  "type": "llmChain",
  "data": {
    "model": "gpt-4",
    "temperature": 0.7,
    "systemMessage": "Sos un experto en ventas B2B...",
    "humanMessage": "{{customerMessage}}",
    "memory": {
      "type": "bufferWindowMemory",
      "k": 10
    },
    "tools": [
      {
        "name": "database_query",
        "description": "Consultar base de datos de clientes"
      },
      {
        "name": "schedule_followup", 
        "description": "Programar seguimiento"
      }
    ]
  }
}
```

### 7. Integración con Herramientas Externas

#### WhatsApp Integration
```javascript
// Nodo de WhatsApp
{
  "type": "webhook",
  "config": {
    "url": "https://api.wasender.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{WASENDER_API_KEY}}"
    },
    "body": {
      "phone": "{{phoneNumber}}",
      "message": "{{response}}"
    }
  }
}
```

#### Database Integration
```javascript
// Nodo de PostgreSQL
{
  "type": "database",
  "config": {
    "type": "postgresql",
    "connectionString": "{{DB_CONNECTION_STRING}}",
    "query": "SELECT * FROM customers WHERE phone = $1",
    "parameters": ["{{phoneNumber}}"]
  }
}
```

### 8. Testing y Debugging en Flowise

#### Panel de Testing
1. **Test Chat**: Usá el panel de chat integrado
2. **Debug Mode**: Habilitá el modo debug para ver logs
3. **Variable Inspector**: Revisá variables en tiempo real

#### Mensajes de Prueba
```javascript
// Consulta simple
{
  "message": "Hola, necesito información sobre notebooks",
  "strategy": "sequential"
}

// Consulta compleja
{
  "message": "Necesito cotizar 50 notebooks para mi empresa, con entrega urgente",
  "strategy": "parallel",
  "customerType": "enterprise",
  "urgency": "high"
}

// Negociación
{
  "message": "El precio está muy alto, necesito un descuento",
  "strategy": "conditional"
}
```

### 9. Deployment y Producción

#### Variables de Producción
```bash
# En Flowise Production Settings
NODE_ENV=production
DB_CONNECTION_STRING=postgresql://prod_user:pass@prod_host:5432/b2b_sales
AGENTFLOW_API_URL=https://api.agentflow.com
WASENDER_API_URL=https://api.wasender.com
MAX_CONCURRENT_AGENTS=10
AGENT_TIMEOUT=45000
LOG_LEVEL=info
```

#### Monitoreo
```javascript
// Nodo de Métricas
{
  "type": "analytics",
  "config": {
    "trackEvents": [
      "customer_message_received",
      "agent_response_sent", 
      "sale_completed",
      "followup_scheduled"
    ],
    "dashboard": "flowise_b2b_analytics"
  }
}
```

### 10. Troubleshooting Común

#### Problema: Agentes no se conectan
**Solución:**
1. Verificá las variables de entorno
2. Comprobá la conexión a la base de datos
3. Revisá los logs en el panel de debug

#### Problema: Respuestas lentas
**Solución:**
1. Reducí `MAX_CONCURRENT_AGENTS`
2. Optimizá las consultas de BD
3. Usá estrategia "parallel" para consultas independientes

#### Problema: Errores de memoria
**Solución:**
1. Configurá `bufferWindowMemory` con `k` menor
2. Limpiá el historial periódicamente
3. Usá `summarizeMemory` para conversaciones largas

### 11. Mejores Prácticas

#### Organización de Templates
- **Un template por tipo de agente**
- **Nombres descriptivos y consistentes**
- **Documentación en cada nodo**
- **Versionado de templates**

#### Performance
- **Usá caché para consultas frecuentes**
- **Implementá timeouts apropiados**
- **Monitorea el uso de recursos**
- **Optimizá las consultas de BD**

#### Seguridad
- **No hardcodees credenciales**
- **Usá variables de entorno**
- **Validá todas las entradas**
- **Implementá rate limiting**

---

## 🚀 Resumen de Configuración

1. **Importá** `B2B Sales Agents Demo.json` en Flowise
2. **Configurá** variables de entorno
3. **Creá** nodos para cada componente del sistema
4. **Conectá** los nodos según la estrategia elegida
5. **Testea** con mensajes de prueba
6. **Deployá** a producción

¡El sistema estará listo para coordinar múltiples agentes en Flowise! 🎉
# Patrones de Extracción y Validación de Información de Clientes - Freia

## Resumen Ejecutivo

Este documento detalla cómo el sistema Freia maneja la extracción, validación y procesamiento de información de clientes a través del agente conversacional y el backend API.

## 1. Configuración del Agente (V2CHATFLOW.json)

### 1.1 Persona del Agente
- **Nombre**: Lautaro
- **Rol**: Asesor de ventas experto en neumáticos para Freia - Especialistas en Neumáticos
- **Comportamiento**: Profesional, empático, orientado a soluciones

### 1.2 Herramientas Disponibles para Gestión de Clientes

#### `create_new_customer`
- **Endpoint**: `POST /api/v1/customers`
- **Campos Requeridos**:
  - `name`: Nombre completo del cliente
  - `email`: Dirección de correo electrónico
  - `customerType`: Tipo de cliente ('final_consumer' o 'tire_shop')
- **Campos Opcionales**:
  - `company`: Nombre de la empresa
  - `phone`: Número de teléfono
  - `address`: Dirección física
  - `taxId`: Número de identificación fiscal
  - `notes`: Notas adicionales

#### Herramientas que Requieren Información del Cliente
- `schedule_followup`: Requiere `customer_id`, `reason`
- `create_stock_notification`: Requiere `productId`, `clientId`, opcionalmente `clientPhone`, `clientEmail`
- `inventory_reserve`: Requiere `clientId`, `clientPhone`, `clientEmail`
- `update_customer_preferences`: Requiere `clientId`

### 1.3 Flujo de Trabajo del Agente
1. **Consulta inicial**: Usar `gomeria_consultation` para consultas de productos
2. **Identificación del cliente**: Extraer información durante la conversación
3. **Creación/actualización**: Usar herramientas apropiadas según el contexto
4. **Seguimiento**: Programar follow-ups y notificaciones

## 2. Validación Backend

### 2.1 Patrones de Validación (validation.util.ts)

#### Validación de Email
```typescript
export function isInvalidEmail(email: unknown): boolean {
    const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return !email || typeof email !== 'string' || email.length > 255 || !regexEmail.test(email)
}
```
- **Patrón**: Formato estándar de email
- **Límites**: Máximo 255 caracteres
- **Validación**: Tipo string requerido

#### Validación de Nombres
```typescript
export function isInvalidName(name: unknown): boolean {
    return !name || typeof name !== 'string' || name.length > 100
}
```
- **Límites**: Máximo 100 caracteres
- **Validación**: Tipo string requerido, no vacío

### 2.2 Proceso de Creación de Clientes (customers.ts)

#### Normalización de Campos
```typescript
// Acepta múltiples formatos de entrada
const normalizedPhone = phone_number || phone
let normalizedFirstName = first_name
let normalizedLastName = last_name

// División automática del nombre completo
if ((!normalizedFirstName || !normalizedLastName) && typeof name === 'string' && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (!normalizedFirstName) normalizedFirstName = parts[0]
    if (!normalizedLastName) normalizedLastName = parts.length > 1 ? parts.slice(1).join(' ') : ''
}
```

#### Validaciones Obligatorias
- **Teléfono**: Campo requerido (acepta `phone_number` o `phone`)
- **Duplicados**: Verifica existencia por número de teléfono
- **Flexibilidad**: Acepta campos opcionales sin fallar la validación

#### Resolución de Clientes
```typescript
const resolveCustomer = async (identifier: string): Promise<ResolvedCustomer> => {
    // 1. Intenta por ID numérico
    if (isNumericId) {
        const result = await appServer.AppDataSource.query('SELECT * FROM customers WHERE id = $1', [parseInt(trimmed)])
    }
    
    // 2. Busca por número de teléfono
    const resultByPhone = await appServer.AppDataSource.query('SELECT * FROM customers WHERE phone_number = $1', [trimmed])
    
    // 3. Fallback por ID si no es numérico inicialmente
}
```

## 3. Patrones de Extracción de Información

### 3.1 Análisis de Conversaciones (conversationAnalyzer.ts)

#### Extracción de Información de Productos
- **Método**: Análisis de palabras clave y patrones
- **Fuentes**: Mensajes de conversación, historial de compras previas
- **Validación**: Verificación contra inventario existente

#### Recuperación de Información Previa
```typescript
// Si hay número de teléfono disponible, busca información previa
if (phoneNumber) {
    const previousSales = await getPreviousSalesInfo(phoneNumber)
    // Utiliza información de compras anteriores para contexto
}
```

### 3.2 Contexto del Cliente (notifications.ts, promotions.ts)

#### Resolución de Métricas del Cliente
```typescript
const resolveCustomerMetrics = async (customerId: string, phoneNumber: string) => {
    // Resuelve IDs y números de teléfono desde la base de datos
    // Proporciona contexto completo para notificaciones y promociones
}
```

## 4. Flujo de Información del Cliente

### 4.1 Captura Inicial
1. **Conversación Natural**: El agente extrae información durante el diálogo
2. **Campos Mínimos**: Número de teléfono (obligatorio)
3. **Campos Deseables**: Nombre, email, dirección

### 4.2 Validación y Normalización
1. **Formato de Entrada**: Múltiples formatos aceptados
2. **Normalización**: Conversión a esquema interno
3. **Validación**: Patrones regex y verificaciones de tipo
4. **Duplicados**: Verificación por teléfono

### 4.3 Enriquecimiento
1. **Historial**: Búsqueda de compras previas
2. **Preferencias**: Análisis de patrones de compra
3. **Contexto**: Información de conversaciones anteriores

## 5. Casos de Uso Específicos

### 5.1 Cliente Nuevo
```json
{
  "phone_number": "+5491123456789",
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "customerType": "final_consumer"
}
```

### 5.2 Cliente Empresarial
```json
{
  "phone_number": "+5491123456789",
  "name": "María González",
  "email": "compras@empresa.com",
  "company": "Transportes del Sur S.A.",
  "customerType": "tire_shop",
  "taxId": "30-12345678-9"
}
```

### 5.3 Información Mínima
```json
{
  "phone": "+5491123456789"
}
```

## 6. Mejores Prácticas

### 6.1 Para el Agente
- Solicitar número de teléfono como prioridad
- Capturar nombre y email cuando sea posible
- Utilizar información de conversaciones previas
- Validar información antes de crear registros

### 6.2 Para el Backend
- Aceptar múltiples formatos de entrada
- Normalizar datos automáticamente
- Validar contra patrones establecidos
- Mantener flexibilidad para campos opcionales

### 6.3 Para Integraciones
- Usar `resolveCustomer` para búsquedas flexibles
- Implementar fallbacks para información faltante
- Mantener consistencia en formatos de teléfono
- Documentar campos requeridos vs opcionales

## 7. Limitaciones y Consideraciones

### 7.1 Limitaciones Actuales
- Validación de teléfono no incluye formato específico
- No hay validación de direcciones
- Campos de empresa no tienen validación específica

### 7.2 Recomendaciones de Mejora
- Implementar validación de formato de teléfono argentino
- Agregar validación de direcciones
- Mejorar detección automática de tipo de cliente
- Implementar scoring de calidad de información

## 8. Endpoints Relacionados

### 8.1 Gestión de Clientes
- `POST /api/v1/customers/create` - Crear cliente
- `GET /api/v1/customers/{id}` - Obtener cliente
- `GET /api/v1/customers/phone/{phone}` - Buscar por teléfono
- `PUT /api/v1/customers/{id}` - Actualizar cliente

### 8.2 Información Contextual
- `GET /api/v1/customers/{id}/history` - Historial de compras
- `GET /api/v1/customers/{id}/analytics` - Análisis del cliente
- `POST /api/v1/customers/{id}/preferences` - Preferencias

## 9. Monitoreo y Métricas

### 9.1 Eventos del Agente (AgentEvent.ts)
- Captura de `clientId` y `clientName`
- Seguimiento de uso de herramientas
- Análisis de errores en extracción

### 9.2 Métricas Recomendadas
- Tasa de captura de información completa
- Tiempo promedio de identificación de cliente
- Errores de validación más comunes
- Efectividad de resolución automática

---

**Fecha de Actualización**: Enero 2025  
**Versión**: 1.0  
**Mantenido por**: Equipo de Desarrollo Freia
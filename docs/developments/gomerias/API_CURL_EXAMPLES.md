# Ejemplos de comandos `curl` para probar la API de Freia (Git Bash)

Este documento contiene ejemplos listos para ejecutar en **Git Bash** (o cualquier shell compatible con Bash) en Windows 11.

## 📋 Documentación Relacionada

Para información detallada sobre patrones de extracción y validación de información de clientes, consulte:
- [Patrones de Extracción de Información de Clientes](./CUSTOMER_INFORMATION_EXTRACTION_PATTERNS.md)

---
## Preparación
1. Abrí **Git Bash**.
2. Definí tu token de API en una variable de entorno:
   ```bash
   export FREIA_API_KEY="TU_TOKEN_AQUI"
   ```

> ⚠️ Todos los ejemplos usan la variable `${FREIA_API_KEY}` para autenticarse. Sustituí `TU_TOKEN_AQUI` por tu token real.

---
## 1. Crear Cliente

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/customers/create" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+5491123456789",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan.perez@test.com",
    "default_address": "Av. Corrientes 1234, Buenos Aires",
    "default_payment_method": "efectivo"
  }'
```

**Respuesta exitosa:**
```json
{
  "id": 21,
  "phone_number": "+5491123456789",
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan.perez@test.com",
  "default_address": "Av. Corrientes 1234, Buenos Aires",
  "default_payment_method": "efectivo",
  "previous_purchases": null,
  "created_at": "2025-09-23T21:10:47.723Z",
  "updated_at": "2025-09-23T21:10:47.723Z"
}
```

**Campos requeridos:**
- `phone_number`: Número de teléfono único (requerido)

**Campos opcionales:**
- `first_name`: Nombre
- `last_name`: Apellido  
- `email`: Email
- `default_address`: Dirección por defecto
- `default_payment_method`: Método de pago preferido

**Nota**: El backend también acepta `phone` en lugar de `phone_number` y puede dividir automáticamente un campo `name` en `first_name` y `last_name`.

## 2. Crear lead de venta

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/leads" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ana",
    "last_name": "Gómez",
    "phone": "+5491166677788",
    "email": "ana.gomez@example.com",
    "source": "landing_page",
    "chatflowid": "d8b0ebde-60d8-461c-9f5d-0fcc28729ebe"
  }'
```

**Respuesta exitosa:**
```json
{
  "email": "ana.gomez@example.com",
  "phone": "+5491166677788",
  "chatflowid": "3c0f8091-598c-4c9e-8b52-b627ea50d50c",
  "chatId": "3a6809c6-cf2f-48f2-b54c-36a8969d41a5",
  "id": "c17ad6a5-34bf-40ce-b83d-aa6131c75bcc",
  "createdDate": "2025-09-23T21:18:03.955Z"
}
```

**Campos requeridos:**
- `chatflowid`: ID del chatflow asociado (UUID requerido)

**Campos opcionales:**
- `first_name`: Nombre del lead
- `last_name`: Apellido del lead
- `phone`: Número de teléfono
- `email`: Email del lead
- `source`: Fuente del lead (ej: "landing_page", "whatsapp", etc.)

**Nota**: El `chatflowid` debe ser un UUID válido de un chatflow existente en el sistema. Cuando un usuario chatea normalmente en el canvas, el sistema reconoce automáticamente el `chatflowid` del chatflow activo.

## 3. Crear venta

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

**✅ NUEVA FUNCIONALIDAD: DETECCIÓN AUTOMÁTICA DE PRODUCTO**

El endpoint ahora puede detectar automáticamente el `product_sku` basándose en la conversación entre el cliente y el agente. Si no se proporciona `product_sku` en el request, el sistema analizará el historial de chat para identificar el producto discutido.

### Ejemplo 1: Con product_sku explícito (método tradicional)
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/create" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+5491155566677",
    "product_sku": "TIRE-BRIDGESTONE-205-55-R16",
    "product_brand": "Bridgestone",
    "product_model": "Turanza T005",
    "wheel_size": "205/55 R16",
    "quantity": 2,
    "unit_price": 45000.00,
    "total_price": 90000.00,
    "final_price": 85500.00,
    "discount_percentage": 5.0,
    "payment_method": "credit_card",
    "delivery_method": "pickup",
    "delivery_address": "Av. Corrientes 1234, CABA"
  }'
```

### Ejemplo 2: Con número local (se normaliza automáticamente)

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "phone_number": "1155566677",
    "product_sku": "MICH-22560R16-AS",
    "quantity": 4,
    "unit_price": 25000,
    "final_price": 100000,
    "payment_method": "efectivo"
  }'
```

### Ejemplo 3: Con detección automática de producto y número local
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/create" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+5491155566677",
    "chatflowid": "d8b0ebde-60d8-461c-9f5d-0fcc28729ebe",
    "sessionId": "session-123-abc",
    "chatId": "chat-456-def",
    "quantity": 2,
    "unit_price": 45000.00,
    "total_price": 90000.00,
    "final_price": 85500.00,
    "discount_percentage": 5.0,
    "payment_method": "credit_card",
    "delivery_method": "pickup",
    "delivery_address": "Av. Corrientes 1234, CABA"
  }'
```

**Formato de números de teléfono:** La API acepta números de teléfono en múltiples formatos y los normaliza automáticamente al formato internacional argentino (+549...):
- Formato local: `1145436567` → se convierte a `+5491145436567`
- Con área: `01145436567` → se convierte a `+5491145436567`
- Con prefijo móvil: `91145436567` → se convierte a `+5491145436567`
- Formato internacional: `+5491145436567` → se mantiene igual
- Con código de país sin +: `5491145436567` → se convierte a `+5491145436567`

**Campos requeridos:**
- `phone_number`: Número de teléfono del cliente (se normaliza automáticamente)
- `product_sku`: SKU del producto (NOT NULL) **O** contexto de conversación (`chatflowid`, `sessionId`, `chatId`)

**Campos para detección automática (alternativos a product_sku):**
- `chatflowid`: ID del chatflow donde ocurrió la conversación
- `sessionId`: ID de la sesión de chat
- `chatId`: ID específico del chat

**Campos opcionales:**
- `customer_id`: ID del cliente (si existe)
- `product_brand`: Marca del producto
- `product_model`: Modelo del producto
- `wheel_size`: Medida de la rueda
- `quantity`: Cantidad (default: 1)
- `unit_price`: Precio unitario
- `total_price`: Precio total
- `discount_percentage`: Porcentaje de descuento (default: 0)
- `final_price`: Precio final después del descuento
- `payment_method`: Método de pago
- `delivery_method`: Método de entrega
- `delivery_address`: Dirección de entrega
- `agent_notes`: Notas del agente

**Cómo funciona la detección automática:**
1. El sistema analiza los mensajes de la conversación buscando patrones de productos (marcas, modelos, medidas de neumáticos)
2. Si no encuentra información suficiente en el chat, busca en el historial de compras del cliente
3. Valida que el producto detectado existe en el inventario
4. Si no puede detectar un producto válido, devuelve un error solicitando el `product_sku` explícito

## 4. Reservar stock de producto

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/reserve" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PIR-C7-2055516",
    "quantity": 1,
    "phoneNumber": "+5491123456789",
    "reason": "customer_request",
    "agentId": "AGENT001",
    "notes": "Reserva para cliente prioritario",
    "expiresAt": "2025-01-24T12:00:00.000Z"
  }'
```

**Respuesta exitosa:**
```json
{
  "productId": "PIR-C7-2055516",
  "reservedQuantity": 1,
  "remainingStock": 44,
  "customerId": null,
  "agentId": "AGENT001"
}
```

**Campos requeridos:**
- `productId`: ID del producto (string, ej: "PIR-C7-2055516")
- `quantity`: Cantidad a reservar (número)
- `phoneNumber`: Número de teléfono del cliente
- `agentId`: ID del agente que realiza la reserva

**Campos opcionales:**
- `customerId`: ID del cliente (si existe en la base de datos)
- `reason`: Motivo de la reserva (default: "customer_request")
- `notes`: Notas adicionales sobre la reserva
- `expiresAt`: Fecha de expiración de la reserva (ISO string, default: 30 minutos desde ahora)

**Nota**: Si no se proporciona `expiresAt`, el sistema automáticamente establece la expiración en 30 minutos desde el momento de la reserva. El `customerId` es opcional y puede ser `null` si el cliente no está registrado en el sistema.

## 5. Avisar llegada de stock

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/notify" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PIR-PZERO-2454518",
    "clientId": "1",
    "phone_number": "+1234567890",
    "estimatedTime": "2024-01-15T10:00:00Z",
    "notifyChannel": "whatsapp"
  }'
```

**Respuesta exitosa:**
```json
{
  "message": "Notification registered",
  "followUp": {
    "id": 48,
    "customer_id": 1,
    "phone_number": "+1234567890",
    "sale_id": null,
    "follow_up_type": "stock_available",
    "scheduled_at": "2025-09-25T01:15:20.725Z",
    "completed_at": null,
    "status": "pending",
    "attempt_number": 1,
    "max_attempts": 3,
    "message_sent": "Notificar disponibilidad de P Zero 245/45 R18",
    "customer_response": null,
    "next_action": "phone",
    "created_at": "2025-09-24T01:15:20.725Z",
    "updated_at": "2025-09-24T01:15:20.725Z"
  }
}
```

**Campos requeridos:**
- `productId`: ID del producto (string, ej: "PIR-PZERO-2454518")
- `phone_number`: Número de teléfono del cliente (string, ej: "+1234567890")

**Campos opcionales:**
- `clientId`: ID del cliente (string o number)
- `customerId`: ID del cliente (alternativo)
- `estimatedTime`: Tiempo estimado de llegada (ISO 8601 string)
- `notifyChannel`: Canal de notificación (string, ej: "whatsapp", "phone")
- `notificationType`: Tipo de notificación (string, default: "stock_available")

**Nota**: El endpoint registra notificaciones de disponibilidad de stock. El sistema programa automáticamente el seguimiento basándose en el `estimatedTime` proporcionado. Si se proporciona `clientId`, el sistema resuelve automáticamente la información del cliente. El `next_action` se establece según el `notifyChannel` especificado.

## 6. Verificar stock de producto

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/check?productId=PIR-C7-2055516" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json"

# Ejemplo con código de producto:
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/check?productCode=TIRE-BRIDGESTONE-205-55-R16" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json"

# Ejemplo con medida de neumático:
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/check?tire_number=185/65R14" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json"
```

**Respuesta exitosa:**
```json
{
  "available": true,
  "product": {
    "productId": "PIR-C7-2055516",
    "name": "Pirelli Cinturato P7 205/55 R16",
    "brand": "Pirelli",
    "stock": 45,
    "price": "45000.50"
  }
}
```

**Respuesta cuando no hay stock:**
```json
{
  "available": false,
  "product": {
    "productId": "PIR-C7-2055516",
    "name": "Pirelli Cinturato P7 205/55 R16",
    "brand": "Pirelli",
    "stock": 0,
    "price": "45000.50"
  }
}
```

**Parámetros de consulta (al menos uno requerido):**
- `productId`: ID del producto (string, ej: "PIR-C7-2055516")
- `productCode`: Código alternativo o SKU del producto (string)
- `tire_number`: Número o medida de neumático (string, ej: "185/65R14")

**Nota**: Usá esta herramienta únicamente para confirmar stock y precio en la base operativa (Postgres). Primero identificá el producto con `gomeria_consultation`, que consulta el catálogo completo cargado en el catálogo vectorial "Gomeria-v1.2" (incluye neumáticos, accesorios, químicos y servicios). Si la API devuelve vacío o `available:false`, avisá al cliente que en el sistema todavía no está cargado pero el producto existe en el catálogo y ofrecé registrar seguimiento o alternativas.

## 7. Obtener información del cliente

**Endpoint**: `GET /api/v1/customers/{clientId}`

**Descripción**: Obtiene información completa de un cliente existente por su ID.

### Ejemplo de cURL:

```bash
# Obtener información de un cliente específico
curl -X GET "https://freia-agents.onrender.com/api/v1/customers/123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${FREIA_API_KEY}"
```

### Respuesta exitosa:
```json
{
  "id": 123,
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan.perez@email.com",
  "phone_number": "+5491123456789",
  "default_address": "Av. Corrientes 1234, CABA",
  "default_payment_method": "efectivo",
  "previous_purchases": 5,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

### Parámetros de ruta:
- `clientId` (requerido): ID único del cliente

### Notas de uso:
- Usar cuando se necesite consultar datos completos del cliente
- El ID debe ser un número entero válido
- Retorna error 404 si el cliente no existe

## 8. Verificar productos con stock bajo

### Descripción
Obtiene una lista de productos que tienen stock por debajo del umbral especificado.

### cURL Examples

**Con umbral personalizado:**
```bash
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/low-stock?threshold=15" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Con umbral por defecto (10 unidades):**
```bash
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/low-stock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Respuesta exitosa
```json
[
  {
    "productId": "PROD123",
    "name": "Neumático Michelin 205/55R16",
    "brand": "Michelin",
    "stock": 5,
    "price": 85000,
    "updatedDate": "2024-01-15T10:30:00Z"
  },
  {
    "productId": "PROD456", 
    "name": "Llanta Aleación 16\"",
    "brand": "OEM",
    "stock": 2,
    "price": 120000,
    "updatedDate": "2024-01-14T15:45:00Z"
  }
]
```

### Query Parameters
- `threshold` (opcional): Umbral de stock bajo. Por defecto es 10 unidades.

### Notas de uso
- Útil para alertas de inventario y reposición de stock
- Los productos se ordenan por stock ascendente y fecha de actualización descendente
- Ideal para generar reportes de productos que necesitan reposición

## 9. Buscar productos alternativos

**Endpoint**: `GET /api/v1/inventory/alternatives`

**Descripción**: Busca productos alternativos cuando el producto solicitado no tiene stock o el cliente busca opciones similares.

### Ejemplo de cURL:

```bash
# Buscar alternativas para un producto específico
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/alternatives?productId=TIRE001&maxResults=5" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Buscar alternativas por marca y categoría
curl -X GET "https://freia-agents.onrender.com/api/v1/inventory/alternatives?brand=Michelin&category=neumático&maxPriceDelta=0.3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Respuesta exitosa:
```json
{
  "alternatives": [
    {
      "productId": "TIRE002",
      "name": "Neumático Michelin Energy XM2",
      "brand": "Michelin",
      "price": 85000,
      "stock": 15,
      "priceDifference": 5000,
      "similarityScore": 0.8
    },
    {
      "productId": "TIRE003", 
      "name": "Neumático Bridgestone Ecopia",
      "brand": "Bridgestone",
      "price": 82000,
      "stock": 8,
      "priceDifference": 2000,
      "similarityScore": 0.7
    }
  ]
}
```

### Parámetros de consulta:
- `productId` (string, opcional): ID del producto de referencia
- `brand` (string, opcional): Marca preferida para filtrar
- `category` (string, opcional): Categoría del producto
- `maxPriceDelta` (string, opcional): Diferencia máxima de precio relativa (default: 0.2)
- `maxResults` (string, opcional): Número máximo de resultados (default: 5)

### Notas de uso:
- Si se proporciona `productId`, busca alternativas similares al producto de referencia
- Sin `productId`, busca productos disponibles según los filtros especificados
- El `similarityScore` indica qué tan similar es el producto alternativo al de referencia
- Solo devuelve productos con stock disponible

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/update" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PIR-C7-2055516",
    "stock": 100,
    "price": 45000.50
  }'

# Respuesta exitosa:
[{"productId":"PIR-C7-2055516","name":"Cinturato P7 205/55 R16","brand":"Pirelli","stock":100,"price":"45000.5","updatedDate":"2025-09-23T22:55:53.434Z"}]
```

**Respuesta exitosa:**
```json
{
  "productId": "PIR-C7-2055516",
  "name": "Pirelli Cinturato P7 205/55 R16",
  "brand": "Pirelli",
  "stock": 100,
  "price": "45000.50",
  "updatedDate": "2025-01-24T15:30:45.123Z"
}
```

**Campos requeridos:**
- `productId`: ID del producto (string, ej: "PIR-C7-2055516")

**Campos opcionales (al menos uno requerido):**
- `stock`: Nueva cantidad de stock (número entero)
- `price`: Nuevo precio del producto (número decimal)

**Nota**: Debes proporcionar al menos `stock` o `price`. Puedes actualizar ambos campos en la misma request.

## 9. Crear/actualizar preferencias del cliente

```bash
clientId=1
curl -X POST "https://freia-agents.onrender.com/api/v1/customers/${clientId}/preferences" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "preferredLanguage": "es",
    "receivePromotions": true
  }'
```

**Respuesta exitosa:**
```json
{
  "customer": [
    {
      "id": 1,
      "phone_number": "+54935161234567",
      "first_name": "Ricardo Montoya",
      "last_name": "Transportes Del Sur S.A.",
      "email": "compras@transportesdelsur.com",
      "default_address": "Parque Industrial Gral. Belgrano, Lote 14, Córdoba",
      "default_payment_method": null,
      "previous_purchases": "{\"preferences\":{\"preferredBrands\":[],\"preferredCategories\":[],\"priceRange\":null,\"paymentMethods\":[],\"deliveryPreference\":null,\"communicationPreference\":null,\"updatedAt\":\"2025-09-23T22:59:30.008Z\"}}",
      "created_at": "2025-09-23T04:20:07.153Z",
      "updated_at": "2025-09-23T22:59:30.007Z"
    }
  ],
  "preferences": {
    "preferredBrands": [],
    "preferredCategories": [],
    "priceRange": null,
    "paymentMethods": [],
    "deliveryPreference": null,
    "communicationPreference": null,
    "updatedAt": "2025-09-23T22:59:30.008Z"
  }
}
```

## 10. Crear notificación personalizada

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/create" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order_ready",
    "title": "Tu pedido está listo para retiro",
    "message": "Podés pasar a buscarlo cuando quieras",
    "priority": "high",
    "clientId": "1",
    "actionRequired": "pickup_confirmation"
  }'
```

**Respuesta exitosa:**
```json
{
  "message": "Notification stored",
  "followUp": {
    "id": 45,
    "customer_id": 123,
    "phone_number": "+5491123456789",
    "sale_id": null,
    "follow_up_type": "notification_order_ready",
    "scheduled_at": null,
    "completed_at": null,
    "status": "pending",
    "attempt_number": 1,
    "max_attempts": 1,
    "message_sent": "Tu pedido está listo para retiro: Podés pasar a buscarlo cuando quieras",
    "customer_response": null,
    "next_action": "pickup_confirmation",
    "created_at": "2025-01-24T16:30:45.123Z",
    "updated_at": "2025-01-24T16:30:45.123Z"
  }
}
```

**Campos requeridos:**
- `type`: Tipo de notificación (string, ej: "order_ready", "stock_available", "payment_reminder")
- `title`: Título de la notificación (string)
- `message`: Mensaje de la notificación (string)

**Campos opcionales:**
- `priority`: Prioridad de la notificación (string, default: "medium", opciones: "low", "medium", "high")
- `clientId`: ID del cliente (number)
- `saleId`: ID de la venta relacionada (number)
- `actionRequired`: Acción requerida (string)
- `dueDate`: Fecha límite (ISO string)
- `metadata`: Datos adicionales (object)

**Nota**: El sistema almacena las notificaciones en la tabla `follow_ups` con el tipo `notification_{type}`. Si se proporciona `clientId`, el sistema intentará resolver el número de teléfono del cliente automáticamente.

## 11. Enviar mensaje de WhatsApp

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

### Ejemplo básico de mensaje de texto
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/whatsapp/send" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5491155566677",
    "text": "Hola Juan, tu pedido está listo para retiro. ¡Podés pasar cuando quieras!"
  }'
```

### Ejemplo de notificación de stock disponible
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/whatsapp/send" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5491123456789",
    "text": "¡Buenas noticias! Ya tenemos disponible el neumático Bridgestone 205/55 R16 que estabas buscando. ¿Te interesa coordinar la compra?"
  }'
```

### Ejemplo de seguimiento post-venta
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/whatsapp/send" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5491166677788",
    "text": "Hola Ana, ¿cómo anduvieron los neumáticos que te instalamos la semana pasada? ¿Todo bien con el balanceado?"
  }'
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "data": {
    "message_id": "wamid.HBgNNTQ5MTE1NTU2NjY3NxUCABIYFjNBMzMzODMzMzMzMzMzMzMzMzMzAA==",
    "status": "sent"
  }
}
```

**Respuesta de error (campos faltantes):**
```json
{
  "message": "to and text are required"
}
```

**Respuesta de error (autorización):**
```json
{
  "error": "Unauthorized Access"
}
```

**Campos requeridos:**
- `to`: Número de teléfono de destino con código de país (string, ej: "+5491155566677")
- `text`: Contenido del mensaje de texto (string)

**Campos NO soportados:**
- ❌ `template`: No se usa en este endpoint
- ❌ `parameters`: No se usa en este endpoint
- ❌ `type`: No se usa en este endpoint

**Notas importantes:**
- El endpoint espera únicamente los campos `to` y `text`
- El sistema utiliza el servicio Wasender para el envío de mensajes
- Los mensajes se envían como texto plano, no como plantillas
- El número de teléfono debe incluir el código de país (ej: +54 para Argentina)
- El sistema valida automáticamente el formato del número de teléfono

## 11. Programar seguimiento (follow-up)

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/followup/schedule" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 1,
    "followUpType": "price_negotiation",
    "scheduledAt": "2025-01-25T18:00:00Z",
    "reason": "Llamar para confirmar satisfacción",
    "priority": "medium"
  }'
```

**Respuesta exitosa:**
```json
{
  "id": 36,
  "customer_id": 1,
  "phone_number": "+54935161234567",
  "sale_id": null,
  "follow_up_type": "price_negotiation",
  "scheduled_at": "2025-01-25T18:00:00.000Z",
  "completed_at": null,
  "status": "pending",
  "attempt_number": 1,
  "max_attempts": 3,
  "message_sent": null,
  "customer_response": null,
  "next_action": null,
  "created_at": "2025-01-24T17:45:30.123Z",
  "updated_at": "2025-01-24T17:45:30.123Z"
}
```

**Campos requeridos:**
- `clientId`: ID del cliente (number) **O** `phoneNumber` (string)
- `followUpType`: Tipo de seguimiento (string, ej: "price_negotiation", "abandoned_cart", "stock_available", "delivery_improvement")

**Campos opcionales:**
- `phoneNumber`: Número de teléfono (si no se proporciona clientId)
- `saleId`: ID de la venta relacionada (number)
- `scheduledAt`: Fecha y hora programada (ISO 8601 string, default: ahora)
- `reason`: Razón del seguimiento (string)
- `priority`: Prioridad (string, default: "medium", opciones: "low", "medium", "high")
- `attemptNumber`: Número de intento (number, default: 1)
- `maxAttempts`: Máximo número de intentos (number, default: 3)
- `productInterest`: Productos de interés (string)
- `lastInteractionDate`: Fecha de última interacción (ISO 8601 string)

**Nota**: El sistema puede resolver automáticamente el número de teléfono del cliente usando el `clientId`. Si solo se proporciona `phoneNumber`, el sistema intentará encontrar o crear el cliente correspondiente.

## 12. Actualizar estado de seguimiento

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/followup/update-status" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "followUpId": 38,
    "status": "completed",
    "result": "Cliente contactado exitosamente"
  }'
```

**Respuesta exitosa (ejemplo real probado):**
```json
{
  "followUp": [
    {
      "id": 38,
      "customer_id": 1,
      "phone_number": "+54935161234567",
      "sale_id": null,
      "follow_up_type": "notification_order_ready",
      "scheduled_at": "2025-09-23T23:55:35.130Z",
      "completed_at": "2025-09-24T00:15:37.556Z",
      "status": "completed",
      "attempt_number": 1,
      "max_attempts": 1,
      "message_sent": "Cliente contactado exitosamente",
      "customer_response": null,
      "next_action": "pickup_confirmation",
      "created_at": "2025-09-23T23:55:35.130Z",
      "updated_at": "2025-09-24T00:15:37.556Z"
    }
  ]
}
```

**Campos requeridos:**
- `followUpId`: ID del seguimiento (number, ej: 789)
- `status`: Nuevo estado (string, opciones: "pending", "in_progress", "completed", "cancelled", "failed")

**Campos opcionales:**
- `result`: Resultado o notas del seguimiento (string, se guarda en `message_sent`)
- `customerResponse`: Respuesta del cliente (string)
- `nextAction`: Próxima acción requerida (string)
- `rescheduleDate`: Nueva fecha programada (ISO 8601 string)
- `notes`: Notas adicionales (string, se combina con `message_sent`)

**Nota importante**: El campo correcto es `followUpId` (con "U" mayúscula), no `followupId`. El endpoint actualiza automáticamente `completed_at` cuando el status es "completed".

## 13. Aplicar código promocional

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/promotions/apply-code" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "promoCode": "FREIA10",
    "products": ["PIR-C7-2055516", "PIR-PZERO-2454518"]
  }'
```

**Respuesta exitosa:**
```json
{
  "promoCode": "FREIA10",
  "subtotal": 465000.5,
  "discountAmount": 46500.05,
  "total": 418500.45
}
```

**Campos requeridos:**
- `promoCode`: Código promocional (string, ej: "FREIA10", "FREIA20", "ENVIOGRATIS", "COMBOAUTO")

**Campos opcionales:**
- `products`: Array de IDs de productos para calcular el subtotal (array de strings)

**Códigos promocionales disponibles:**
- `FREIA10`: 10% de descuento
- `FREIA20`: 20% de descuento  
- `ENVIOGRATIS`: $15,000 de descuento fijo
- `COMBOAUTO`: 15% de descuento

**Nota**: Si no se proporcionan productos, el subtotal será 0 y solo se validará que el código promocional existe.

## 14. Generar cotización de venta

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

**✅ NUEVA FUNCIONALIDAD: DETECCIÓN AUTOMÁTICA DE PRODUCTO**

El endpoint ahora puede detectar automáticamente el `product_sku` basándose en la conversación entre el cliente y el agente. Si no se proporciona `product_sku` en el request, el sistema analizará el historial de chat para identificar el producto discutido.

### Ejemplo 1: Con product_sku explícito (método tradicional)
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/quote" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "product_sku": "MIC-P4-1956015",
    "quantity": 2
  }'
```

### Ejemplo 2: Con detección automática de producto (NUEVO)
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/quote" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 2,
    "chatflowid": "d8b0ebde-60d8-461c-9f5d-0fcc28729ebe",
    "sessionId": "session-123-abc",
    "chatId": "chat-456-def"
  }'
```

**Respuesta exitosa (método tradicional):**
```json
{
  "product_sku": "MIC-P4-1956015",
  "quantity": 2,
  "unit_price": 199500,
  "total_price": 399000
}
```

**Respuesta exitosa (con detección automática):**
```json
{
  "product_sku": "MIC-P4-1956015",
  "quantity": 2,
  "unit_price": 199500,
  "total_price": 399000,
  "analysis_info": {
    "auto_detected": true,
    "analysis_notes": "Auto-detected from conversation (confidence: 85.2%). Keywords: tire_size:225/60R16, brand:Michelin, intent_keywords:2"
  }
}
```

**Campos requeridos:**
- `product_sku`: SKU del producto (string, ej: "MIC-P4-1956015") **O** contexto de conversación (`chatflowid`, `sessionId`, `chatId`)

**Campos para detección automática (alternativos a product_sku):**
- `chatflowid`: ID del chatflow donde ocurrió la conversación
- `sessionId`: ID de la sesión de chat
- `chatId`: ID específico del chat

**Campos opcionales:**
- `quantity`: Cantidad deseada (number, default: 1)

**Cómo funciona la detección automática:**
1. El sistema analiza los mensajes de la conversación buscando patrones de productos (marcas, modelos, medidas de neumáticos)
2. Si no encuentra información suficiente en el chat, busca en el historial de compras del cliente
3. Valida que el producto detectado existe en el inventario
4. Si no puede detectar un producto válido, devuelve un error solicitando el `product_sku` explícito

**Nota**: El endpoint busca el producto por su SKU en la tabla `product_inventory` y calcula el precio total basado en la cantidad solicitada. Con la nueva funcionalidad, también puede inferir el producto desde el contexto de la conversación.

## 15. Notificar aprobación de precio

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/price-approval" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalRequestId": "20",
    "approved": true,
    "clientId": "321",
    "phoneNumber": "+5491123456789",
    "newPrice": 95000,
    "discountPercentage": 5,
    "validUntil": "2025-12-31T23:59:59Z",
    "reason": "Cliente frecuente"
  }'
```

**Respuesta exitosa:**
```json
{
  "message": "Price approval notification registered",
  "followUp": {
    "id": 40,
    "customer_id": null,
    "phone_number": "+5491123456789",
    "sale_id": 20,
    "follow_up_type": "price_approval",
    "scheduled_at": "2025-12-31T23:59:59.000Z",
    "completed_at": null,
    "status": "completed",
    "attempt_number": 1,
    "max_attempts": 1,
    "message_sent": "Solicitud de descuento aprobada",
    "customer_response": "{\"approved\":true,\"newPrice\":95000,\"discountPercentage\":5,\"reason\":\"Cliente frecuente\"}",
    "next_action": "confirm_sale",
    "created_at": "2025-09-24T00:47:07.629Z",
    "updated_at": "2025-09-24T00:47:07.629Z"
  }
}
```

**Campos requeridos:**
- `approvalRequestId`: ID de la solicitud de aprobación (string)
- `approved`: Si la solicitud fue aprobada o no (boolean)

**Campos opcionales:**
- `clientId`: ID del cliente (string)
- `phoneNumber`: Teléfono del cliente (string)
- `newPrice`: Nuevo precio aprobado (number)
- `discountPercentage`: Porcentaje de descuento otorgado (number)
- `validUntil`: Validez de la oferta en formato ISO 8601 (string)
- `reason`: Razón de la decisión (string)

**Nota**: El endpoint registra la notificación de aprobación/rechazo de precio, actualiza la venta correspondiente si el `approvalRequestId` es un ID de venta válido que existe en la base de datos, y crea un seguimiento en la tabla `follow_ups`. Si el `approvalRequestId` no corresponde a una venta existente, el seguimiento se creará sin referencia a una venta específica.

## 16. Mejorar entrega

**✅ ENDPOINT FUNCIONANDO CORRECTAMENTE**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/delivery-improvement" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryRequestId": "4",
    "clientId": "123",
    "phoneNumber": "+5491123456789",
    "improved": true,
    "newDeliveryTime": "3",
    "originalDeliveryTime": "7",
    "reason": "Disponibilidad de stock mejorada",
    "additionalCost": 5000
  }'
```

**Respuesta exitosa:**
```json
{
  "message": "Delivery notification registered",
  "followUp": {
    "id": 49,
    "customer_id": null,
    "phone_number": "+5491123456789",
    "sale_id": 4,
    "follow_up_type": "delivery_improvement",
    "scheduled_at": "2025-09-23T16:16:46.678Z",
    "completed_at": null,
    "status": "completed",
    "attempt_number": 1,
    "max_attempts": 1,
    "message_sent": "Se mejoró la entrega a 3 días",
    "customer_response": "{\"improved\":true,\"newDeliveryTime\":\"3\",\"originalDeliveryTime\":\"7\",\"reason\":\"Disponibilidad de stock mejorada\",\"additionalCost\":5000}",
    "next_action": "confirm_delivery",
    "created_at": "2025-09-23T16:16:47.769Z",
    "updated_at": "2025-09-23T16:16:47.769Z"
  }
}
```

**Campos requeridos:**
- `deliveryRequestId`: ID de la solicitud de mejora de entrega (string o number)
- `improved`: Si se mejoró el tiempo de entrega (boolean)
- `originalDeliveryTime`: Tiempo original de entrega en días (string o number)

**Campos opcionales:**
- `clientId`: ID del cliente (string)
- `phoneNumber`: Número de teléfono del cliente (string)
- `newDeliveryTime`: Nuevo tiempo de entrega en días (string o number)
- `reason`: Razón de la mejora o falta de mejora (string)
- `additionalCost`: Costo adicional por entrega express (number)

**Nota**: El endpoint registra notificaciones sobre mejoras en tiempos de entrega. Si `improved` es `true`, se considera que la entrega fue mejorada y se marca como completada. Si es `false`, queda pendiente para ofrecer alternativas. El sistema actualiza automáticamente las notas de la venta si el `deliveryRequestId` corresponde a una venta existente.

---
## Script de testing versátil (opcional)
Si querés automatizar las pruebas podés usar **Axios** en Node.js.

```javascript
// test-endpoints.js
import axios from 'axios';

const API = 'https://freia-agents.onrender.com/api/v1';
const TOKEN = process.env.FREIA_API_KEY;

const http = axios.create({
  baseURL: API,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function run() {
  try {
    const lead = await http.post('/leads', {
      first_name: 'Test',
      last_name: 'Auto',
      phone: '+5491111111111',
      email: 'test@example.com'
    });
    console.log('Lead creado:', lead.data);

    const quote = await http.post('/sales/quote', {
      clientId: 1,
      items: [{ productId: 45, quantity: 1 }]
    });
    console.log('Cotización:', quote.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}

run();
```

Ejecución:
```bash
npm install axios
export FREIA_API_KEY="TU_TOKEN_AQUI"
node test-endpoints.js
```

¡Listo! Ahora todos los ejemplos están adaptados para Git Bash en Windows 11.

---

## Flujo Completo de Aprobación de Precios

### Resumen del Flujo
El sistema de aprobación de precios de Freia permite que el agente conversacional solicite descuentos especiales y notifique las decisiones de aprobación. Este flujo involucra dos endpoints principales:

1. **Solicitud de Aprobación** (`/api/v1/sales/price-approval`) - El agente solicita aprobación para un descuento
2. **Notificación de Decisión** (`/api/v1/notifications/price-approval`) - Se notifica la decisión de aprobación

### Capacidades del Agente Conversacional

#### Extracción de Información
El agente (Lautaro) está configurado para extraer automáticamente la siguiente información durante conversaciones naturales:

- **Información del Cliente**: Nombre, teléfono, email, tipo de cliente
- **Detalles del Producto**: Marca, modelo, medida de neumáticos, cantidad
- **Contexto de Negociación**: Razones para descuento, historial de compras, segmento del cliente
- **Parámetros de Precio**: Precio original, descuento solicitado, precio final propuesto

#### Herramientas Disponibles para el Agente

**1. `request_price_approval`**
- **Endpoint**: `POST /api/v1/sales/price-approval`
- **Propósito**: Solicitar aprobación para descuentos especiales
- **Campos Extraídos**:
  - `quoteId`: ID de la cotización
  - `clientId`: ID del cliente
  - `requestedDiscount`: Porcentaje de descuento solicitado
  - `reason`: Justificación del descuento
  - `clientPhone`: Teléfono del cliente
  - `estimatedResponseTime`: Tiempo estimado de respuesta
  - `priority`: Prioridad de la solicitud

**2. `Notify_Price_Approval`**
- **Endpoint**: `POST /api/v1/notifications/price-approval`
- **Propósito**: Notificar decisión de aprobación al sistema
- **Campos Procesados**:
  - `approvalRequestId`: ID de la solicitud de aprobación
  - `approved`: Decisión (true/false)
  - `clientId`: ID del cliente
  - `phoneNumber`: Teléfono del cliente
  - `newPrice`: Nuevo precio aprobado
  - `discountPercentage`: Porcentaje de descuento aplicado
  - `validUntil`: Fecha de vencimiento de la oferta
  - `reason`: Razón de la decisión

### Estrategia de Precios Dinámicos

El agente utiliza un sistema inteligente de cálculo de precios que considera:

#### Descuentos por Volumen
- **10+ unidades**: 5% de descuento automático
- **20+ unidades**: 8% de descuento automático

#### Descuentos por Lealtad del Cliente
- **Cliente VIP**: 10% de descuento adicional
- **Cliente Regular**: 5% de descuento adicional

#### Descuentos por Liquidación de Stock
- **Stock > 100 unidades**: 3% de descuento adicional

#### Límites de Aprobación
- **Hasta 15%**: Aprobación automática del agente
- **Más de 15%**: Requiere aprobación manual (usa `request_price_approval`)

### Flujo de Conversación Típico

1. **Cliente expresa interés** en un producto
2. **Agente extrae información** del vehículo y necesidades
3. **Sistema calcula precio** con descuentos automáticos
4. **Si descuento > 15%**: Agente usa `request_price_approval`
5. **Supervisor revisa** y toma decisión
6. **Sistema notifica** usando `Notify_Price_Approval`
7. **Agente informa** al cliente la decisión final

### Estado Actual del Sistema

#### Funcionalidades Implementadas ✅
- **Endpoint de notificación** (`/api/v1/notifications/price-approval`) - Completamente funcional
- **Extracción de información** del agente - Configurada en V2CHATFLOW.json
- **Cálculo de precios dinámicos** - Implementado en sales-agent.js
- **Validación de datos** - Backend procesa todos los campos requeridos

#### Funcionalidades Pendientes ⚠️
- **Endpoint de solicitud** (`/api/v1/sales/price-approval`) - Actualmente es un stub
- **Tabla price_approval_requests** - No existe en la base de datos
- **Flujo de aprobación interno** - Requiere implementación completa

### Recomendaciones para Implementación Completa

1. **Crear tabla `price_approval_requests`** en PostgreSQL
2. **Implementar lógica completa** en `/api/v1/sales/price-approval`
3. **Agregar sistema de notificaciones** para supervisores
4. **Implementar dashboard** para gestión de aprobaciones
5. **Configurar reglas de negocio** personalizables por producto/cliente

### Ejemplo de Conversación Exitosa

```
Cliente: "Hola, necesito 4 neumáticos 205/55R16 para mi Corolla"
Agente: "Perfecto, tengo excelentes opciones. ¿Cuál es su nombre y teléfono?"
Cliente: "Juan Pérez, +5491123456789"
Agente: "Gracias Juan. Para 4 neumáticos Bridgestone 205/55R16, el precio es $95,000"
Cliente: "¿No hay descuento? Soy cliente hace 3 años"
Agente: "Como cliente regular, puedo ofrecerle 5% de descuento. ¿Le parece bien $90,250?"
Cliente: "¿Y si compro 8 neumáticos?"
Agente: "Excelente! Por volumen (8 unidades) + cliente regular = 10% descuento total: $85,500"
```

En este ejemplo, el agente:
- ✅ Extrajo información del cliente (nombre, teléfono)
- ✅ Identificó el producto específico (205/55R16)
- ✅ Aplicó descuentos automáticos (cliente regular + volumen)
- ✅ Mantuvo el descuento dentro del límite del 15%
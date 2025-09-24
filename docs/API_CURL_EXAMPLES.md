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

### Ejemplo 2: Con detección automática de producto (NUEVO)
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

**Campos requeridos:**
- `phone_number`: Número de teléfono del cliente (NOT NULL)
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

**⚠️ ENDPOINT CON PROBLEMAS CONOCIDOS**

```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/notify" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PIR-PZERO-2454518",
    "clientId": "12345",
    "phone_number": "+1234567890",
    "estimatedTime": "2024-01-15T10:00:00Z",
    "notifyChannel": "whatsapp"
  }'
```

**⚠️ PROBLEMA CONOCIDO - Error 500:**
```json
{
  "statusCode": 500,
  "success": false,
  "message": "null value in column \"phone_number\" of relation \"follow_ups\" violates not-null constraint",
  "stack": {}
}
```

**Detalles del problema:**
- **Error**: `null value in column "phone_number" of relation "follow_ups" violates not-null constraint`
- **Causa**: El endpoint no está procesando correctamente el campo `phone_number` del request body
- **Estado**: Bug persistente - requiere investigación adicional del código del controlador
- **Parámetros SQL observados**: `[null,null,"stock_available",null,"pending","Notificar disponibilidad de P Zero 245/45 R18","phone"]`
- **Observaciones**: 
  - Los valores `customer_id`, `phone_number` y `scheduled_at` llegan como `null` a la base de datos
  - El debug logging agregado no aparece en los logs, sugiriendo problemas de recarga de código
  - El servidor se reinició múltiples veces pero el problema persiste

**Campos requeridos (según esquema DB):**
- `productId`: ID del producto (string)
- `phone_number`: Número de teléfono (VARCHAR(20) NOT NULL)
- `scheduled_at`: Fecha programada (TIMESTAMP NOT NULL)

**Campos opcionales:**
- `clientId`: ID del cliente
- `customerId`: ID del cliente (alternativo)
- `estimatedTime`: Tiempo estimado (se mapea a scheduled_at)
- `notifyChannel`: Canal de notificación
- `notificationType`: Tipo de notificación (default: "stock_available")

## 6. Actualizar inventario

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

## 7. Crear/actualizar preferencias del cliente

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

## 8. Crear notificación personalizada

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

## 9. Enviar mensaje de WhatsApp

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

## 10. Programar seguimiento (follow-up)

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

## 11. Actualizar estado de seguimiento

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

## 12. Aplicar código promocional

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

## 13. Generar cotización de venta

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

## 14. Solicitar aprobación de precio
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/price-approval" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 456,
    "approverId": 321,
    "discountPercent": 5
  }'
```

## 15. Mejorar entrega
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/delivery-improvement" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": 456,
    "newDeliveryDate": "2025-10-07"
  }'
```

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
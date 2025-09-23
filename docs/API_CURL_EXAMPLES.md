# Ejemplos de comandos `curl` para probar la API de Freia (Git Bash)

Este documento contiene ejemplos listos para ejecutar en **Git Bash** (o cualquier shell compatible con Bash) en Windows 11.

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

**❌ ENDPOINT NO FUNCIONAL**

**Estado actual:** REQUIERE IMPLEMENTACIÓN O CORRECCIÓN

El endpoint está devolviendo un error "Product not found" lo que indica que:
- El endpoint no está implementado correctamente
- El producto con ID especificado no existe en el inventario
- Los parámetros esperados pueden ser diferentes

**Error actual:**
```json
{
  "statusCode": 404,
  "success": false,
  "message": "Product not found",
  "stack": {}
}
```

**Ejemplo de uso (una vez corregido):**
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/reserve" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 45,
    "quantity": 3,
    "clientId": 123,
    "reservationTime": "2025-10-01T12:00:00Z"
  }'
```

## 5. Avisar llegada de stock
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/notify" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 45,
    "clientId": 123,
    "estimatedTime": "2025-10-05T15:00:00Z",
    "notifyChannel": "email"
  }'
```

## 6. Actualizar inventario
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/inventory/update" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 45,
    "newQuantity": 100
  }'
```

## 7. Crear/actualizar preferencias del cliente
```bash
clientId=123 # variable de ejemplo
curl -X POST "https://freia-agents.onrender.com/api/v1/customers/${clientId}/preferences" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "preferredLanguage": "es",
    "receivePromotions": true
  }'
```

## 8. Crear notificación personalizada
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/notifications/create" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 123,
    "title": "Tu pedido está listo para retiro",
    "body": "Podés pasar a buscarlo cuando quieras",
    "channel": "whatsapp"
  }'
```

## 9. Enviar mensaje de WhatsApp
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/whatsapp/send" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5491155566677",
    "template": "pedido_listo",
    "parameters": ["Juan"]
  }'
```

## 10. Programar seguimiento (follow-up)
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/followup/schedule" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 123,
    "date": "2025-10-10T18:00:00Z",
    "note": "Llamar para confirmar satisfacción"
  }'
```

## 11. Actualizar estado de seguimiento
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/followup/update-status" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "followupId": 789,
    "status": "completed",
    "result": "Cliente satisfecho"
  }'
```

## 12. Aplicar código promocional
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/promotions/apply-code" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 123,
    "code": "BIENVENIDA10"
  }'
```

## 13. Generar cotización de venta
```bash
curl -X POST "https://freia-agents.onrender.com/api/v1/sales/quote" \
  -H "Authorization: Bearer ${FREIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": 123,
    "items": [
      { "productId": 45, "quantity": 2 }
    ]
  }'
```

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
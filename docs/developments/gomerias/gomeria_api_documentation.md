# 📘 API Documentation - Gomería Agent v1.2

This document contains the full specification of all API endpoints we defined step by step in our conversation.  
It includes **GET** and **POST** endpoints, their headers, query parameters or body schemas, and usage examples.  
Use this as the reference for your integration.

---

## 🔑 General Notes
- All requests must include the following header:

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer freia-api-key-2024"
}
```

- For **GET** requests with no query parameters but a `/{id}` in the path, the parameter should be treated as `in: path`.
- For **POST** requests, leave the **Body** field empty (`{}` if required by UI) and rely on the **Body Schema**.

---

## 📦 Endpoints

### 1. Update Product Stock (POST)
**Description:** Actualiza el stock de un producto después de una venta confirmada.

**Body Schema:**
```json
{
  "productId": { "type": "string", "required": true, "in": "body", "description": "ID del producto" },
  "quantity": { "type": "integer", "required": true, "in": "body", "description": "Cantidad vendida (negativo para reducir stock)" },
  "saleId": { "type": "string", "required": true, "in": "body", "description": "ID de la venta asociada" },
  "reason": { "type": "string", "required": false, "in": "body", "description": "Motivo del cambio de stock" }
}
```

---

### 2. Check Product Stock (GET)
**Description:** Verifica el stock disponible de un producto específico.

**Query Params Schema:**
```json
{
  "productId": { "type": "string", "required": false, "in": "query", "description": "ID del producto a verificar" },
  "productCode": { "type": "string", "required": false, "in": "query", "description": "Código alternativo" },
  "productName": { "type": "string", "required": false, "in": "query", "description": "Nombre del producto" }
}
```

---

### 3. Check Low Stock (GET)
**Description:** Obtiene lista de productos con stock bajo (por defecto menos de 20).

**Query Params Schema:**
```json
{
  "threshold": { "type": "integer", "required": false, "in": "query", "description": "Umbral de stock bajo (default: 20)" }
}
```

---

### 4. Reserve Product Stock (POST)
**Description:** Reserva stock de un producto durante el proceso de venta.

**Body Schema:**
```json
{
  "productId": { "type": "string", "required": true, "in": "body", "description": "ID del producto a reservar" },
  "quantity": { "type": "integer", "required": true, "in": "body", "description": "Cantidad a reservar" },
  "clientId": { "type": "string", "required": true, "in": "body", "description": "ID del cliente" },
  "reservationTime": { "type": "integer", "required": false, "in": "body", "description": "Tiempo de reserva en minutos (default: 30)" }
}
```

---

### 5. New Client (POST)
**Description:** Crea un nuevo cliente en el sistema.

**Body Schema:**
```json
{
  "name": { "type": "string", "required": true, "description": "Nombre del cliente" },
  "email": { "type": "string", "required": true, "description": "Email del cliente" },
  "phone": { "type": "string", "required": false, "description": "Teléfono" },
  "address": { "type": "string", "required": false, "description": "Dirección" },
  "customerType": { "type": "string", "required": true, "description": "Tipo de cliente: consumer/business" },
  "company": { "type": "string", "required": false, "description": "Empresa (si aplica)" }
}
```

---

### 6. New Sale (POST)
**Description:** Crea una nueva venta en el sistema.

**Body Schema:**
```json
{
  "customer_id": { "type": "string", "required": true, "description": "ID del cliente" },
  "items": { "type": "array", "required": true, "description": "Array con productos y cantidades" },
  "total_amount": { "type": "number", "required": true, "description": "Monto total" },
  "payment_method": { "type": "string", "required": true, "description": "Método de pago" },
  "delivery_method": { "type": "string", "required": false, "description": "Método de entrega" },
  "delivery_address": { "type": "string", "required": false, "description": "Dirección de entrega" },
  "estimated_delivery": { "type": "string", "required": false, "description": "Fecha estimada" },
  "requires_invoice": { "type": "boolean", "required": false, "description": "Si requiere factura A" },
  "notes": { "type": "string", "required": false, "description": "Notas adicionales" }
}
```

---

### 7. Follow Up (POST)
**Description:** Crea un seguimiento de clientes que no completaron la compra.

**Body Schema:**
```json
{
  "customer_id": { "type": "string", "required": true, "description": "ID del cliente" },
  "reason": { "type": "string", "required": true, "description": "Razón del seguimiento" },
  "priority": { "type": "string", "required": false, "description": "Prioridad (high, medium, low)" },
  "scheduled_date": { "type": "string", "required": false, "description": "Fecha programada" },
  "notes": { "type": "string", "required": false, "description": "Notas adicionales" },
  "contact_method": { "type": "string", "required": false, "description": "Método de contacto (phone, email)" }
}
```

---

### 8. Get Customer Information (GET)
**URL:** `/api/v1/customers/{clientId}`

**Query Params Schema:**
```json
{
  "clientId": { "type": "string", "required": true, "in": "path", "description": "ID del cliente" }
}
```

---

### 9. Get Sale Summary (GET)
**URL:** `/api/v1/sales/{saleId}/summary`

**Query Params Schema:**
```json
{
  "saleId": { "type": "string", "required": true, "in": "path", "description": "ID de la venta" }
}
```

---

### 10. Request Delivery Improvement (POST)
**Description:** Solicitud para mejorar el tiempo de entrega.

**Body Schema:**
```json
{
  "quoteId": { "type": "string", "required": true },
  "clientId": { "type": "string", "required": true },
  "currentDeliveryTime": { "type": "integer", "required": true },
  "requestedDeliveryTime": { "type": "integer", "required": true },
  "reason": { "type": "string", "required": false },
  "clientPhone": { "type": "string", "required": false },
  "priority": { "type": "string", "required": false }
}
```

---

(…)

---

## 📌 Notes
This documentation continues with **all other endpoints** we detailed:  
- Notifications  
- Discounts (requests + auto)  
- Campaigns  
- Bundles  
- Rewards  
- Quotes  
- Deliveries  
- Rejections / Alternatives  
- Customer analytics & preferences  

Each follows the same structure with **Headers + Body/Query Params Schema + Examples**.

---


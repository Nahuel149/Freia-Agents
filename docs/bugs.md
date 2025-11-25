# Bugs y Problemas Identificados en Freia

## Problema Principal: Formato Incorrecto de JSON Schema

### Resumen
Se identificaron **24 de 26 schemas** (92%) que utilizan un formato incorrecto en lugar del estándar JSON Schema en el archivo `Chatflowv1.0.json`.

### Descripción del Problema
Los schemas utilizan un formato personalizado incorrecto:
```json
"propertyName": {
  "type": "string",
  "required": true,
  "in": "body",
  "description": "..."
}
```

En lugar del formato correcto de JSON Schema:
```json
{
  "type": "object",
  "properties": {
    "propertyName": {
      "type": "string",
      "description": "..."
    }
  },
  "required": ["propertyName"]
}
```

## Schemas con Formato Problemático (24 total)

1. **Update_Product_Stock** - Formato incorrecto
2. **new_client** - Formato incorrecto
3. **new_sale** - Formato incorrecto
4. **follow_up** - Formato incorrecto
5. **reserve_product_stock** - Formato incorrecto
6. **Stock_Arrive_Noti** - Formato incorrecto
7. **create_new_customer** - Formato incorrecto
8. **create_sales_lead** - Formato incorrecto
9. **save_customer_preferences** - Formato incorrecto
10. **create_custom_bundle** - Formato incorrecto
11. **send_whatsapp** - Formato incorrecto
12. **Notify_Price_Approval** - Formato incorrecto
13. **execute_follow_up** - Formato incorrecto
14. **Notify_delivery_timeimprovement** - Formato incorrecto
15. **Notify_Stock_Available** - Formato incorrecto
16. **update_followup_status** - Formato incorrecto
17. **create_system_notification** - Formato incorrecto
18. **apply_promotional_code** - Formato incorrecto
19. **create_product_quote** - Formato incorrecto
20. **request_delivery_time** - Formato incorrecto
21. **generate_order_number** - Formato incorrecto
22. **apply_discount** - Formato incorrecto
23. **request_price_approval** - Formato incorrecto
24. **start_prediction_listener** - Formato incorrecto

## Schemas con Formato Correcto (2 total)

1. **create_promotional_campaign** - ✅ Usa correctamente `"required": ["clientId", "campaignName", "discountType", "discountValue", "startDate", "endDate"]`
2. **create_sale_record** - ✅ Usa correctamente `"required": ["quoteId", "clientId", "products", "totalAmount", "paymentMethod", "deliveryMethod"]`

## Impacto del Problema

### Problemas Técnicos
- **Validación de API**: Los schemas no pueden ser utilizados por herramientas estándar de validación JSON Schema
- **Compatibilidad**: Incompatible con librerías y frameworks que esperan JSON Schema estándar
- **Documentación**: Las herramientas de generación de documentación no pueden procesar estos schemas
- **Testing**: Herramientas de testing automático no pueden validar requests/responses

### Problemas de Desarrollo
- **Mantenimiento**: Formato personalizado dificulta el mantenimiento
- **Integración**: Problemas al integrar con herramientas de terceros
- **Escalabilidad**: Dificulta la expansión del sistema con nuevas herramientas

## Solución Recomendada

### Acción Inmediata
1. **Convertir todos los schemas problemáticos** al formato JSON Schema estándar
2. **Mover propiedades `"required": true`** a un array `"required"` a nivel raíz
3. **Eliminar propiedades `"in": "body"`** de las definiciones individuales
4. **Validar** que todos los schemas sigan JSON Schema Draft 7

### Ejemplo de Conversión
**Antes (Incorrecto):**
```json
"requestsPostBodySchema": "{\n  \"clientId\": {\n    \"type\": \"string\",\n    \"required\": true,\n    \"in\": \"body\",\n    \"description\": \"ID del cliente\"\n  },\n  \"productId\": {\n    \"type\": \"string\",\n    \"required\": false,\n    \"in\": \"body\",\n    \"description\": \"ID del producto\"\n  }\n}"
```

**Después (Correcto):**
```json
"requestsPostBodySchema": "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"clientId\": {\n      \"type\": \"string\",\n      \"description\": \"ID del cliente\"\n    },\n    \"productId\": {\n      \"type\": \"string\",\n      \"description\": \"ID del producto\"\n    }\n  },\n  \"required\": [\"clientId\"]\n}"
```

## Prioridad
**ALTA** - Este problema afecta la funcionalidad core del sistema y debe ser resuelto antes de cualquier integración con herramientas de validación o documentación automática.

## Archivos Afectados
- `docs/Chatflowv1.0.json` - Archivo principal con 24 schemas problemáticos
- `docs/testing Agents.json` - Posiblemente afectado (requiere verificación)
- `docs/test1.3 Chatflow (2).json` - Posiblemente afectado (requiere verificación)

## Fecha de Identificación
Enero 2025

## Estado
🔴 **PENDIENTE** - Requiere corrección inmediata
# Historias de Usuario (Pago Híbrido Mobbex/dLocal) - Seguridad y Operación

## P0 - Disponibilidad y Persistencia
- **PAGO-1**: Como usuario autenticado quiero iniciar un checkout (AR→Mobbex, resto→dLocal) para completar mi compra.  
  - Criterios: endpoint `/api/v1/payments/checkout` requiere auth; valida payload con Zod; retorna `redirectUrl` (dLocal) o `checkoutId` (Mobbex).  
  - Hecho cuando: se crea intención en pasarela y obtengo URL/UID.  
- **PAGO-2**: Como sistema quiero persistir cada intento de pago con idempotencia para evitar dobles entregas.  
  - Criterios: tabla `payment_transaction` (UNIQUE provider+external_ref, jsonb metadata, integrity_hash); montos en centavos.  
  - Hecho cuando: webhook repetido no duplica COMPLETED y mantiene estado final.

## P0 - Seguridad Webhooks / Integridad
- **PAGO-3**: Como sistema quiero validar firma HMAC de webhooks (Mobbex/dLocal) para rechazar orígenes falsos.  
  - Criterios: usa rawBody + secreto; 400 en mismatch; registra evento redactado.  
  - Hecho cuando: solo webhooks con firma válida actualizan `payment_transaction`.
- **PAGO-4**: Como sistema quiero garantizar HTTPS y headers seguros para tráfico de pagos.  
  - Criterios: `helmet` habilitado; trust proxy + redirect a HTTPS en prod; CORS restringido.  
  - Hecho cuando: requests http son redirigidas/denegadas y headers de seguridad activos.

## P1 - Protección y Auditoría
- **PAGO-5**: Como sistema quiero rate limiting en `/payments/checkout` y `/webhooks/*` para mitigar spam/DoS.  
  - Criterios: límites configurables, respuesta 429 en abuso.  
  - Hecho cuando: se registran rechazos por exceso y no afecta flujos normales.
- **PAGO-6**: Como sistema quiero que logs redacten PII y datos sensibles por defecto.  
  - Criterios: logger global aplica redacción; servicios de pago solo registran campos no sensibles; sin payloads completos de tarjeta/PII.  
  - Hecho cuando: auditoría confirma ausencia de datos sensibles en logs.

## P1 - Validación de negocio
- **PAGO-7**: Como sistema quiero validar monto/currency contra la orden en DB antes de crear el checkout para evitar montos arbitrarios.  
  - Criterios: `/payments/checkout` busca la orden por `orderId`, compara amount/currency y rechaza si difiere.  
  - Hecho cuando: prueba de discrepancia devuelve 400 y no crea checkout.

## P2 - Configuración y Operación
- **PAGO-8**: Como DevOps quiero que las variables de pago estén documentadas y versionadas en `.env.example`.  
  - Criterios: sección pagos con MOBBEX_*, DLOCAL_*, CALLBACK/RETURN URLs; nota de rotación de secretos.  
  - Hecho cuando: archivo actualizado y referenciado en despliegues.
- **PAGO-9**: Como operador quiero monitorear errores de webhooks y rechazos de firma.  
  - Criterios: logs con eventos de firma inválida (sin PII), métricas o contador para alertas.  
  - Hecho cuando: se puede ver en logs/metrics los eventos y disparar alertas.
  - Futuro: exponer contador de firmas inválidas (prom-client ya disponible) y alertar; si no hay Prometheus, usar log estructurado + contador in-memory.

## P3 - Endurecimiento adicional (futuro)
- **PAGO-11**: Como operador quiero limitar orígenes (CORS) y redirects de pago a una allowlist fija.  
  - Criterios: env `ALLOWED_ORIGINS` (URLs fijas de frontend) aplicada a CORS; redirects de pago validados contra URLs permitidas.  
  - Beneficio: reduce superficie de CSRF/Open Redirect; requiere actualizar la lista si se agregan nuevos dominios/staging.

## P2 - UX/Frontend
- **PAGO-10**: Como usuario quiero un botón de pago que maneje redirección (dLocal) o checkoutId (Mobbex) sin exponer datos sensibles en cliente.  
  - Criterios: componente usa `/payments/checkout`; redirige a URL/checkout público; no almacena datos sensibles en localStorage.  
  - Hecho cuando: flujo en UI funciona con usuario autenticado y sin datos sensibles.

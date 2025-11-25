# Plan de Auditoría Integral (Aplicación Completa)

## 1. Base de Datos y ORM
- [x] Reconciliar esquema vs entidades TypeORM (todos los paquetes): pagos, landing templates, ApiKey/workspace PK; workspace_user PK compuesta ok; workspaceId es uuid en tablas clave.
- [x] Revisar tablas nuevas de pagos: `payment_transaction`, `payment_quote` (índices, PK/UK listados).
- [ ] Validar integridad en tablas críticas (`user`, `workspace`, `apikey`, `sales`, `chat_flow`, etc.): user/workspace/apikey/chat_flow/document_store verificados; `sales` ahora tiene `sale_uuid`, `amount_cents`, `currency` (default USD) con backfill; filas con amount_cents=0 fueron eliminadas (26 registros restantes).
- [x] Revisar migraciones aplicadas y faltantes en cada ambiente; limpiar tablas legacy. (Últimas aplicadas hasta `AddPaymentQuoteIndex1761000000005`; tabla `api_key` ya eliminada.)
- [x] Resolver drifts restantes: `Role` entidad alineada a tabla `role` (uuid org, sin accountId); `WorkspaceUsers` apunta a `workspace_user` con PK compuesta y campos uuid.

## 2. Seguridad y Autenticación
- [ ] Revisar middleware auth (JWT/cookies), expiración, storage de tokens, headers seguros.
- [ ] CORS/Allowlist de orígenes y redirects; configurar `ALLOWED_ORIGINS`.
- [ ] HTTPS/headers: `helmet`, `FORCE_HTTPS`, trust proxy.
- [ ] Rate limiting en endpoints sensibles (auth, checkout, webhooks, API públicas).
- [ ] Verificación HMAC en webhooks (pagos y otros servicios) y manejo idempotente.

## 3. Pagos
- [ ] Validar flujos Mobbex/dLocal end-to-end (checkout, webhook, idempotencia, hash).
- [ ] Validación de montos: SKUs fijos/variables, quotes asignados a usuario, fallback a `sales`.
- [ ] Notificación por email de quotes (SMTP configurado).
- [ ] Logs sin PII en pagos; métricas/alertas de firmas inválidas.

## 4. Roles y Permisos
- [ ] Revisar `permission` en rutas frontend y backend (RequireAuth, checkPermission stubs).
- [ ] Verificar que acciones admin (quotes, settings) estén restringidas a super-admin.

## 5. API y Rutas
- [ ] Listar y revisar rutas `/api/v1/*` para inputs validados (Zod/DTO), sanitización y errores controlados.
- [ ] Asegurar que endpoints públicos están en whitelist y no exponen datos sensibles.

## 6. Logging y Observabilidad
- [ ] Logger global con redacción (body/headers/query) consistente en toda la app.
- [ ] Configurar métricas básicas (errores, 4xx/5xx, firmas inválidas) si se usa Prometheus/logs estructurados.
- [ ] Revisión de niveles de log en producción.

## 7. Frontend
- [ ] Navegación y permisos en sidebar/rutas (Payments, etc.).
- [ ] Manejo seguro de tokens (no exponer secretos en UI).
- [ ] Validación de inputs en formularios clave (checkout, quotes, auth).

## 8. Configuración y Secrets
- [ ] `.env` y ejemplos actualizados (pagos, SMTP, rate limits, HTTPS, CORS).
- [ ] Reglas de rotación y almacenamiento seguro de claves.

## 9. Tests y Calidad
- [ ] Tests críticos (pagos, auth, webhooks) y smoke tests.
- [ ] Lint/format y build en CI.

## 10. Datos y Operación
- [ ] Consistencia de datos legados (limpieza de tablas obsoletas).
- [ ] Backups, planes de restore, seeds y scripts operativos.

# Landing Revamp (style: wisprflow-like, colors naranja/azul)

## Contexto ampliado
- Inspiración: wisprflow.ai (hero cinemático, gradientes, interactividad), pero con paleta propia naranja + azul y assets actuales en `packages/ui/public/assets` (Demo.png, Freia.png) más nuevas ilustraciones optimizadas (webp/png).
- Producto: Freia ofrece agentes/agentflows, chatflows, document stores, pagos (Mobbex/dLocal con quotes y SKUs), templates por industria (hotel/gomerías/retail) y rol de super-admin con gestión de templates/pagos.
- Objetivo: contar la historia en 5–7 secciones scroll, con CTA a signup/checkout y prueba guiada, animaciones ligeras y responsive.

## User Stories (Jira-style, detalladas)
- **LAND-1 (Hero/CTA)** — Como visitante, quiero un hero con fondo animado (gradiente/orange-blue), headline claro, subtítulo de valor (agentes + pagos seguros), y dos CTAs: “Probar demo” (templated flows) y “Crear cuenta”. Quiero ver una animación breve (loop <6s) o mock interactivo usando `Freia.png`/`Demo.png`.
- **LAND-2 (Narrativa)** — Como visitante, quiero un recorrido corto (problema→solución→cómo funciona) con texto conciso y visuales (capturas de agentflow/chatflow/pagos) para entender en <20s qué hace Freia.
- **LAND-3 (Features interactivas)** — Como visitante, quiero tarjetas con hover/reveal que expliquen:
  - Agentes/agentflow con guardado seguro (DB Postgres) y permisos por workspace.
  - Pagos híbridos (Mobbex/dLocal) con idempotencia/HMAC y quotes asignables por super-admin.
  - Landing templates por industria (hotel/gomerías/retail) con asignación por rol.
  - Document store y chatflows con workspaceId uuid (multitenant).
- **LAND-4 (Casos de uso)** — Como visitante, quiero un carrusel swipeable (mobile-friendly) con 3 casos: hotel, gomerías, retail; cada slide con CTA “Ver demo” que apunte a los slug autorizados via `/api/templates`.
- **LAND-5 (Cómo funciona)** — Como visitante, quiero ver 3 pasos animados: (1) Selecciona template/flow, (2) Configura agentes y pagos, (3) Despliega y cobra. Cada paso con ilustración/mini captura y micro-animación.
- **LAND-6 (Métricas/confianza)** — Como visitante, quiero ver métricas (agents creados, latencia objetivo, uptime), badges de seguridad (HMAC, HTTPS, rate limit) y, si hay, logos/testimonios.
- **LAND-7 (Pricing/planes)** — Como visitante, quiero una sección de pricing resumido: plan base (suscripción $500/mes) y add-ons (agentes adicionales $200 c/u), más opción “Pago custom/quote” para empresas (link a flujo de quote). CTA a checkout protegido (requiere login).
- **LAND-8 (CTAs persistentes)** — Como visitante, quiero que el header sea sticky con CTA, y en mobile haya un botón flotante “Empezar” siempre accesible.
- **LAND-9 (Mobile-first)** — Como usuario móvil, quiero carruseles táctiles, colapsar tarjetas en acordeones y tipografía legible; sin overflow horizontal.
- **LAND-10 (Performance/accesibilidad)** — Como usuario, quiero que las animaciones sean livianas (CSS/Framer/GSAP con lazy-load), que el sitio cargue rápido (Lighthouse ≥90) y accesible (AA, focus visible, alt en imágenes).
- **LAND-11 (Footer útil)** — Como visitante, quiero un footer con enlaces a docs (`docs/how to use`), seguridad/pagos, contacto/soporte, y links a login/signup.
- **LAND-12 (SEO/Meta)** — Como visitante que llega de búsqueda, quiero metatags/OG con el pitch correcto (agentes + pagos seguros) y favicon coherente.

## Criterios de aceptación generales
- Paleta: naranja/azul (marca), gradientes suaves, sin morado. Glassmorphism ligero permitido.
- Tipografía: moderna (ej. Space Grotesk/Manrope/Sora), consistente en toda la landing.
- Animaciones: hero (entrada), tarjetas hover, carrusel auto+manual, CTA sticky móvil. Respetar `prefers-reduced-motion`.
- Assets: reutilizar `packages/ui/public/assets/Demo.png`, `Freia.png`; nuevas ilustraciones optimizadas (webp/png) con lazy-load.
- Accesibilidad: contraste AA, focus visible, alt text, roles aria en carruseles/botones.
- Performance: lazy-load imágenes, diferir animaciones pesadas; Lighthouse objetivo ≥90 en Performance/Accessibility para la landing.

## Tareas técnicas (alto nivel)
- Maquetar nuevas secciones en la landing principal (`packages/ui/src/views/landing/...`): hero, narrativa, features, casos de uso, cómo funciona, métricas, pricing, footer.
- Añadir estilos/animaciones (CSS/Framer/GSAP) con gradientes y hover states; CTA sticky en mobile.
- Implementar carrusel de casos de uso con swipe y autoplay; cards interactivas para features.
- Optimizar assets (convertir a webp si aplica) y lazy-load; mantener `Demo.png`/`Freia.png` como fallback.
- Ajustar header/footer con enlaces a docs/seguridad/contacto y CTAs a login/signup/checkout protegido.

# 🧩 DEMO Hoteles — Landing Template (Historias de Usuario)

Objetivo: tener una landing base “world-class hotel” lista para adaptar por vertical/agente, con CTA para probar el chat (link externo/API) y secciones que muestren valor del agente.

## Epic L1: Hero y CTA de prueba
- **HU-L1.1 | Hero con promesa clara**  
  - Como visitante, quiero entender en 5s qué hace el agente (reservas/cambios/cancelaciones/atención).  
  - Criterios: título fuerte, subtítulo breve, background visual hotel premium; CTA primario “Probar asistente” (link al chat externo) y secundario “Ver cómo funciona” (scroll a técnica/flujo).
- **HU-L1.2 | Barra de confianza**  
  - Como visitante, quiero ver logos/claims que generen confianza.  
  - Criterios: 3-5 badges (24/7, Multilingüe, +70% tickets automatizados, Integrable con PMS).
- **HU-L1.3 | Demo embed/CTA**  
  - Como visitante, quiero abrir el chat en modal o pestaña.  
  - Criterios: botón “Probar demo” que apunta a `LINK_CHAT_EXTERNO`; fallback a API docs link.

## Epic L2: Casos y Flujos clave (ligados al agente)
- **HU-L2.1 | Card “Reservas inteligentes”**  
  - Describe: disponibilidad en vivo, reglas de estadía mínima, alternativas y confirmación.  
  - Incluye: microflujo visual (3 pasos) y CTA “Probar reservas”.
- **HU-L2.2 | Card “Cambios y cancelaciones”**  
  - Destaca: penalidades automáticas, reembolsable/no, recalculo.  
  - CTA “Probar cambios/cancelaciones”.
- **HU-L2.3 | Card “Atención al huésped”**  
  - Destaca: pre-estadia (early/late, traslados), durante (toallas, room service, incidencias).  
  - CTA “Probar atención”.
- **HU-L2.4 | Backoffice / reportes**  
  - Destaca: leads, notificaciones internas, reportes rápidos.  
  - CTA “Ver panel” (puede enlazar a un mock/report).

## Epic L3: Diferenciales / Valor
- **HU-L3.1 | KPIs de impacto**  
  - Como visitante, quiero ver números concretos: reducción carga recepción, conversión, errores.  
  - Criterios: 3 métricas con iconos.
- **HU-L3.2 | Integraciones**  
  - Como visitante, quiero saber que se conecta a PMS/CRM/Pinecone/Mongo.  
  - Criterios: lista corta de integraciones y soportes.
- **HU-L3.3 | Multilingüe y seguridad**  
  - Menciona idiomas, RBAC/SSO si aplica; no guarda tarjetas.

## Epic L4: Cómo funciona (técnico/light)
- **HU-L4.1 | Arquitectura simple**  
  - 4 pasos: Input → Reglas/Disponibilidad → LLM → Confirmación.  
  - Visual: diagrama simple, menciona Document Stores (inventario, disponibilidad, reglas, FAQ).
- **HU-L4.2 | Embedding/Chat externo**  
  - Texto breve: se puede embeber o abrir en link externo; API endpoint destacado.  
  - CTA “Ver API” (link a docs).

## Epic L5: UI base (layout/propuesta)
- Hero full-width con imagen/gradiente hotel premium, tipografía elegante (serif/sans combinada), CTA doble.
- Cards de casos (3-4) en grid, con mini wire de flujo.
- Sección “cómo funciona” con diagrama lineal.
- Barra de confianza/logos.
- Footer con datos de contacto/demo/soporte.

## CTA y enlaces a conectar
- `LINK_CHAT_EXTERNO`: URL del chat del agente.  
- `LINK_API_DOCS`: endpoint o página de API.  
- `LINK_PANEL` (opcional): mock de panel/reportes.  
- `LINK_INTEGRACIONES`: página con integraciones soportadas.

## Contenido inicial sugerido (editable)
- Hero title: “Asistente de reservas y atención 24/7 para tu cadena hotelera”.  
- Subtitle: “Reserva, cambios, cancelaciones y atención al huésped en un solo chat, con reglas de negocio y disponibilidad en vivo.”  
- KPIs: “-70% carga recepción”, “+30% conversión en reservas directas”, “0 errores en políticas de estadía mínima/penalidades”.

## Técnicos a resaltar (alineado al agente)
- Reglas: mínima estadía feriados, no reembolsables vs reembolsables, early/late sujeto a disponibilidad.  
- Datos: Inventario, Disponibilidad, Reglas, Reservas, FAQ (Document Stores cargados).  
- Memoria: Mongo; Vector: Pinecone; LLM: gpt-4.1-mini.  
- HITL: confirmaciones para cobros/penalidades.

## Próximos pasos
- Diseñar la landing en `/packages/ui/` (nueva ruta p.ej. `/demo-hoteles`), usando este guion.  
- Embeder o linkear el chat externo (botón “Probar demo”).  
- Añadir capturas/gifs de flujo de reserva para la sección “Cómo funciona”.

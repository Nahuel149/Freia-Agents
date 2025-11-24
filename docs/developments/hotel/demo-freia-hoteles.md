# 🧩 DEMO FREIA — Cadena de Hoteles (Gran Sol)

Guía de implementación en Agentflow V2, organizada en Historias de Usuario (formato Jira) para construir un agente conversacional que gestione reservas y atención al huésped para 3 sedes de “Hotel Gran Sol”.

## Contexto de Demo
- Sedes: Centro, Palermo, Aeropuerto (ejemplo).
- Datos simulados (JSON/CSV/tablas) para: inventario de habitaciones, calendario de disponibilidad, reglas comerciales, info de hoteles, perfiles de huésped, SOPs internos.
- Motor de reservas básico y calendario de disponibilidad; tarifas con reglas: mínima estadía en fines de semana largos (p.ej. 3 noches), no cancelar dentro de X días, early check-in sujeto a disponibilidad, tarifas reembolsables/no reembolsables.
- Campos de reserva: nombre, fechas, huéspedes, tipo de habitación, email, método de pago (simulado), preferencias.

## Historias de Usuario (Jira-style)

### Epic A: Nuevas Reservas
1. **HU-A1 | Consultar disponibilidad y reglas**  
   - **Como** huésped, **quiero** saber si hay disponibilidad en una sede y fechas, **para** reservar.  
   - **Criterios**: valida sede/fechas/huéspedes; aplica mínima estadía en feriados; propone alternativa (extender/ajustar fechas o cambiar sede/habitación); muestra tarifas reembolsable/no reembolsable; exige método de contacto.
2. **HU-A2 | Crear reserva cumpliendo reglas**  
   - **Como** huésped, **quiero** confirmar mi reserva, **para** asegurar mi estadía.  
   - **Criterios**: recalcula tarifa con reglas; simula validación de método de pago; genera código de reserva; envía confirmación (mensaje final + opcional voucher simulado); registra preferencias.
3. **HU-A3 | Sugerir alternativas sin disponibilidad**  
   - **Como** huésped, **quiero** opciones si no hay cupo, **para** no perder el viaje.  
   - **Criterios**: prueba otras fechas cercanas, otras sedes, otros tipos de habitación; informa políticas de cambio/cancelación aplicables.

### Epic B: Cambios de Reserva
4. **HU-B1 | Cambiar fechas/tipo/huéspedes**  
   - **Como** huésped, **quiero** modificar mi reserva, **para** ajustar mi viaje.  
   - **Criterios**: valida disponibilidad; si tarifa no reembolsable y falta poco, bloquea o aplica penalidad; recalcula tarifa; confirma cambio y nuevo total.
5. **HU-B2 | Adelantar llegada / early check-in**  
   - **Como** huésped, **quiero** llegar antes, **para** ingresar antes.  
   - **Criterios**: revisa disponibilidad día anterior y reglas de early check-in; puede cobrar fee; confirma o ofrece alternativa.

### Epic C: Cancelaciones
6. **HU-C1 | Cancelar con políticas aplicadas**  
   - **Como** huésped, **quiero** cancelar, **para** evitar cargos sorpresivos.  
   - **Criterios**: revisa si está dentro de ventana de penalidad (no cancelar dentro de X días); calcula cargo según política y tipo de tarifa; registra motivo; confirma cancelación o crédito si aplica.

### Epic D: Atención Pre-Estadia
7. **HU-D1 | Pedir early check-in/late check-out**  
   - **Como** huésped, **quiero** ajustar horarios, **para** optimizar mi llegada/salida.  
   - **Criterios**: verifica disponibilidad; aplica reglas/fees; confirma o agenda solicitud.
8. **HU-D2 | Servicios adicionales**  
   - **Como** huésped, **quiero** traslados, amenities, spa, cuna, estacionamiento, **para** preparar mi estadía.  
   - **Criterios**: lista opciones por sede; registra pedido; indica horarios/costos.
9. **HU-D3 | Información y recomendaciones**  
   - **Como** huésped, **quiero** indicaciones, clima, actividades, restaurantes, transporte, **para** planificar.  
   - **Criterios**: responde FAQ del hotel (horarios, check-in/out, gym, desayuno); sugiere según sede y preferencias.

### Epic E: Atención Durante la Estadia
10. **HU-E1 | Pedidos a recepción**  
    - **Como** huésped, **quiero** toallas, limpieza, amenities, pedidos a restaurante, **para** resolver necesidades.  
    - **Criterios**: toma pedido, prioriza (urgente/normal), notifica área (simulado), confirma ventana de atención.
11. **HU-E2 | Reportar inconvenientes**  
    - **Como** huésped, **quiero** reportar problemas (AC, ruido, etc.), **para** recibir solución.  
    - **Criterios**: clasifica incidencia, sugiere pasos iniciales, registra ticket (simulado) con room/huésped, comparte ETA de resolución.
12. **HU-E3 | Extender estadía**  
    - **Como** huésped, **quiero** agregar noches, **para** prolongar mi visita.  
    - **Criterios**: verifica disponibilidad y reglas (mínimo, tarifas); recalcula total; confirma cambio.

### Epic F: Backoffice / Operación
13. **HU-F1 | Registrar lead o contacto**  
    - **Como** staff, **quiero** guardar leads de consultas sin cerrar, **para** hacer seguimiento.  
    - **Criterios**: almacena nombre/contacto/interés/fecha; etiqueta motivo (precio/tiempo/stock).
14. **HU-F2 | Notificar al personal**  
    - **Como** staff, **quiero** derivar tareas (limpieza, mantenimiento, spa), **para** coordinar servicio.  
    - **Criterios**: genera solicitud con prioridad y ubicación; confirma recepción (simulado).
15. **HU-F3 | Reportes rápidos**  
    - **Como** staff, **quiero** ver tasas de ocupación, motivos de cancelación, upselling, **para** tomar decisiones.  
    - **Criterios**: entrega resumen simulado desde tablas mock.

## Datos simulados requeridos
- **Inventario de habitaciones**: tipo, capacidad, tarifa base, amenities, reglas por tipo.
- **Disponibilidad/calendario**: fechas ocupadas por sede, cupos, overbooking sí/no.
- **Reglas comerciales**: mínima estadía por fecha/feriado, políticas de cancelación, reembolsable/no reembolsable, check-in/out, bloqueos por eventos.
- **Info de hoteles**: servicios, ubicación, mapas, convivencias, horarios, incluidos.
- **Perfil huésped**: historial, preferencias, consumos, idioma.
- **SOP interno**: manuales y protocolos para incidentes/pedidos.

## Conversaciones de ejemplo (para test UI)
- Reservas: “Quiero reservar para el 15 de julio”, “Disponibilidad para dos adultos en Palermo”, “Diferencia entre estándar y premium”, “¿Incluye desayuno?”, “¿Aceptan mascotas?”
- Cambios: “Quiero cambiar mis fechas”, “Agregar una persona”, “Mejorar habitación”, “¿Costo por cambiar?”
- Cancelaciones: “Quiero cancelar”, “¿Tengo penalidad si cancelo hoy?”, “¿Puedo pasar a crédito?”
- Pre-estadia: “¿Puedo pedir early check-in?”, “¿Traslado desde aeropuerto?”, “¿Hay estacionamiento?”, “¿Puedo pedir una cuna?”, “¿Actividades cerca?”
- Durante: “Necesito toallas”, “No funciona el aire”, “Pedir comida”, “¿Hora de desayuno?”, “Extender estadía”, “¿Dónde dejo equipaje?”

## Flujo demo sugerido (UI)
1. Selector de rubro → Hoteles.
2. Introducción del agente con alcance.
3. Chat con botones rápidos: “Reservar nueva estadía”, “Modificar reserva”, “Cancelar”, “Servicios del hotel”, “Atención al huésped”.
4. (Opcional) Bloque técnico: bases consultadas, reglas aplicadas, integración PMS/motor.

## Notas de implementación en Agentflow V2
- **Flow State** sugerido: `hotel`, `sede`, `fechas`, `noches`, `huespedes`, `habitacionTipo`, `tarifaTipo`, `reglasAplicadas`, `disponibilidad`, `tarifaCalculada`, `reserva`, `cambios`, `penalidad`, `servicioSolicitado`, `incidente`, `lead`, `idioma`, `preferencias`.
- **Nodos clave**: Start (form/chat), LLM/Agent para orquestar reglas, Retriever (Document Stores de inventario/reglas/FAQ), Condition/Loop para disponibilidad y reglas, Human Input para confirmaciones de cobro/penalidad, Direct Reply final. Use Custom Function para cálculos de noches/penalidades si hace falta.

## Datasets y Document Stores (mapeo)
Carga cada JSON como Document Store independiente (texto plano o JSON). Nómbralos así para usarlos en nodos Retriever/Agent:
- `Hoteles-Inventario`: `docs/developments/data/hoteles-inventario.json` (habitaciones, tarifas base, amenities por sede).
- `Hoteles-Disponibilidad`: `docs/developments/data/hoteles-disponibilidad.json` (cupo por fecha/sede/tipo, overbooking flag).
- `Hoteles-Reglas`: `docs/developments/data/hoteles-reglas.json` (mínimas noches, cancelación, early/late, bloqueos, horarios).
- `Hoteles-Reservas-Mock`: `docs/developments/data/hoteles-reservas-mock.json` (reservas de ejemplo con políticas y tarifas).
- `Hoteles-FAQ`: `docs/developments/data/hoteles-faq.json` (FAQ de servicios, horarios, mascotas, traslados).
- (Opcional) `Hoteles-SOP`: SOP internos si se agregan más procesos.

### Cómo crear los Document Stores en Flowise (paso rápido)
1) En Document Stores, crear store y subir el JSON correspondiente (o usar loader de archivo).  
2) Seleccionar vector store (Pinecone) y un loader simple (JSON/Texto).  
3) Ajustar chunking mínimo (JSON corto).  
4) Si quieres filtrar por sede, agrega metadata `sede` al loader o en la UI de metadata.  
5) Refrescar el store y verificar con un Retrieval Query de prueba.

### Qué consulta cada épico
- **Epic A**: `Hoteles-Disponibilidad`, `Hoteles-Inventario`, `Hoteles-Reglas`.  
- **Epic B**: `Hoteles-Reservas-Mock`, `Hoteles-Disponibilidad`, `Hoteles-Reglas`.  
- **Epic C**: `Hoteles-Reservas-Mock`, `Hoteles-Reglas`.  
- **Epic D**: `Hoteles-Reglas` (early/late), `Hoteles-FAQ` y un store de servicios extra si se agrega.  
- **Epic E**: `Hoteles-FAQ`, SOP/servicios; para extensión, `Hoteles-Disponibilidad` + `Hoteles-Reglas`.  
- **Epic F**: store de leads/tareas/reportes (mock) si lo agregas.

### Prompts y variables (plantillas)
- **Consulta de disponibilidad**: `{{ $flow.state.sede }} {{ $flow.state.checkIn }} {{ $flow.state.checkOut }} {{ $flow.state.habitacionTipo }} disponibilidad cupos`  
- **Reglas comerciales**: `{{ $flow.state.checkIn }} reglas minimas noches cancelacion early late {{ $flow.state.sede }}`  
- **Inventario**: `{{ $flow.state.sede }} tipos habitacion diferencias amenities tarifas base`  
- **Reservas mock**: `{{ $flow.state.reservaId }}` o `{{ $flow.state.email }} {{ $flow.state.checkIn }}`  
- **FAQ**: `horarios desayuno gimnasio mascotas traslado {{ $flow.state.sede }}`  
- **Tarifa/penalidad (LLM)**: “Con tarifa base {{precioBase}}, noches {{noches}}, tarifaTipo {{tarifaTipo}}, aplica minNoches {{minNoches}}, penalidad {{penalidad}} si corresponde. Devuelve JSON con precio por noche, total, política.”

### Campos de reserva a extraer/confirmar
Nombre, email, fechas (check-in/out), noches, huéspedes, tipo de habitación, sede, tarifa reembolsable/no reembolsable, método de pago (simulado), preferencias. Guarda todo en Flow State antes de confirmar.

### Reglas clave (según el doc original)
- Mínima estadía en fines de semana largos/feriados (ej. 3 noches).  
- No cancelar dentro de X días (según `hoteles-reglas.json`).  
- Early check-in sujeto a disponibilidad (y fee opcional).  
- Tarifas reembolsables vs no reembolsables (bloquean cancel/cambios tardíos).  
- Campos típicos de reserva: nombre, fechas, huéspedes, tipo hab, email, pago simulado, preferencias.

### Flujo visual (para la landing demo)
- Bloque 1 selector de rubro → Hoteles.  
- Bloque 2 intro del agente (alcance).  
- Bloque 3 chat con botones rápidos: “Reservar nueva estadía”, “Modificar reserva”, “Cancelar”, “Servicios del hotel”, “Atención al huésped”.  
- Bloque 4 técnico opcional: bases consultadas, reglas aplicadas, integración PMS/motor.

### Cómo conectar Retrievers y variables en Agentflow
- Usa el nodo **Retriever** apuntando al store correspondiente y pasa la query con `{{ }}` según arriba.  
- Para respuestas combinadas, usa LLM con los outputs del Retriever y Flow State:  
  - Disponibilidad: `{{ retrieverDisponibilidad.output }}`  
  - Reglas: `{{ retrieverReglas.output }}`  
  - Inventario: `{{ retrieverInventario.output }}`  
- Si necesitas filtrar por sede, añade un filtro de metadata en el retriever (ej. `sede = Centro`).  
- Para políticas de cancelación/penalidad, lee `Hoteles-Reglas` y calcula en Custom Function según días a check-in.

### Validaciones que deben aparecer en mensajes
- Si noches < minNoches en feriado → proponer extender.  
- Si tarifa no reembolsable y dentro de ventana → bloquear cancel/cambio o penalidad 100%.  
- Early check-in siempre “sujeto a disponibilidad” + fee.  
- Capacidad vs huéspedes: sugerir upgrade o dos habitaciones.  
- No cancelar dentro de X días (mencionar política al usuario).


===== Personal

  Qué hacer ahora:
                                                                                                                    
  1. Crea los Document Stores (Hoteles-Reglas, Hoteles-Disponibilidad, etc.) y toma sus IDs.                        
  2. Crea la credencial del LLM y la de MongoDB.                                                                    
  3. Abre docs/developments/demo-freia-hoteles-import-template.json, reemplaza los placeholders por tus IDs y       
     credenciales.                                                                                                  
  4. Importa el JSON en Flowise.  
  Agregué plantillas completas en docs/developments/hotel/templates/ listas para importar y rellenar:

  - epicA-reservas.json: flujo de nuevas reservas (reglas, disponibilidad, tarifa, confirmación, memoria Mongo).    
  - epicB-cambios.json: cambios con penalidad, disponibilidad y recalculo de tarifa.                                
  - epicC-cancelaciones.json: cancelación con penalidad y confirmación HITL.                                        
  - epicD-preestadia.json: early/late, traslados, amenities, info/FAQ con confirmación.                             
  - epicE-durante.json: pedidos/incident/extender estadía, con tarifa extra si aplica.                              
  - epicF-backoffice.json: leads, notificaciones internas y reportes rápidos.                                       
  - demo-freia-hoteles-import-template.json: template base de Epic A (más comentado) con placeholders.              
                                                                                                                    
  Placeholders a reemplazar en cada JSON:                                                                           
                                                                                                                    
  - LLM_CREDENTIAL_ID → tu credencial LLM (modelo ya seteado a gpt-4.1-mini).                                       
  - MONGO_CREDENTIAL_ID → tu credencial MongoDB (usa DB freia_demo, collection chat_memory_hoteles).                
  - DOCSTORE_*_ID → IDs de los Document Stores (Hoteles-Reglas, Hoteles-Disponibilidad, Hoteles-Reservas-Mock,      
    Hoteles-FAQ, etc.). Crea los stores subiendo los JSON de docs/developments/data/ y copia los IDs.               
                                                                                                                    
  Pasos rápidos:                                                                                                    
                                                                                                                    
  1. Crea los Document Stores con los JSON mocks.                                                                   
  2. Crea credenciales LLM y Mongo.                                                                                 
  3. Abre cada plantilla .json y reemplaza los placeholders con tus IDs.                                            
  4. Importa el/los flows en la UI.                                                                                 
  5. Si quieres un único flow consolidado, importa demo-freia-hoteles-import-template.json y extiéndelo con los     
     nodos de las plantillas de cada épico usando los prompts de demo-freia-hoteles-prompts.md.                     
                                                                                                                    
  Con esto deberías poder importar y tener cada épico funcionando tras completar los IDs/credenciales.


  Pasos para tener TODO en un solo agente:                                                                          
                                                                                                                    
  1. Carga los Document Stores con los JSON de docs/developments/data/ y copia sus IDs.                             
  2. Importa cada flow de los épicos A–F, reemplazando placeholders de credenciales/docstores; toma sus flowId.     
  3. Importa agent-completo.json y reemplaza los placeholders de credenciales y FLOW_EPIC_*_ID con los IDs de los   
     subflujos.                                                                                                     
  4. Usa este router como única entrada (API/chat).                                                                 
                                                                                                                    
  Así tendrás un punto de entrada que enruta a todos los procesos. Si quieres que empaquete los subflujos en un solo
  JSON monolítico sin Execute Flow, avisa y lo genero.
 

  Reemplaza placeholders y listo para importar:                                                                     
                                                                                                                    
  - LLM_CREDENTIAL_ID                                                                                               
  - MONGO_CREDENTIAL_ID                                                                                             
  - DOCSTORE_REGLAS_ID, DOCSTORE_DISP_ID, DOCSTORE_RESERVAS_ID, DOCSTORE_FAQ_ID, DOCSTORE_REPORTE_ID,               
    DOCSTORE_INV_ID                                                                                                 
                                                                                                                    
  Con los IDs puestos, el agente monolítico queda listo para usar con router de intents y subflujos inline A–F.     
 
 Próximos pasos sugeridos:                                                                                         
                                                                                                                    
  1. Crea los Document Stores (inventario, disponibilidad, reglas, reservas, FAQ, reportes) y reemplaza los         
     placeholders de IDs/credenciales en el monolítico para importarlo sin pasos manuales.                          
  2. Sustituye chatLink/secondaryLink en la plantilla de hoteles por el link externo real del chat/API.             
  3. Si quieres persistencia en Mongo para la plantilla activa, expón un endpoint y conecto el selector en lugar    
     de localStorage.                                                                                               
                                                                                                                   
  Siguientes pasos:                                                                                                 
                                                                                                                    
  - Ajusta chatLink/secondaryLink en templatesData.js a los enlaces reales del agente/API.                          
  - Si quieres persistir la selección de template en Mongo en vez de localStorage, podemos conectar el selector a   
    tu API.
 Añadí dos mejoras:
                                                                                                                    
  - templatesData.js ahora toma los links de chat y API de variables de entorno (VITE_DEMO_HOTEL_CHAT_URL,          
    VITE_DEMO_HOTEL_API_URL, etc.), con fallback a los placeholders. Así puedes apuntar al chat real del agente sin 
    tocar código.                                                                                                   
  - demo-hoteles.jsx persiste la selección de plantilla en un endpoint opcional (VITE_TEMPLATE_SELECTION_ENDPOINT); 
    si lo configuras, envía un POST con templateId/timestamp/ruta. Si no está configurado, sigue funcionando sin    
    romper la UI. También usa el slug /demo/:landingId y muestra la ruta de acceso de cada template.                
                                                                                                                    
  La landing principal sigue aparte; las demos se acceden vía /demo/hoteles o /demo/<id>/<alias>. Reemplaza los env 
  vars con tus URLs reales y, si quieres registrar selecciones en Mongo, apunta VITE_TEMPLATE_SELECTION_ENDPOINT a  
  tu endpoint.

  • Extendí la demo de landing para que sea más “plug and play” y configurable:
                                                                                                                    
  - templatesData.js ahora expone envOrDefault y lee los links de chat/API desde VITE_DEMO_* env vars; misma        
    estructura para otras plantillas.                                                                               
  - Ruta dinámica /demo/:landingId ya soporta slugs y aliases, con persistencia de selección y navegación al slug.  
  - demo-hoteles.jsx:                                                                                               
      - Puede cargar templates desde un endpoint opcional VITE_TEMPLATES_ENDPOINT (si existe, sobreescribe las      
        plantillas estáticas).                                                                                      
      - Usa query param landingId y aliases, setea document.title según la template activa.                         
      - Persistencia opcional de selección y clicks en CTA hacia VITE_TEMPLATE_SELECTION_ENDPOINT (con action       
        select, cta_chat, cta_api).
      - Filtro por vertical en el selector; muestra la ruta /demo/<id> en las cards.                                
      - CTA primaria/ secundaria loguean acción; banner de aviso si falta chatLink (env var no configurada).        
      - Embed opcional si la template trae hero.embedUrl; si no, muestra imagen.
  - La landing principal sigue intacta con botón a la demo; la demo vive en /demo/hoteles o /demo/<id>.             
                                                                                                                    
  Para dejarlo operativo:                                                                                           
                                                                                                                    
  - Ajusta env vars VITE_DEMO_HOTEL_CHAT_URL, VITE_DEMO_HOTEL_API_URL, etc. (y opcional VITE_TEMPLATES_ENDPOINT,    
    VITE_TEMPLATE_SELECTION_ENDPOINT).                                                                              
  - Si quieres persistir la selección en DB, apunta VITE_TEMPLATE_SELECTION_ENDPOINT a tu API.
                                                                                                                    
  El agente monolítico sigue en docs/developments/hotel/templates/agent-completo-monolitico.json listo para importar
  tras reemplazar placeholders de DocStores/credenciales.
 

 Añadí una plantilla extra para gomerías/neumáticos en packages/ui/src/views/landing/templatesData.js:
                                                                                                                    
  - ID gomerias-arg, aliases gomerias, landing3, neumaticos, vertical “Automotor”.                                  
  - Hero, KPIs, features y flujos orientados a venta/cambio de neumáticos, stock y turnos (marcas Pirelli, Michelin,    Bridgestone).                                                                                                   
  - Links configurables por env: VITE_DEMO_GOMERIA_CHAT_URL y VITE_DEMO_GOMERIA_API_URL.                            
  - Ruta directa: /demo/gomerias-arg (o /demo/gomerias).                                                            
                                                                                                                    
  Con esto el selector ya puede mostrar/abrir la landing de gomerías. Remplaza los env vars con tus enlaces de chat/
  API para dejarla operativa.


 Para entrar como super_admin en esta build OSS: el login está bypass. Usa /signin en el UI o POST /api/v1/       
    auth/login con cualquier email+password; siempre devuelve un token con rol super-admin y workspace oss-mode. Si  
    quieres que el frontend lo recuerde, haz login una vez y quedará en localStorage.            
     Cómo entrar como super admin: el login OSS sigue bypass. Basta ir a /signin y loguear con cualquier email/clave  
    (ej. admin@example.com / cualquier). El backend responde siempre con rol super-admin y workspace oss-mode; el    
    frontend guarda el token en localStorage y queda autenticado.   



     ### 8) .env.example                                                                                                
                                                                                                                     
  # DB                                                                                                               
  DATABASE_TYPE=postgres                                                                                             
  DATABASE_HOST=localhost                                                                                            
  DATABASE_PORT=5432                                                                                                 
  DATABASE_NAME=app_db                                                                                               
  DATABASE_USER=app_user                                                                                             
  DATABASE_PASSWORD=secret                                                                                           
                                                                                                                     
  # Webhooks / providers                                                                                             
  MOBBEX_API_KEY=xxxxx                                                                                               
  MOBBEX_ACCESS_TOKEN=yyyyy                                                                                          
  MOBBEX_WEBHOOK_SECRET=zzzzz                                                                                        
                                                                                                                     
  DLOCAL_API_KEY=xxxxx                                                                                               
  DLOCAL_API_SECRET=yyyyy                                                                                            
  DLOCAL_WEBHOOK_SECRET=zzzzz                                                                                        

  CHECKOUT_RETURN_URL=https://tu-app.com/checkout/return
  DLOCAL_CALLBACK_URL=https://tu-app.com/webhooks/dlocal                                                             
                                                                                                                     
  ### Notas de seguridad y decisiones                                                                                
                                                                                                                     
  - HMAC en webhooks: se usa rawBody y crypto.createHmac con el secreto. Si no coincide, 400.                        
  - Idempotencia: UNIQUE(provider, externalRef) y lógica que no reprocesa COMPLETED.                                 
  - Validación: Zod en checkout y en webhooks antes de tocar la BD.
  - Montos en centavos (integer) para evitar problemas de float.                                                     
  - Logger redaction para evitar PII/tarjetas en logs.                                                               
  - UUIDs para IDs y refs no predecibles.                                                                            
  - Secrets via .env; nunca hardcodeados.                                                                            
                                                          
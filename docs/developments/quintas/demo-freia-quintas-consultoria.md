# DEMO FREIA - Guia de Consultoria para Quintas (El Rincon de mi mundo)

Blueprint accionable para convertir el relevamiento en historias de usuario (estilo Jira) e implementarlas en un agente que automatice disponibilidad, respuestas y calendario.

## Contexto
- Negocio: Quintas el Rincon de mi mundo (alquiler de quintas/eventos).
- Equipo: 1 persona; digitalizacion baja.
- Herramientas actuales: Instagram, WhatsApp Business (bandeja unificada), BedBooking (agenda/calendario).
- Uso de IA: no usan.
- Objetivo principal: que la disponibilidad y ocupacion se manejen de forma automatica y se refleje en el calendario.

## Flujos actuales (resumen)
- Mensaje inicial: informar fechas ya alquiladas (primer filtro).
- Si sigue la conversacion: dar disponibilidad y precios segun consulta.
- Enviar link a catalogo con quintas disponibles y restricciones (minimo de dias).
- Preguntas recurrentes: seguro de lluvia (no), aire acondicionado (no).
- Reglas de convivencia: sin musica de noche; musica moderada de dia.
- Negociacion: solo algunos clientes reciben descuento (porcentaje configurable).
- Pago: informar tiempo de anticipacion para completar pago.
- Visitas: coordinar agenda del administrador con disponibilidad del cliente.

## Ineficiencias y dolor
- Tiempo en responder preguntas basicas y consultas que no convierten.
- Sin registro de leads ni seguimiento.
- Poca visibilidad de rendimiento y dificil escalar.

## Oportunidades de IA
- Automatizar respuestas iniciales y FAQ.
- Evaluar disponibilidad/ocupacion y proponer alternativas.
- Registrar leads y pedidos en un store sencillo.
- Enviar follow-ups y promociones en temporada baja.

## Historias de Usuario (Jira-style)

### Epic A: Filtro y respuesta inicial
1. **HU-A1 | Anunciar fechas bloqueadas**  
   - Como visitante, quiero saber rapido si ciertas fechas ya estan alquiladas, para no perder tiempo.  
   - Criterios: usar lista de fechas bloqueadas configurables; si la fecha consultada coincide, avisar no disponible y proponer 2-3 fechas cercanas libres; guardar intento como lead.
2. **HU-A2 | Consultar disponibilidad y precio**  
   - Como visitante, quiero confirmar disponibilidad y costo segun fechas y cantidad de dias, para decidir si reservo.  
   - Criterios: pedir fechas, numero de personas y cantidad de dias (aplica minimo de estadia); validar vs calendario (BedBooking o JSON mock); devolver precio por noche y total; si no hay cupo, proponer opciones.
3. **HU-A3 | Enviar catalogo y restricciones**  
   - Como visitante, quiero ver las quintas disponibles con sus particularidades, para elegir.  
   - Criterios: compartir link de catalogo y breve descripcion por quinta (capacidad, amenities, restricciones de minimo de dias); resaltar reglas de musica y horarios; permitir que el usuario filtre por fecha o capacidad.
4. **HU-A4 | Responder FAQ repetitivas**  
   - Como visitante, quiero respuestas claras sobre seguro de lluvia y aire acondicionado, para evaluar el alquiler.  
   - Criterios: responder que no hay seguro de lluvia y no hay aire acondicionado; agregar opciones mitigantes si existen (carpas, ventiladores); mantener tono amable y cercano.

### Epic B: Reserva y calendario
5. **HU-B1 | Generar cotizacion y bloqueo provisorio**  
   - Como visitante, quiero recibir una cotizacion con vigencia y reglas, para tomar la decision.  
   - Criterios: calcular total con minimo de dias; mostrar vigencia de cotizacion y deadline de pago; permitir marcar la fecha como hold en calendario por X horas; guardar contacto basico.
6. **HU-B2 | Aplicar descuentos a clientes habituales**  
   - Como administrador, quiero poder aplicar un porcentaje de descuento solo a clientes habituales, para premiar recurrencia sin afectar margen.  
   - Criterios: requerir flag de cliente habitual antes de mostrar descuento; porcentaje configurable en Flow State; reflejar descuento en total y en el mensaje.
7. **HU-B3 | Confirmar reserva y actualizar calendario**  
   - Como administrador, quiero que al confirmar se actualice la ocupacion automaticamente, para evitar dobles reservas.  
   - Criterios: al confirmar, cambiar estado en calendario (BedBooking via API o JSON mock); generar ID de reserva; enviar resumen con reglas y deadline de pago; si vence el deadline sin pago, liberar la fecha.
8. **HU-B4 | Agendar visita presencial**  
   - Como visitante, quiero proponer horarios para visitar la quinta, para ver el lugar antes de decidir.  
   - Criterios: recolectar disponibilidad del visitante; comparar con franjas configuradas del administrador; ofrecer 2-3 opciones; confirmar y registrar cita en calendario separado (visitas).

### Epic C: Seguimiento y rendimiento
9. **HU-C1 | Registrar leads y consultas no cerradas**  
   - Como administrador, quiero almacenar datos de consultas, para hacer seguimiento.  
   - Criterios: guardar nombre, telefono/whatsapp, fecha solicitada, interes (alquiler, visita), motivo de no cierre; exportable a CSV o store JSON.
10. **HU-C2 | Recontactar con promociones**  
    - Como administrador, quiero enviar recordatorios o promociones a leads cuando baja la ocupacion, para mejorar conversion.  
    - Criterios: activar campana manual cuando ocupacion baja de umbral; filtrar leads recientes sin cierre; mensajes preaprobados; marcar contacto como enviado.
11. **HU-C3 | KPI basicos**  
    - Como administrador, quiero ver ocupacion, tasas de cierre y precios vs competencia, para mejorar decisiones.  
    - Criterios: calcular ocupacion por mes (mock); ratio consultas->visitas->reservas; campo manual para referencia de precio de competencia; mostrar resumen en respuesta o dashboard simple.

## Flow State sugerido
`fechaSolicitada`, `diasSolicitados`, `personas`, `quintasDisponibles`, `catalogoLink`, `faqRain`, `faqAC`, `reglas`, `precioBase`, `precioTotal`, `descuentoPct`, `clienteHabitualFlag`, `cotizacionVigencia`, `estadoCalendario` (libre/hold/confirmado), `lead`, `citaVisita`, `kpi`.

## Datos simulados / Document Stores
- `Quintas-Calendario`: fechas ocupadas y holds (JSON) -> `docs/developments/quintas/data/quintas-calendario.json`.
- `Quintas-Restricciones`: minimo de dias, reglas de musica, pagos, visitas -> `docs/developments/quintas/data/quintas-restricciones.json`.
- `Quintas-Catalogo`: capacidad, amenities, precios base, notas -> `docs/developments/quintas/data/quintas-catalogo.json`.
- `Quintas-Leads`: leads, visitas y plantillas de outreach -> `docs/developments/quintas/data/quintas-leads.json`.
- (Opcional) `Quintas-Competencia`: referencia de precios -> `docs/developments/quintas/data/quintas-competencia.json`.

## Pasos tecnicos recomendados
1) Crear los Document Stores en la UI cargando cada JSON del path anterior y toma los IDs.  
2) Configurar nodos Retriever para calendario, restricciones y catalogo; queries sugeridas:  
   - Calendario: `{{ $flow.state.fechaSolicitada }} {{ $flow.state.diasSolicitados }} {{ $flow.state.personas }} {{ $flow.state.quintaId }}`  
   - Restricciones: `{{ $flow.state.fechaSolicitada }} minimos musica pago visitas {{ $flow.state.quintaId }}`  
   - Catalogo: `{{ $flow.state.personas }} capacidad amenities precio {{ $flow.state.fechaSolicitada }}`  
3) LLM de normalizacion: extraer fechas, dias solicitados, personas, clienteHabitualFlag, preferencia de visita; listar `missingFields` si falta algo.  
4) Custom Function: calcular noches y total, aplicar minimos por rango y descuento si `clienteHabitualFlag=true`; set `cotizacionVigencia`, `precioTotal`, `estadoCalendario`.  
5) Condition: si fecha esta en `blockedDates` o `status=booked/hold` expira, proponer alternativas (otras fechas/quintas).  
6) Human Input: confirmar cotizacion, aplicar descuento y marcar `hold`/`confirmado`; luego Custom Function para escribir en calendario mock (o API BedBooking real).  
7) Nodo de leads: registrar cada intento y marcar si se envio follow-up/promocion (usar store `Quintas-Leads`).

## Flow State clave (Agentflow V2)
`fechaSolicitada`, `checkOut`, `diasSolicitados`, `personas`, `quintaId`, `quintasDisponibles`, `catalogoLink`, `faqRain`, `faqAC`, `reglas`, `precioBase`, `precioTotal`, `moneda`, `descuentoPct`, `clienteHabitualFlag`, `cotizacionVigencia`, `estadoCalendario` (libre/hold/confirmado), `holdExpires`, `lead`, `citaVisita`, `kpi`, `alternativas`.

## Nodos sugeridos (orden base)
1. Start: inicializa Flow State vacio o defaults.  
2. LLM Normalizar: devuelve JSON {fechaSolicitada, diasSolicitados, personas, quintaId opcional, clienteHabitualFlag, preferenciaVisita, missingFields[], needsClarification}.  
3. Condition faltan datos: si missing -> Direct Reply pidiendo datos y loop.  
4. Retriever Restricciones -> set minimos, musica, pagos, visitas.  
5. Retriever Calendario -> detectar booked/hold/visit/blocked y minNights por rango.  
6. Retriever Catalogo -> obtener precio base, capacidad y amenities; set `quintasDisponibles`.  
7. Custom Function Calculo: noches, cumple minimos, precioTotal, aplica descuento si flag habitual.  
8. Condition disponibilidad: si booked/hold, LLM Alternativas (otras fechas/quintas).  
9. Human Input Cotizacion: mostrar total, vigencia, reglas de pago y musica; botones Confirmar / Cambiar fechas / Cancelar; opcion para marcar descuento habitual.  
10. Custom Function Calendario: al confirmar, set estado=hold o confirmado; generar ID y holdExpires; opcionalmente llamar API BedBooking.  
11. Nodo Leads: guardar intento en store; si status=hold o sin cierre, marcar para follow-up.  
12. Direct Reply final: resumen (ID, fechas, total, vigencia, reglas clave) + CTA visitar la quinta o compartir catalogo.

## Prompts base (plantillas)
- Normalizacion: "Extrae fechaSolicitada (check-in), checkOut o diasSolicitados, personas, quintaId (si menciona), clienteHabitualFlag, preferenciaVisita (si quiere visita), missingFields, needsClarification. Responde JSON puro."
- FAQ lluvia/AC: "Aclarar: no hay seguro de lluvia; no hay aire acondicionado. Ofrece mitigaciones: carpa opcional, ventiladores en quincho. Tono amable."
- Alternativas: "Si la fecha esta ocupada o minNights no se cumple, ofrece 2-3 fechas cercanas libres o otra quinta con capacidad suficiente."
- Cotizacion: "Con basePrice, minNights, diasSolicitados, descuentoPct (si habitual), entrega JSON {precioPorNoche, total, vigenciaHoras, estadoCalendario} y texto amigable."

## Validaciones que deben aparecer en mensajes
- Respetar minNights por rango de fecha (feriados, fiestas).  
- Bloquear si fecha esta en blockedDates o booked; si hold vencido, permitir liberar.  
- Descuento solo si `clienteHabitualFlag=true`; mostrar porcentaje aplicado.  
- Recordar reglas de musica: sin musica amplificada de noche; moderada de dia.  
- Sin seguro de lluvia ni aire acondicionado; ofrecer mitigacion.  
- Pagos: depositPct y deadline; liberar fecha si no paga en plazo.  
- Visitas: limitar a slots disponibles y coordinar con administrador.

## Conversaciones de ejemplo (para test UI)
- "Quiero alquilar el 27 de diciembre para 20 personas"  
- "Tienen libre el 24?" (debe rechazar por blackout y ofrecer alternativa)  
- "Soy cliente habitual, me haces precio para 2 noches en enero?"  
- "Puedo ir a verla el sabado a las 12?"  
- "Tienen seguro de lluvia o aire?" (responder no + mitigacion)  
- "Confirmo la reserva, sostenerla 24 horas mientras transfiero"

## Plan de agente monolitico (importable Agentflow V2, estilo hoteles)
Objetivo: generar un JSON unico como `agent-completo-monolitico.json` de hoteles, pero para quintas, con placeholders.

### Placeholders a reemplazar
- `LLM_CREDENTIAL_ID`
- `MONGO_CREDENTIAL_ID` (memoria opcional)
- `DOCSTORE_CALENDARIO_ID`
- `DOCSTORE_RESTRICCIONES_ID`
- `DOCSTORE_CATALOGO_ID`
- `DOCSTORE_LEADS_ID`
- `DOCSTORE_COMPETENCIA_ID` (opcional, para KPI)

### Router e intents
- Intentos base: `disponibilidad`, `reserva`, `visita`, `faq`, `followup`, `kpi`.
- LLM clasificadora: toma mensaje inicial + estado y setea `$flow.state.intent`. Router deriva a subflujo.

### Esqueleto de nodos (por subflujo)
1) **Start**: inicializa Flow State (ver lista arriba).  
2) **Memory (Mongo opcional)**: para conversaciones largas.  
3) **LLM Classifier** -> **Router** a subflujos:
   - **Disponibilidad/Precio** (Epic A): Normalizar -> Retrievers (restricciones, calendario, catalogo) -> Calculo -> Alternativas -> HITL Cotizacion -> Calendario/Lead -> Reply.  
   - **Reserva/Confirmacion** (Epic B): Validar hold/confirmar -> Actualizar calendario -> Reply.  
   - **Visita** (Epic B4): Normalizar disponibilidad visita -> Restricciones (slots) -> HITL confirmacion -> Registrar cita -> Reply.  
   - **Follow-up/Promos** (Epic C2): Filtrar leads abiertos -> LLM genera texto con plantilla -> Marca enviado.  
   - **KPI** (Epic C3): Leer store competencia + leads -> LLM resume ocupacion mock y comparativo.  
- **FAQ**: Respuestas rapidas usando restricciones/catalogo (lluvia, AC, musica, pagos).

### Notas de implementacion
- Usa nodos Retriever apuntando a los DocStores con las queries sugeridas.  
- Custom Functions simples: calcular noches/total/holdExpires; actualizar calendario mock; marcar follow-up enviado.  
- Mensajes finales deben recordar: reglas de musica, sin seguro de lluvia/AC, deposito y deadline, vigencia de hold.  
- Template listo en `docs/developments/quintas/templates/agent-quintas-completo-monolitico.json` con los placeholders anteriores (lleno de prompts ajustados de pagos, min noches y musica). Sustituye IDs/credenciales antes de importar.

## Mapa de intents -> subflujos (detalle rapido)
- `disponibilidad` / `precio`: normalizar -> reglas/calendario/catalogo -> calculo -> alternativas -> HITL cotizacion -> calendario/lead -> reply.
- `reserva`: confirmar hold -> actualizar calendario -> reply de confirmacion con ID, vigencia y reglas.
- `visita`: normalizar + slots -> confirmar -> registrar cita -> reply con cita.
- `faq`: responder lluvia/AC/musica/pagos usando restricciones/catalogo.
- `followup`: filtrar leads abiertos/lost -> generar texto con plantilla -> marcar enviado.
- `kpi`: leer leads + competencia -> responder ocupacion mock, ratio y referencia de precios.

## Queries sugeridas por subflujo
- Calendario: `{{ $flow.state.fechaSolicitada }} {{ $flow.state.diasSolicitados }} {{ $flow.state.personas }} {{ $flow.state.quintaId }}`
- Restricciones: `{{ $flow.state.fechaSolicitada }} minimos musica pago visitas {{ $flow.state.quintaId }}`
- Catalogo: `{{ $flow.state.personas }} capacidad amenities precio {{ $flow.state.fechaSolicitada }}`
- Leads (follow-up): `leads abiertos o perdidos {{ $flow.state.fechaSolicitada }}`
- Competencia (KPI): `precios referencia competencia`

## Checklist para usar el template JSON
1) Usa el JSON listo: `docs/developments/quintas/templates/agent-quintas-completo-monolitico.json`.
2) Reemplaza placeholders (`LLM_CREDENTIAL_ID`, `MONGO_CREDENTIAL_ID`, `DOCSTORE_CALENDARIO_ID`, `DOCSTORE_RESTRICCIONES_ID`, `DOCSTORE_CATALOGO_ID`, `DOCSTORE_LEADS_ID`, `DOCSTORE_COMPETENCIA_ID`).
3) Ajusta prompts si cambian reglas de musica/pagos/min noches o quieres conectar BedBooking real (sustituye la Custom Function de calendario).
4) Importa en Agentflow V2 y prueba intents: disponibilidad, reserva, visita, FAQ, follow-up, KPI.
5) Si necesitas KPIs reales, actualiza `quintas-leads.json` y `quintas-competencia.json` o conecta tu fuente real.


ya tienes el agente listo para importar; solo falta reemplazar placeholders y conectar los DocStores/credenciales:

Usa docs/developments/quintas/templates/agent-quintas-completo-monolitico.json, cambia LLM_CREDENTIAL_ID, MONGO_CREDENTIAL_ID (si usas memoria) y los DOCSTORE_* a los IDs que crees al cargar los JSON de calendario/restricciones/catálogo/leads/competencia.
Importa en Agentflow V2 y prueba los intents: disponibilidad/reserva, visita, FAQ, follow-up, KPI. El flujo ya incluye cálculo de min noches, depósito/plazos, reglas de música y holds.
Si quieres usar BedBooking real, sustituye la Custom Function de calendario por tu conector/API; lo demás queda igual.
Con eso tendrás un chatbot completo para quintas. Ajusta prompts/reglas si cambian tus políticas, y prueba cada intent tras importar.
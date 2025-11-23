# 🧩 DEMO FREIA — Epic A (Nuevas Reservas) en Agentflow V2

Blueprint paso a paso para construir el flujo de Nuevas Reservas (Epic A) usando Agentflow V2. Usa junto con `docs/how to use/agentflow-quickref.md` y `docs/developments/demo-freia-hoteles.md`.

## 1) Flow State sugerido (iniciar en Start)
- `hotel` (default: "Gran Sol"), `sede`, `checkIn`, `checkOut`, `noches`, `huespedes`, `habitacionTipo`, `tarifaTipo` (reembolsable | no_reembolsable), `reglasAplicadas`, `disponibilidad`, `alternativas`, `precio`, `moneda`, `feriadoFlag`, `minNoches`, `cupo`, `metodoPago`, `email`, `nombre`, `preferencias`, `reserva`, `confirmationText`.

## 2) Datos/Document Stores requeridos
- **Inventario**: tipos de habitación, capacidad, tarifa base, amenities, reglas por tipo; por sede.
- **Disponibilidad**: calendario con ocupación por fecha+sede; permite overbooking: true/false.
- **Reglas comerciales**: mínima estadía (feriados/fines de semana largos), políticas de cancelación, reembolsable/no, check-in/out, early check-in policy.
- **FAQ/Servicios** (opcional para respuestas laterales).

## 3) Nodos y configuración (orden recomendado)
1. **Start**  
   - Input: Chat.  
   - Flow State: inicializa claves listadas arriba (vacías o defaults).  
   - Ephemeral Memory: off (se puede activar si se quiere historial).

2. **LLM - Normalizar solicitud**  
   - Objetivo: extraer sede, fechas, noches (si check-in/out presentes, calcular), huéspedes, tipo de habitación, email (si lo menciona), preferencias.  
   - Mensajes: prompt que pida JSON con esos campos; si faltan datos críticos, flag `needsClarification=true` y `missingFields`.  
   - JSON Structured Output: define schema con campos anteriores + `needsClarification` boolean.
   - Update Flow State: set `sede`, `checkIn`, `checkOut`, `noches`, `huespedes`, `habitacionTipo`, `email`, `preferencias`.

3. **Condition - ¿Faltan datos?**  
   - Revisa `needsClarification` o campos vacíos.  
   - True: **Direct Reply** solicitando datos faltantes (fechas, sede, huéspedes, email opcional). Luego Loop al LLM Normalizar.  
   - False: continúa.

4. **Custom Function - Calcular noches y feriado**  
   - Inputs: `checkIn`, `checkOut`, reglas (incluir JSON de feriados/minNoches desde Document Store si ya se tiene, o fallback a estático).  
   - Output: `noches`, `feriadoFlag`, `minNoches` aplicable.  
   - Update Flow State: `noches`, `feriadoFlag`, `minNoches`.

5. **Retriever - Reglas comerciales**  
   - Document Store: Reglas comerciales.  
   - Query: `{{ $flow.state.sede }} {{ $flow.state.checkIn }} reglas minimas cancelacion early checkin`  
   - Output: texto+metadata; Update Flow State: `reglasAplicadas`.

6. **Retriever - Disponibilidad**  
   - Document Store: Calendario de disponibilidad.  
   - Query: `{{ $flow.state.sede }} {{ $flow.state.checkIn }} {{ $flow.state.checkOut }} {{ $flow.state.habitacionTipo }}`.  
   - Output: `disponibilidad` (texto o JSON de cupos); Update Flow State: `disponibilidad`, `cupo`.

7. **Condition - Regla de mínima estadía**  
   - Comprueba `feriadoFlag == true AND noches < minNoches`.  
   - True: LLM **Sugerir alternativa** → propone extender fecha (p.ej., adelantar check-in un día). Guarda en Flow State `alternativas`. Human Input opcional para confirmar cambio de fechas. Luego recalcula noches (volver a paso 4).

8. **Condition - ¿Hay disponibilidad?**  
   - Si `cupo` o disponibilidad indica 0, LLM sugiere alternativas: otras fechas cercanas, otra sede, otro tipo de habitación. Guarda `alternativas`. Human Input para seleccionar. Si no hay aceptación → Direct Reply cortesía. Si hay selección → actualiza Flow State y vuelve a disponibilidad.

9. **LLM - Calcular tarifa y políticas**  
   - Entrada: tarifa base desde Inventario (usar Retriever o Document Store), reglas comerciales, reembolsable/no, noches, huéspedes.  
   - Salida: `precio` (por noche y total), moneda, políticas de cancelación, nota sobre early check-in si aplica.  
   - JSON Structured Output para `precio.total`, `precio.noche`, `tarifaTipo`, `política`.
   - Update Flow State: `precio`, `tarifaTipo`.

10. **Human Input - Confirmar reserva y método de pago (simulado)**  
    - Texto: Mostrar sede, fechas, noches, tipo de hab, tarifa total, política de cancelación, opciones reembolsable/no.  
    - Botones: `Confirmar`, `Cambiar fechas`, `Cancelar`.  
    - Feedback habilitado para email/método de pago si faltan.
    - Si `Confirmar`: set `metodoPago` (simulado, p.ej. tarjeta/transfer), `email` si lo provee.

11. **Custom Function - Generar reserva**  
    - Crea objeto `reserva` con ID simulado (ej. `GRS-{{timestamp}}`), todos los campos, tarifa, políticas.  
    - Update Flow State: `reserva`, `confirmationText`.

12. **Direct Reply - Confirmación**  
    - Mensaje final con resumen: ID, sede, fechas, tipo de habitación, huéspedes, total, política de cancelación, instrucciones de check-in, contacto.  
    - Añadir CTA: “¿Necesitás traslados o spa?” (prepara Epic D/E).

## Prompts sugeridos (resumen)
- **LLM Normalizar**: “Extrae de la solicitud: sede, fechas (checkIn/checkOut), noches, huéspedes, tipo de habitación, email, preferencias. Responde JSON {sede, checkIn, checkOut, noches, huespedes, habitacionTipo, email, preferencias, needsClarification, missingFields[]}…”
- **LLM Sugerir alternativa (min noches/ sin cupo)**: explica regla brevemente y propone 2–3 opciones (extender, cambiar sede, cambiar tipo). Pregunta confirmación.
- **LLM Calcular tarifa**: dado inventario y reglas, devuelve JSON con precio por noche, total, tipo de tarifa (reembolsable/no), política de cancelación, notas early check-in.

## Consideraciones de validación
- Fechas: check-out > check-in; noches >=1; si minNoches aplica, exigir o proponer ajuste.
- Huéspedes vs capacidad habitación: si excede, sugerir tipo superior o 2 habitaciones.
- Early check-in: solo prometer “sujeto a disponibilidad”; opcional fee.
- Cancelación: bloquear si dentro de ventana “no cancelar dentro de X días” para tarifas no reembolsables.

## Extensiones opcionales
- Añadir **Memory** con MongoDB para hilos largos; mantener Flow State por run.  
- Añadir **Condition Agent** para rutear entre flujo de reservas vs otros (cambios/cancelaciones) si el intent inicial es amplio.  
- Añadir **Execute Flow** para subflujos de upsell (spa/traslados) tras confirmar reserva.

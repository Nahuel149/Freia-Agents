# 🧩 DEMO FREIA — Epic B (Cambios de Reserva) en Agentflow V2

Blueprint para cambios de reserva: fechas, tipo de habitación, cantidad de huéspedes, y early check-in adelantado.

## 1) Flow State sugerido (añadir sobre Epic A)
- Reutiliza: `hotel`, `sede`, `checkIn`, `checkOut`, `noches`, `huespedes`, `habitacionTipo`, `tarifaTipo`, `precio`, `reglasAplicadas`, `disponibilidad`, `alternativas`, `email`, `nombre`, `preferencias`, `reserva`.
- Añade: `reservaId`, `cambioTipo` (fechas | habitacion | huespedes | early_checkin), `penalidad`, `penalidadTipo`, `recalculo`, `tarifaAnterior`, `tarifaNueva`, `ventanaPenalidad`, `nonRefundFlag`, `earlyFee`.

## 2) Datos/Document Stores requeridos
- Reservas actuales (mock JSON) con: id, sede, fechas, tipo, tarifa (reembolsable/no), políticas, huéspedes, email.
- Reglas comerciales (cancelación, cambios, ventanas, early check-in).
- Disponibilidad (calendario) e Inventario (para nuevos tipos).

## 3) Nodos y configuración (orden recomendado)
1. **Start**: inicializa Flow State extendido.
2. **LLM - Identificar cambio y extraer datos**  
   - Entrada: mensaje del huésped.  
   - Salida JSON: `reservaId`, `cambioTipo`, `nuevasFechas` (checkIn/checkOut), `nuevoHabitacionTipo`, `nuevoHuespedes`, `earlyCheckin` flag.  
   - Si faltan datos, marca `needsClarification`.
   - Update Flow State: set campos detectados.
3. **Retriever - Obtener reserva actual**  
   - Document Store: Reservas mock.  
   - Query: `{{ $flow.state.reservaId }}`.  
   - Update Flow State: `reserva`, `tarifaTipo`, `tarifaAnterior`, `ventanaPenalidad`, `nonRefundFlag`.
4. **Condition - Validar datos**  
   - Si falta `reserva` o fechas nuevas/cambio tipo: pedir al usuario (Direct Reply) y loop.
   - Validar check-out > check-in si hay cambio de fechas.
5. **Custom Function - Ventana y penalidad**  
   - Calcula días a check-in.  
   - Aplica reglas: si `nonRefundFlag` y dentro de ventana corta → bloquear cambios o aplicar penalidad alta.  
   - Calcula `penalidad` (porcentaje o fija) y `penalidadTipo`.  
   - Update Flow State.
6. **Condition - ¿Cambio permitido?**  
   - Si bloqueado (tarifa no reembolsable y ventana vencida): informar y ofrecer alternativas (crédito o sin cambio).  
   - Si permitido, continúa.
7. **Disponibilidad**  
   - Según cambio:  
     - Fechas: Retriever de calendario con nuevas fechas/sede/tipo.  
     - Tipo habitación: validar capacidad vs huéspedes; consulta inventario y disponibilidad.  
     - Huéspedes: si excede capacidad, sugerir upgrade o 2 habitaciones.  
   - Guardar `disponibilidad` y `alternativas` si no hay cupo.
8. **Condition - ¿Hay disponibilidad?**  
   - No: LLM propone alternativas (otras fechas/sede/tipo); Human Input para elegir; actualiza Flow State; revalida disponibilidad.
9. **LLM - Recalcular tarifa**  
   - Inputs: tarifa base del nuevo tipo, noches, reglas, penalidad si aplica.  
   - Output JSON: `tarifaNueva` (noche/total), `precio`, `penalidadAplicada`.  
   - Update Flow State.
10. **Human Input - Confirmar cambio**  
    - Mostrar: reserva original vs nueva (fechas, tipo, huéspedes), tarifa anterior/nueva, penalidad, políticas.  
    - Botones: Confirmar, Cancelar, Otra alternativa.  
    - Si confirmar: procede.
11. **Custom Function - Aplicar cambio**  
    - Genera nueva versión de reserva (simulada) con nuevo ID o mismo ID + versión.  
    - Update Flow State: `reserva`.
12. **Direct Reply - Confirmación cambio**  
    - Resumen final: nueva configuración, total, penalidad si hubo, políticas vigentes.  
    - CTA: “¿Necesitás traslado o spa?”

## Prompts sugeridos
- **LLM identificar cambio**: “Extrae reservaId (si viene), qué tipo de cambio (fechas/habitación/huéspedes/early check-in) y los nuevos valores. Responde JSON…”
- **LLM alternativas**: explicar bloqueo/penalidad y proponer 2–3 opciones.
- **LLM recalcular tarifa**: dado tarifas base, noches, penalidad, devuelve JSON con totales y notas de política.

## Validaciones clave
- Non-refundable + ventana corta: bloquear o avisar penalidad máxima.  
- Early check-in: solo “sujeto a disponibilidad” y posible fee (`earlyFee`).  
- Capacidad: no asignar tipo que no soporta huéspedes.  
- Fechas válidas: check-out > check-in.

## Extensiones opcionales
- Memory con historial para recordar reservas recientes en el hilo.  
- Condition Agent para rutear si el intent era cancelación o nueva reserva.  
- Registro de motivo de cambio en Flow State (`cambios.motivo`).

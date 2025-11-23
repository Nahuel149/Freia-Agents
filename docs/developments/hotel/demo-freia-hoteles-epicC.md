# 🧩 DEMO FREIA — Epic C (Cancelaciones) en Agentflow V2

Blueprint para cancelaciones con políticas y penalidades.

## 1) Flow State sugerido
- Reutiliza: `reservaId`, `reserva`, `tarifaTipo`, `ventanaPenalidad`, `nonRefundFlag`, `precio`, `email`, `nombre`.
- Añade: `diasAntelacion`, `penalidad`, `penalidadTipo` (porcentaje | fija | bloqueo), `motivoCancel`, `ofertaCredito` (boolean), `estadoCancel` (aceptada | bloqueada | requiereConfirm).

## 2) Datos/Document Stores
- Reservas mock (id, fechas, tarifa tipo, políticas cancelación, monto, email).
- Reglas comerciales (ventanas de cancelación, penalidades, reembolsable/no).

## 3) Nodos (orden)
1. **Start**: inicializa Flow State.
2. **LLM - Identificar cancelación**  
   - Extrae `reservaId` (si provisto), `motivoCancel`.  
   - Si faltan datos, marca `needsClarification`.
3. **Retriever - Traer reserva**  
   - Query por `reservaId`.  
   - Update Flow State: `reserva`, `tarifaTipo`, `ventanaPenalidad`, `nonRefundFlag`, `precio`.
4. **Condition - Validar datos**  
   - Si falta reservaId o no se encuentra, pedir confirmación de ID/email/fechas.
5. **Custom Function - Calcular penalidad**  
   - Calcula días hasta check-in (`diasAntelacion`).  
   - Si `nonRefundFlag` y dentro de ventana: `penalidadTipo = bloqueo` (no cancela).  
   - Si reembolsable: aplicar porcentaje fijo según `ventanaPenalidad`.  
   - Update Flow State: `penalidad`, `penalidadTipo`, `diasAntelacion`.
6. **Condition - ¿Se puede cancelar?**  
   - Si `penalidadTipo = bloqueo`: LLM informa no cancelable y ofrece alternativas (crédito/cambio de fechas). Human Input para aceptar alternativa o cerrar.  
   - Si cancelable: continúa.
7. **Human Input - Confirmar cancelación y penalidad**  
   - Muestra: reserva, fechas, total, penalidad calculada, reembolso neto o crédito.  
   - Botones: Confirmar cancelación, Cambiar fechas (redirigir a Epic B), Tomar crédito.  
   - Update Flow State: `estadoCancel`.
8. **Custom Function - Ejecutar cancelación**  
   - Marca `estadoCancel=aceptada`; registra `motivoCancel`.  
   - Si crédito: generar nota de crédito simulada.  
   - Update Flow State.
9. **Direct Reply - Confirmación**  
   - Resumen: cancelada/no cancelada, penalidad, reembolso o crédito, número de referencia.  
   - CTA: “¿Quieres reprogramar otra fecha?”

## Prompts sugeridos
- **LLM identificar**: “Extrae reservaId y motivo. Si falta, pide confirmación.”  
- **LLM alternativas**: si bloqueo, ofrece crédito o cambio de fecha.  
- **LLM confirmación**: no necesario; usar Human Input para decisión final.

## Validaciones
- Ventana de no cancelación: bloquear si corresponde a no reembolsable.  
- Penalidad según días de antelación.  
- Si falta `reservaId`, combinar email + fecha para buscar en mock.

## Extensiones
- Registrar `motivoCancel` para reportes (Epic F).  
- Memory para reusar datos del hilo.

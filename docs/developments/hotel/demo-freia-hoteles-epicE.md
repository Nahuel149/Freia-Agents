# 🧩 DEMO FREIA — Epic E (Atención Durante la Estadia) en Agentflow V2

Gestión de pedidos, incidencias y extensiones durante la estadía.

## 1) Flow State sugerido
- Reutiliza: `reservaId`, `reserva`, `sede`, `habitacion`, `huespedes`, `fechas`.
- Añade: `solicitudTipo` (toallas | limpieza | amenities | room_service | recepcion | incidente | extender_estadia | info_servicio), `prioridad` (alta/media/baja), `detalleSolicitud`, `incidente`, `clasificacionIncidente`, `etaRespuesta`, `nuevaFechaCheckout`, `disponibilidad`, `tarifaNueva`.

## 2) Datos/Document Stores
- SOP internos (limpieza, mantenimiento, tiempos de respuesta).
- Menú room service (opcional).
- FAQ servicios en sede (gym, desayuno, spa horarios).
- Disponibilidad y reglas comerciales (para extensión de estadía).

## 3) Nodos (orden)
1. **Start**: Flow State extended.
2. **LLM - Clasificar solicitud**  
   - Input: mensaje.  
   - Output JSON: `solicitudTipo`, `detalleSolicitud`, `prioridad` (incidente), `nuevaFechaCheckout` (si extensión), `needsClarification`.  
   - Update Flow State.
3. **Condition - Datos faltantes**  
   - Si falta reservaId, pedirlo; si falta nueva fecha para extensión, pedir.
4. **Router según solicitudTipo**:
   - **Pedidos (toallas/limpieza/amenities/room_service/recepcion)**:  
     - Retriever SOP tiempos; set `etaRespuesta`.  
     - Human Input opcional para confirmar hora.  
     - Custom Function: registrar solicitud (simulado) con estado pendiente.  
     - Direct Reply: confirma y ETA.
   - **Incidente**:  
     - LLM clasifica (AC, ruido, electricidad, etc.).  
     - Retriever SOP incidente; sugerir pasos rápidos y ETA.  
     - Custom Function: registra ticket.  
     - Direct Reply: ticket + ETA.
   - **Extender estadía**:  
     - Retriever disponibilidad con nueva fecha; aplica reglas (mínima, tarifa).  
     - Condition: si no hay cupo, sugerir alternativas.  
     - LLM recalcula tarifa para días extra.  
     - Human Input: confirmar nueva tarifa/fechas.  
     - Custom Function: actualizar reserva (simulado).  
     - Direct Reply: confirmación extensión.
   - **Info servicios**:  
     - Retriever FAQ horarios/servicios; LLM responde breve.

## Prompts sugeridos
- **LLM clasificar**: intent → solicitudTipo, prioridad.  
- **LLM incidente**: “Clasifica el problema y da pasos inmediatos seguros”.  
- **LLM extensión**: “Calcular tarifa por noches extra; mantener políticas”.

## Validaciones
- Extensión: check-out nuevo > actual; disponibilidad; tarifa acorde al tipo y reglas.  
- Room service/amenities: respetar horarios.  
- Incidentes: no dar instrucciones riesgosas; escalar a mantenimiento.

## Extensiones
- Enlazar con Epic F para notificar personal (limpieza/mantenimiento).  
- Memory para recordar pedidos previos en la misma estadía.

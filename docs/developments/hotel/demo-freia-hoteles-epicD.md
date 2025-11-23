# 🧩 DEMO FREIA — Epic D (Atención Pre-Estadia) en Agentflow V2

Servicios y preparativos antes de la llegada: early/late, traslados, amenities, spa, info y recomendaciones.

## 1) Flow State sugerido
- Reutiliza: `reservaId`, `reserva`, `sede`, `fechas`, `huespedes`, `habitacionTipo`, `idioma`, `preferencias`.
- Añade: `solicitudTipo` (early_checkin | late_checkout | traslado | amenities | spa | cuna | estacionamiento | info | recomendaciones), `detalleSolicitud`, `horarioVuelo`, `origen`, `destino`, `servicioExtra`, `costoExtra`, `disponibilidadServicio`, `respuestaInfo`.

## 2) Datos/Document Stores
- Reglas de early/late (horarios, fees).
- Servicios por sede: traslados (zonas, precios), amenities extra, spa, estacionamiento.
- FAQ hotel (check-in/out, desayuno, gym, mapas, clima, actividades cercanas).

## 3) Nodos (orden)
1. **Start**: Flow State extended.
2. **LLM - Clasificar solicitud**  
   - Input: mensaje.  
   - Output JSON: `solicitudTipo`, `origen/destino/horarioVuelo` (si traslado), `servicioExtra` (amenities/spa), `needsClarification`.  
   - Update Flow State.
3. **Condition - Datos faltantes**  
   - Si faltan datos (ej. horario de vuelo para traslado), pedirlos y loop.
4. **Retriever - Reglas/Servicios**  
   - Si early/late: Document Store reglas early/late → traer fee/política.  
   - Si traslado: Document Store traslados → precios por zona.  
   - Si amenities/spa: Document Store servicios → horarios/costos.  
   - Si info/recomendaciones: FAQ/guía por sede.
   - Update Flow State: `disponibilidadServicio`, `costoExtra`, `respuestaInfo`.
5. **Condition - Disponibilidad/fee**  
   - Si early/late depende de disponibilidad: marque “sujeto a disponibilidad” + fee.  
   - Si servicio no disponible en sede: ofrecer alternativa.
6. **Human Input - Confirmar servicio**  
   - Mostrar resumen: qué se pide, horario, costo/fee, políticas.  
   - Botones: Confirmar, Cambiar horario, Cancelar.
7. **Custom Function - Registrar solicitud**  
   - Crea objeto `servicioExtra`/`detalleSolicitud` con estado “pendiente”.  
   - Update Flow State.
8. **Direct Reply - Confirmación**  
   - Confirma registro y próximos pasos (“notificaremos a recepción”, “esperar confirmación de disponibilidad”).  
   - CTA: “¿Algo más antes de tu llegada?”

## Prompts sugeridos
- **LLM clasificar**: mapa de intents a `solicitudTipo`; extraer campos relevantes.  
- **LLM respuestas info/recomendaciones**: usar Retriever outputs y responder breve + bullets.

## Validaciones
- Early/late: no prometer sin aclarar “sujeto a disponibilidad”; fee opcional.  
- Traslados: requerir horario y punto de recogida/destino.  
- Amenities/spa: respetar horarios.

## Extensiones
- Enlazar con Epic B/C para cambios o cancelaciones si surge en la conversación.  
- Añadir Condition Agent para rutear si intent fue de otro epic.

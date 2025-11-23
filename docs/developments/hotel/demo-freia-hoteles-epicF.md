# 🧩 DEMO FREIA — Epic F (Backoffice / Operación) en Agentflow V2

Soporte operativo: leads, notificaciones internas y reportes rápidos.

## 1) Flow State sugerido
- Reutiliza: `reserva`, `reservaId`, `sede`.
- Añade: `lead`, `leadMotivo`, `followUp`, `tareaInterna`, `tareaArea` (limpieza | mantenimiento | spa | recepcion), `prioridad`, `reporteTipo`, `reporteData`.

## 2) Datos/Document Stores
- Leads/contactos (mock).  
- Tareas internas/SOP.  
- Reportes mock: ocupación, cancelaciones, upselling, motivos.

## 3) Nodos (orden)
1. **Start**.
2. **LLM - Clasificar intención backoffice**  
   - Detectar: registrar lead, notificar personal, pedir reporte.  
   - Extraer campos: nombre/contacto/interés/motivo; área/prioridad; tipo de reporte.
3. **Condition - Datos faltantes**  
   - Pedir los campos que falten (email/teléfono/motivo/área/prioridad).
4. **Flujos**:
   - **Registrar lead**:  
     - Custom Function: crear objeto lead con timestamp.  
     - Direct Reply: confirma lead creado; opcional follow-up.
   - **Notificar personal**:  
     - Retriever SOP por área para SLA/ETA.  
     - Custom Function: registrar tarea (simulada) con prioridad.  
     - Direct Reply: confirma envío/ETA.
   - **Reporte rápido**:  
     - Retriever sobre Reportes mock según `reporteTipo` (ocupación, cancelaciones, upsell).  
     - LLM resume en bullets con cifra clave.  
     - Direct Reply.

## Prompts sugeridos
- **LLM clasificar backoffice**: mapea intención y extrae campos.  
- **LLM reporte**: “Resume en bullets y resalta cifra principal”.

## Validaciones
- Leads: guardar contacto y motivo.  
- Tareas: prioridad alta si es incidente crítico.  
- Reportes: si no hay dato mock, responder “dato simulado no disponible”.

## Extensiones
- Conectar con herramientas reales (CRM, ticketing) vía Tool/HTTP.  
- Guardar `leadMotivo` y `tareaInterna` para analítica en Epic F.

# 🧩 DEMO FREIA — Document Stores y Prompts (copy/paste)

Guía rápida para crear los Document Stores en Flowise y pegar prompts/payloads en nodos clave. Usa junto con `demo-freia-hoteles.md` y los épicos A–F.

## Document Stores (crear en la UI)
Para cada uno:
1) Crear Document Store → nombre según abajo.  
2) Loader: File (subir el JSON indicado). Chunk pequeño (ej. 500–800 chars).  
3) Vector store: Pinecone.  
4) Metadata opcional: `sede` si quieres filtrar por sede.  
5) Refrescar y probar con Retrieval Query.

- `Hoteles-Inventario` → `docs/developments/data/hoteles-inventario.json`
- `Hoteles-Disponibilidad` → `docs/developments/data/hoteles-disponibilidad.json`
- `Hoteles-Reglas` → `docs/developments/data/hoteles-reglas.json`
- `Hoteles-Reservas-Mock` → `docs/developments/data/hoteles-reservas-mock.json`
- `Hoteles-FAQ` → `docs/developments/data/hoteles-faq.json`
- (Opcional) `Hoteles-SOP` si agregas protocolos internos.

## Queries de Retriever (pegar en nodo Retriever)
- Disponibilidad: `{{ $flow.state.sede }} {{ $flow.state.checkIn }} {{ $flow.state.checkOut }} {{ $flow.state.habitacionTipo }} disponibilidad cupos`
- Inventario: `{{ $flow.state.sede }} tipos habitacion diferencias amenities tarifas base {{ $flow.state.habitacionTipo }}`
- Reglas: `{{ $flow.state.checkIn }} reglas minimas noches cancelacion cambios early late {{ $flow.state.sede }}`
- Reservas mock: `{{ $flow.state.reservaId }}` (fallback: `{{ $flow.state.email }} {{ $flow.state.checkIn }}`)
- FAQ: `horarios desayuno gimnasio mascotas traslado estacionamiento actividades {{ $flow.state.sede }}`

## Prompts LLM (copiar en nodos LLM/Agent)

### 1) Normalizar solicitud de reserva (Epic A)
System/Instruction:
```
Eres un asistente de reservas de hotel. Extrae datos y devuelve SOLO JSON.
Campos: sede, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD), noches, huespedes, habitacionTipo, email, nombre, preferencias, needsClarification (bool), missingFields (array).
Valida que checkOut > checkIn. Calcula noches si ambas fechas presentes.
No inventes datos si faltan; marca missingFields.
```
JSON schema (en nodo): keys anteriores, tipos string/number/bool/array.

### 2) Sugerir alternativas por mínima estadía o falta de cupo (Epic A)
```
Explica brevemente la regla (ej. minNoches={{ $flow.state.minNoches }}, noches={{ $flow.state.noches }}, feriado={{ $flow.state.feriadoFlag }}).
Propón 2-3 opciones: extender fechas, cambiar sede, cambiar tipo de habitación.
Pide confirmación clara.
```

### 3) Calcular tarifa y políticas (Epic A/B)
```
Usa la tarifa base y reglas.
Entrada:
- tarifaBase: {{ precioBase }}
- noches: {{ $flow.state.noches }}
- tarifaTipo: {{ $flow.state.tarifaTipo }} (refundable|no_reembolsable)
- minNoches: {{ $flow.state.minNoches }}
- penalidad: {{ $flow.state.penalidad }} (si aplica)
Devuelve JSON: { "precioNoche": number, "precioTotal": number, "moneda": "USD", "tarifaTipo": string, "politica": string, "notas": string }
```

### 4) Identificar cambio de reserva (Epic B)
```
Detecta tipo de cambio: fechas | habitacion | huespedes | early_checkin.
Devuelve JSON: { reservaId, cambioTipo, nuevasFechas:{checkIn,checkOut}, nuevoHabitacionTipo, nuevoHuespedes, earlyCheckin (bool), needsClarification, missingFields }.
No confirmes nada, solo estructura.
```

### 5) Alternativas por cambio bloqueado/penalidad (Epic B/C)
```
Si tarifa no reembolsable o penalidad alta, explica brevemente.
Ofrece 2-3 opciones: mantener, cambiar con cargo, mover a fechas alternativas, crédito.
Pregunta qué opción elige.
```

### 6) Identificar cancelación (Epic C)
```
Extrae reservaId (si dado) y motivoCancel. Responde JSON {reservaId, motivoCancel, needsClarification, missingFields}.
Si falta ID, pide email y fechas para buscar.
```

### 7) Clasificar solicitud pre-estadia (Epic D)
```
Mapea a solicitudTipo: early_checkin | late_checkout | traslado | amenities | spa | cuna | estacionamiento | info | recomendaciones.
Extrae campos relevantes (origen/destino/horario para traslados, servicioExtra, idioma).
Devuelve JSON con solicitudTipo, detalleSolicitud, needsClarification, missingFields.
```

### 8) Clasificar solicitud durante estadía (Epic E)
```
Mapea a solicitudTipo: toallas | limpieza | amenities | room_service | recepcion | incidente | extender_estadia | info_servicio.
Si incidente, clasifica incidente (AC, ruido, electricidad, etc.) y prioridad (alta/media/baja).
Si extender_estadia, extrae nuevaFechaCheckout.
Devuelve JSON con solicitudTipo, detalleSolicitud, prioridad, nuevaFechaCheckout, needsClarification.
```

### 9) Reporte rápido (Epic F)
```
Recibe datos de reporte (mock) y resume en bullets con 1 cifra clave destacada.
Sin rodeos, orientado a decisión.
```

## Payloads/estructuras útiles

### JSON Structured Output (normalizar reserva)
```
{
  "type": "object",
  "properties": {
    "sede": {"type": "string"},
    "checkIn": {"type": "string"},
    "checkOut": {"type": "string"},
    "noches": {"type": "number"},
    "huespedes": {"type": "number"},
    "habitacionTipo": {"type": "string"},
    "email": {"type": "string"},
    "nombre": {"type": "string"},
    "preferencias": {"type": "string"},
    "needsClarification": {"type": "boolean"},
    "missingFields": {"type": "array", "items": {"type": "string"}}
  }
}
```

### JSON Structured Output (cambio de reserva)
```
{
  "type": "object",
  "properties": {
    "reservaId": {"type": "string"},
    "cambioTipo": {"type": "string"},
    "nuevasFechas": {
      "type": "object",
      "properties": {
        "checkIn": {"type": "string"},
        "checkOut": {"type": "string"}
      }
    },
    "nuevoHabitacionTipo": {"type": "string"},
    "nuevoHuespedes": {"type": "number"},
    "earlyCheckin": {"type": "boolean"},
    "needsClarification": {"type": "boolean"},
    "missingFields": {"type": "array", "items": {"type": "string"}}
  }
}
```

### JSON Structured Output (cancelación)
```
{
  "type": "object",
  "properties": {
    "reservaId": {"type": "string"},
    "motivoCancel": {"type": "string"},
    "needsClarification": {"type": "boolean"},
    "missingFields": {"type": "array", "items": {"type": "string"}}
  }
}
```

## Tips rápidos de conexión
- En nodos **Update Flow State**, escribe siempre las claves existentes (`demo-freia-hoteles.md` tiene la lista).  
- Usa filtros de metadata en Retriever si cargaste `sede` como metadata.  
- Pon **Human Input** antes de cualquier acción con cargo (penalidad, cambio, cancelación) para la demo HITL.  
- Devuelve mensajes finales cortos con resumen + CTA a upsell (spa/traslados) para mostrar valor en demo.

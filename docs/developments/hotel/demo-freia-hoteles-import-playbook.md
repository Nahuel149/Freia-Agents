# 🧩 DEMO FREIA — Playbook de Importación (Agentflow V2)

Objetivo: dejar todo listo para que puedas importar o armar en UI sin pensar. Incluye: stores a crear, prompts/queries copy-paste y un esquema de nodos para exportar/importar. Si quieres que genere el JSON del flow, dime proveedor LLM y nombres exactos de credenciales; lo armo con esos IDs.

## 0) Prerrequisitos
- LLM provider configurado (ej. OpenAI `gpt-4o`), credenciales cargadas.
- Pinecone configurado.
- Ubicación de datos mock: `docs/developments/data/`.

## 1) Crear Document Stores (UI)
Para cada store: crear → loader File → subir JSON → chunk 500–800 → vector store Pinecone → refrescar.
- `Hoteles-Inventario` → `docs/developments/data/hoteles-inventario.json`
- `Hoteles-Disponibilidad` → `docs/developments/data/hoteles-disponibilidad.json`
- `Hoteles-Reglas` → `docs/developments/data/hoteles-reglas.json`
- `Hoteles-Reservas-Mock` → `docs/developments/data/hoteles-reservas-mock.json`
- `Hoteles-FAQ` → `docs/developments/data/hoteles-faq.json`
(Opcional) `Hoteles-SOP` si agregas protocolos internos.

## 2) Queries de Retriever (pega en cada nodo Retriever)
- Disponibilidad: `{{ $flow.state.sede }} {{ $flow.state.checkIn }} {{ $flow.state.checkOut }} {{ $flow.state.habitacionTipo }} disponibilidad cupos`
- Inventario: `{{ $flow.state.sede }} tipos habitacion diferencias amenities tarifas base {{ $flow.state.habitacionTipo }}`
- Reglas: `{{ $flow.state.checkIn }} reglas minimas noches cancelacion cambios early late {{ $flow.state.sede }}`
- Reservas mock: `{{ $flow.state.reservaId }}` (fallback: `{{ $flow.state.email }} {{ $flow.state.checkIn }}`)
- FAQ: `horarios desayuno gimnasio mascotas traslado estacionamiento actividades {{ $flow.state.sede }}`

## 3) Prompts LLM (copy-paste)
### Normalizar solicitud (Epic A)
System:
```
Eres un asistente de reservas de hotel. Extrae datos y devuelve SOLO JSON.
Campos: sede, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD), noches, huespedes, habitacionTipo, email, nombre, preferencias, needsClarification (bool), missingFields (array).
Valida que checkOut > checkIn. Calcula noches si ambas fechas presentes.
No inventes datos; marca missingFields si faltan.
```
JSON schema: keys anteriores (string/number/bool/array).

### Alternativas (mínima/no cupo)
```
Explica brevemente la regla (minNoches={{ $flow.state.minNoches }}, noches={{ $flow.state.noches }}, feriado={{ $flow.state.feriadoFlag }}).
Propón 2-3 opciones: extender fechas, cambiar sede, cambiar tipo de habitación.
Pide confirmación clara.
```

### Tarifa y políticas (A/B)
```
Usa tarifa base y reglas.
Entrada: tarifaBase={{precioBase}}, noches={{ $flow.state.noches }}, tarifaTipo={{ $flow.state.tarifaTipo }}, minNoches={{ $flow.state.minNoches }}, penalidad={{ $flow.state.penalidad }} (si aplica).
Devuelve JSON: { "precioNoche": number, "precioTotal": number, "moneda": "USD", "tarifaTipo": string, "politica": string, "notas": string }.
```

### Identificar cambio (B)
```
Detecta cambio: fechas | habitacion | huespedes | early_checkin.
Devuelve JSON { reservaId, cambioTipo, nuevasFechas:{checkIn,checkOut}, nuevoHabitacionTipo, nuevoHuespedes, earlyCheckin, needsClarification, missingFields }.
```

### Cancelación (C)
```
Extrae reservaId y motivoCancel. Devuelve JSON {reservaId, motivoCancel, needsClarification, missingFields}. Si falta ID, pide email y fechas.
```

### Clasificar pre-estadia (D)
```
Mapea a solicitudTipo: early_checkin | late_checkout | traslado | amenities | spa | cuna | estacionamiento | info | recomendaciones.
Extrae campos relevantes (origen/destino/horario para traslados, servicioExtra, idioma).
Devuelve JSON con solicitudTipo, detalleSolicitud, needsClarification, missingFields.
```

### Clasificar durante estadía (E)
```
Mapea a solicitudTipo: toallas | limpieza | amenities | room_service | recepcion | incidente | extender_estadia | info_servicio.
Si incidente, clasifica incidente y prioridad (alta/media/baja).
Si extender_estadia, extrae nuevaFechaCheckout.
Devuelve JSON con solicitudTipo, detalleSolicitud, prioridad, nuevaFechaCheckout, needsClarification.
```

### Reporte (F)
```
Resume el dataset dado en bullets, destaca 1 cifra clave orientada a decisión.
```

## 4) JSON Structured Outputs (copiar en nodos)
- Reserva (normalizar):
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
- Cambio:
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
- Cancelación:
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

## 5) Esquema de nodos por épico (breve)
- **Epic A**: Start → LLM Normalizar → Condition faltantes → Custom noches/feriado → Retriever Reglas → Retriever Disponibilidad → Condition minNoches → Condition cupo → LLM Tarifa → Human Input Confirmar → Custom Generar Reserva → Direct Reply.
- **Epic B**: Start → LLM Identificar cambio → Retriever Reservas → Custom penalidad cambio → Condition bloqueo → Disponibilidad nueva → LLM Tarifa → Human Input → Custom Actualizar → Direct Reply.
- **Epic C**: Start → LLM Cancelación → Retriever Reservas → Custom penalidad cancel → Condition bloqueo → Human Input → Custom Ejecutar → Direct Reply.
- **Epic D**: Start → LLM Pre-estadia → Retriever Reglas/FAQ/Servicios → Condition disponibilidad/fee → Human Input → Custom Registrar → Direct Reply.
- **Epic E**: Start → LLM Durante → Router por solicitudTipo → (Pedidos/Incidente/Extender/Info) → Retrievers → Custom registrar/actualizar → Direct Reply.
- **Epic F**: Start → LLM Backoffice → (Lead/Notificar/Reporte) → Custom o Retriever → Direct Reply.

## 6) Si quieres JSON de importación (te lo genero)
Dime:
- Modelo LLM (ej. `gpt-4o`), nombre de credencial.
- IDs de Document Stores en tu instancia (o usa los nombres exactos arriba si los creas primero).
- Si quieres memory (`MongoDBAtlasChatMemory`) o Ephemeral.
Con eso te devuelvo el archivo .json de Agentflow listo para importar.

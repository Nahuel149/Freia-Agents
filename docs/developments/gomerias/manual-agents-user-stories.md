# Manual Agents v1 - Jira-Style User Stories

Goal: Add a "Manual Agents" area that lets admins use and share code-built agents (built like `exampleagent` using LLM-coded flows, not Agentflow nodes), store chat data in MongoDB, and share public chatbot links similar to Agentflows.

NOTE: Do not commit secrets. MongoDB connection must be read from environment (e.g., MONGODB_URI).

## Epic: Manual Agents Page + Sharing

### Story MA-1: Add Manual Agents page to the UI and sidebar
As an admin, I want a dedicated "Manual Agents" page so I can run and share manual agents in one place.

Acceptance criteria:
- Sidebar includes a new "Manual Agents" link.
- New page loads at `/manual-agents`.
- Page shows a list of manual agents with name, status, last updated, and actions (open, share, delete).
- Page is accessible only to authenticated users (same rules as Agentflows).

Dependencies:
- Existing sidebar and routing structure in the UI.

### Story MA-2: Implement manual agents as code (LLM-built, like exampleagent)
As a developer, I want manual agents implemented as code (like `exampleagent`) so they can be built by an LLM and are not tied to Agentflow nodes.

Acceptance criteria:
- Manual agents are implemented via code in a dedicated folder (patterned after `exampleagent`).
- Each manual agent exposes a consistent interface (input message + sessionId => response + optional state updates).
- Manual agent metadata (name, description, status) is defined in code and indexed for listing.
- No UI-driven authoring or JSON editor is required for v1.

Data notes:
- The "Quintas v0.5 Agents-clean.json" file is a behavior spec; implement its intent via manual agent code modeled after `exampleagent`.
- Store only metadata in MongoDB; core logic remains in code.

### Story MA-3: Manual agent metadata panel (read-only for v1)
As an admin, I want to view a manual agent’s details so I can confirm what it does before sharing it.

Acceptance criteria:
- Details view loads from the agent list.
- Shows name, description, supported tools, and allowed collections.
- Read-only in v1; changes are made in code.

### Story MA-4: Run a manual agent in the built-in chat
As a user, I want to chat with a manual agent inside Freia.

Acceptance criteria:
- Chat UI supports manual agent conversations.
- Each chat run is tied to `agentId` and `sessionId`.
- Messages are persisted in MongoDB.
- The agent can read/write to approved collections according to its configuration.

### Story MA-5: Shareable public link for manual agent chat
As an admin, I want to share a link so others can try the chatbot without logging in.

Acceptance criteria:
- "Share" action generates a public URL with a token.
- Public URL loads a read-only chat UI without admin controls.
- Token can be revoked; revoked links no longer work.
- Access is rate-limited and logged.

## Epic: MongoDB Integration

### Story DB-1: Configure MongoDB connectivity
As a developer, I want MongoDB connection configuration so the system can store agents and chats.

Acceptance criteria:
- Mongo client connects using `MONGODB_URI`.
- Database name is configured via `MONGODB_DATABASE`.
- Connection errors are surfaced in server logs.
- Health check indicates DB connection status.

### Story DB-2: Manual agent metadata storage
As a developer, I want a stable schema for storing manual agent metadata in MongoDB.

Acceptance criteria:
- Collection: `manual_agents` (configurable via env).
- Document schema (draft):
  - _id
  - name
  - description
  - status (draft|active|archived)
  - source (code)
  - version
  - createdAt / updatedAt
  - createdBy / updatedBy
- Indexes on `status`, `updatedAt`, `createdBy`.

### Story DB-3: Chat session storage
As a developer, I want chat sessions stored in MongoDB.

Acceptance criteria:
- Collection: `manual_agent_sessions`.
- Document schema (draft):
  - _id
  - agentId
  - sessionId
  - messages: [{ role, content, timestamp, metadata }]
  - startedAt / updatedAt
  - userId (nullable for public chat)
  - shareTokenId (nullable)
- Indexes on `agentId`, `sessionId`, `shareTokenId`.

### Story DB-4: Share token storage
As a developer, I want share tokens stored securely.

Acceptance criteria:
- Collection: `manual_agent_share_tokens`.
- Document schema (draft):
  - _id
  - agentId
  - tokenHash
  - status (active|revoked)
  - createdAt / revokedAt
  - createdBy
- Token stored as hash; never store raw token.

### Story DB-5: Seed Quintas data into MongoDB
As a developer, I want to import the Quintas JSON data from `docs/developments/quintas/data` into MongoDB so the agent has reference data.

Acceptance criteria:
- Import supports these files:
  - `quintas-calendario.json`
  - `quintas-catalogo.json`
  - `quintas-competencia.json`
  - `quintas-leads.json`
  - `quintas-restricciones.json`
- Each file maps to a dedicated collection (names defined in config).
- Import can be re-run idempotently (upsert by a stable key).
- Import reports counts (inserted/updated/skipped).

Proposed file -> collection mapping (v1):
- `quintas-calendario.json` -> `quintas_calendario` (unique key: `propertyId` + `year`)
- `quintas-catalogo.json` -> `quintas_catalogo` (unique key: `itemId` or `sku`)
- `quintas-competencia.json` -> `quintas_competencia` (unique key: `competitorId` or `name`)
- `quintas-leads.json` -> `quintas_leads` (unique key: `leadId` or `email`)
- `quintas-restricciones.json` -> `quintas_restricciones` (unique key: `ruleId` or `code`)

Calendar storage note:
- Store one document per property in `quintas_calendario` to simplify holds/bookings and indexing.
- Example document key: `{ propertyId: "rincon-principal", year: 2026 }`.

## Epic: API + Services

### Story API-1: Manual agent list/read endpoints
As a developer, I want endpoints to list and read manual agents.

Acceptance criteria:
- GET `/api/manual-agents` lists agents with pagination.
- GET `/api/manual-agents/:id` returns agent details.
- POST/PUT/DELETE are not required for v1 (agents are code-defined).

### Story API-2: Manual agent chat endpoint
As a developer, I want a chat endpoint that routes to a manual agent definition.

Acceptance criteria:
- POST `/api/manual-agents/:id/chat` accepts messages + optional sessionId.
- Creates session if not provided.
- Returns response, updates session history, and logs usage metrics.

### Story API-4: Hold -> payment -> booked flow
As a developer, I want a reservation lifecycle so holds only become bookings after payment is confirmed.

Acceptance criteria:
- POST `/api/manual-agents/:id/holds` creates a hold with `holdExpires`.
- POST `/api/manual-agents/:id/payments/confirm` flips a hold to `booked` for the date range.
- The calendar entry is updated atomically and logged.
- If the hold is expired, payment confirmation is rejected.

### Story UX-3: Hold and payment confirmation in chat UI
As an admin, I want a simple way to confirm payment and convert holds to bookings from inside the chat.

Acceptance criteria:
- Chat UI shows a "Hold created" status card with a "Confirm payment" button for admins.
- Clicking "Confirm payment" calls `/api/manual-agents/:id/payments/confirm` with the hold details.
- Public users do not see admin-only actions.
- If confirmation fails (expired/invalid), show a clear error and suggest alternatives.

Preferred mode: Public chat flow
- The client chats with the bot.
- The bot creates a hold and tells the client to send payment.
- Admin confirms payment in the admin UI (outside public chat).
- The bot updates the session and can send a follow-up message to the client.

Follow-up message payload (after admin confirmation):
```json
{
  "sessionId": "S-2026-0001",
  "agentId": "quintas",
  "type": "paymentConfirmed",
  "message": "Pago confirmado. Tu reserva quedó confirmada para el 15/01 al 17/01. Querés que te envíe el resumen?"
}
```

Follow-up delivery (recommended):
- Use polling on the public chat session (simple + reliable).
- Store follow-ups in `manual_agent_sessions.messages` and return them on the next client fetch.

UI component sketch (chat):
```tsx
// HoldStatusCard.tsx (admin-only)
type HoldStatusCardProps = {
  agentId: string
  hold: {
    propertyId: string
    start: string
    end: string
    leadId?: string
    holdExpires: string
  }
  isAdmin: boolean
  onConfirm: (payload: ConfirmPaymentPayload) => Promise<void>
}

type ConfirmPaymentPayload = {
  agentId: string
  propertyId: string
  start: string
  end: string
  leadId?: string
  paymentRef: string
  amount: number
  currency: string
}

// Renders a card with hold details and a "Confirm payment" button (visible only when isAdmin = true).
```

Event payload (confirm payment):
```json
POST /api/manual-agents/quintas/payments/confirm
{
  "propertyId": "rincon-principal",
  "start": "2026-01-15",
  "end": "2026-01-17",
  "leadId": "L-2025-001",
  "paymentRef": "TX-12345",
  "amount": 560,
  "currency": "USD"
}
```

### Story API-3: Share link endpoints
As a developer, I want endpoints to create and revoke share links.

Acceptance criteria:
- POST `/api/manual-agents/:id/share` returns public URL + token.
- DELETE `/api/manual-agents/:id/share/:tokenId` revokes a token.
- GET `/api/manual-agents/public/:token/chat` allows public chat.

## Epic: Permissions + Security

### Story SEC-1: Access control for admin flows
As a platform owner, I want to restrict manual agent management to authenticated users.

Acceptance criteria:
- All CRUD endpoints require auth.
- Share link creation requires admin/owner role (same as Agentflows).

### Story SEC-2: Public chat restrictions
As a platform owner, I want public access limited and safe.

Acceptance criteria:
- Public chat uses token-based access only.
- Rate limiting per IP + token.
- Sensitive admin data is not returned by public endpoints.

### Story SEC-3: Mongo write controls per agent
As a platform owner, I want per-agent allowlists for collections and operations.

Acceptance criteria:
- Manual agent definitions include allowedCollections and allowedOps (read|write).
- The runtime enforces these limits on every tool call.
- Attempts outside the allowlist are blocked and logged.

## Epic: Mapping "Quintas v0.5 Agents-clean.json"

### Story MAP-1: Behavior mapping from Quintas JSON to manual agent code
As a developer, I want to map the Quintas JSON behavior into a manual agent implemented like `exampleagent`.

Acceptance criteria:
- Extract required behaviors (name, prompt, tools, routing rules).
- Implement those behaviors directly in code (LLM prompt + tools + storage).
- Document any deviations or missing capabilities.

### Story MAP-2: Tool wiring
As a developer, I want to translate "Quintas v0.5" tool definitions into runtime tools.

Acceptance criteria:
- Each declared tool becomes a runtime tool with parameters and description.
- Tool execution can read/write to Mongo collections (only if allowlisted).
- Failures return structured errors and are logged.

## Implementation Plan (LLM-built agent, based on exampleagent)

1) Inventory the `exampleagent` pattern
- Identify frontend chat widget hook, backend entrypoint, services, and Mongo usage.
- Extract the minimal contract: input shape, output shape, session storage behavior.

2) Define the Manual Agent code contract
- Create a shared interface: `(message, sessionId, context) => { answer, stateUpdates?, isFinalStep? }`.
- Specify metadata fields (name, description, allowedCollections, tools).
- Decide the folder structure for manual agents.

3) Implement the Quintas manual agent in code
- Translate the Quintas JSON goals into a system prompt and tool routing.
- Add Mongo read/write helpers that enforce collection allowlists.
- Implement session logging into `manual_agent_sessions`.

4) Wire API endpoints
- List/read manual agents from code-defined registry + Mongo metadata.
- Add chat endpoint that routes to the manual agent and persists history.

5) Build the Manual Agents UI
- Manual Agents page lists available code-defined agents.
- Agent detail page loads metadata + share links.
- Public chat page loads by share token.

6) Seed Quintas data into MongoDB
- Write/import script to load JSON files in `docs/developments/quintas/data`.
- Run import and validate expected document counts.

## Epic: UX for Sharing + Public Chat

### Story UX-1: Share dialog
As an admin, I want a share dialog that shows the public URL.

Acceptance criteria:
- Share dialog shows active links and revoke buttons.
- Copy-to-clipboard button.
- Shows last used time and usage count (if available).

### Story UX-2: Public chat page
As a public user, I want a clean chat page to test the agent.

Acceptance criteria:
- Page loads by token and renders agent name and description.
- Chat is functional without login.
- No admin controls or sensitive data exposed.

## Epic: KPI + Outbound

### Story KPI-1: Competitor price tracking
As a manager, I want to track competitor prices so I can compare pricing against the market.

Acceptance criteria:
- Store competitor snapshots in `quintas_competencia`.
- Provide a simple KPI view: average competitor price vs our average price.
- Allow filtering by zone and date.

KPI example (draft):
- `avg_competitor_price = avg(quintas_competencia.pricePerNight)`
- `avg_our_price = avg(quintas_catalogo.properties.basePricePerNight)`
- `delta_pct = (avg_our_price - avg_competitor_price) / avg_competitor_price * 100`

### Story OUT-1: Outbound follow-up on low occupancy
As a manager, I want outbound messages when occupancy drops so we can recontact leads.

Acceptance criteria:
- Detect low occupancy using `kpiConfig` thresholds.
- Generate a list of leads to recontact (recent lost/open leads).
- Provide a one-click send of a predefined template (e.g., `promo-baja`).

Outbound trigger (draft):
- Run daily at 09:00 local time.
- If occupancy for next 14 days < `kpiConfig.occupancyTargetPct`, trigger outbound list.

## Conversation Flexibility Rules (Manual Agents)
- Tone and flow can vary per user message; avoid scripted repetition.
- Always respond in Spanish (Argentina).
- Always enforce guardrails:
  - No rain insurance.
  - AC status is communicated accurately per property (default: no AC).
  - Music rules: moderate by day; no amplified music after 22:00.
  - Discounts only for habitual clients when flagged.
  - Visits must align with visit policy and admin availability.
  - Payment rules and deadlines must be respected.
- If details are missing, ask focused questions (dates, people, property preference).
- When availability is tight, offer alternatives automatically.
- Holds do not become bookings until payment is confirmed; on payment, update status to `booked`.
- If requested dates are blocked, suggest other quintas or closest available dates.

## Conversation Strategy (Fluid Chat)
Goal: keep the chat natural while still collecting required details and enforcing rules.

Core behaviors:
- Detect intent (availability, pricing, visit, rules, discounts, follow-up).
- Extract slots when present (dates, people, property, budget).
- Ask only what is missing; avoid repeating questions.
- Always offer alternatives when requested dates are unavailable.
- Confirm key details before creating a hold.

Example flow snippets:
- If user asks "Tienen lugar para el 20/12?":
  - Check calendar; if booked/blocked: offer closest dates + other quintas.
- If user asks about rain insurance or AC:
  - Respond clearly: no rain insurance / no AC, suggest mitigation (carpa/ventiladores).
- If user asks to negotiate price:
  - Ask if they are a habitual client; apply discount only if flagged.
- If user wants a visit:
  - Offer the next available visit slots; collect preference.

## Simulation (Mock)
Goal: Demonstrate hold -> payment -> booked using sample payloads.

1) Create a hold
```json
POST /api/manual-agents/quintas/holds
{
  "propertyId": "rincon-principal",
  "start": "2026-01-15",
  "end": "2026-01-17",
  "leadId": "L-2025-001",
  "holdHours": 24,
  "notes": "espera de pago"
}
```

2) Confirm payment (convert hold to booked)
```json
POST /api/manual-agents/quintas/payments/confirm
{
  "propertyId": "rincon-principal",
  "start": "2026-01-15",
  "end": "2026-01-17",
  "leadId": "L-2025-001",
  "paymentRef": "TX-12345",
  "amount": 560,
  "currency": "USD"
}
```

Expected: the matching hold is replaced with a `booked` event in `quintas_calendario`.

## Data Update Logic (Mongo - draft)
Goal: Update the calendar atomically when a payment is confirmed.

1) Find and validate hold
```js
// Pseudocode
db.quintas_calendario.updateOne(
  {
    propertyId: "rincon-principal",
    "events": {
      $elemMatch: {
        status: "hold",
        start: "2026-01-15",
        end: "2026-01-17",
        holdExpires: { $gt: new Date() }
      }
    }
  },
  {
    $set: {
      "events.$[evt].status": "booked",
      "events.$[evt].paymentRef": "TX-12345",
      "events.$[evt].paidAt": new Date()
    }
  },
  {
    arrayFilters: [
      { "evt.status": "hold", "evt.start": "2026-01-15", "evt.end": "2026-01-17" }
    ]
  }
)
```

2) If updateCount is 0, return an error
- "Hold expired or not found"
- Optionally, create a new hold or suggest alternatives.

## Implementation Checklist (Ready-to-build)
- Define final Mongo schemas:
  - `quintas_calendario` per-property document shape (events, holds, booked fields).
  - `manual_agent_sessions` message schema (including card metadata).
- Finalize import keys and upsert logic for `docs/developments/quintas/data`.
- Define roles and permissions for hold creation and payment confirmation.
- Specify chat message payloads for:
  - Hold created card
  - Payment confirmed
  - Alternatives suggested
- Error handling policy:
  - Overlapping holds/bookings
  - Expired holds
  - Partial availability (offer alternatives)
- Add minimal tests:
  - Hold creation
  - Payment confirm -> booked
  - Public chat access restrictions

## Schemas and Payloads (Draft)

Calendar document (`quintas_calendario`) - per property:
```json
{
  "propertyId": "rincon-principal",
  "year": 2026,
  "timezone": "America/Argentina/Buenos_Aires",
  "checkInTime": "12:00",
  "checkOutTime": "10:00",
  "events": [
    {
      "start": "2026-01-15",
      "end": "2026-01-17",
      "status": "hold",
      "holdExpires": "2025-12-10T18:00:00Z",
      "leadId": "L-2025-001",
      "notes": "espera de pago"
    }
  ],
  "blockedDates": ["2026-01-25", "2026-01-26"],
  "visitSlots": [
    { "day": "saturday", "slots": ["10:00", "12:00", "15:00"] }
  ],
  "updatedAt": "2025-12-16T00:00:00Z"
}
```

Chat message schema (`manual_agent_sessions.messages`):
```json
{
  "role": "assistant",
  "content": "Te puedo ofrecer otras fechas cercanas.",
  "timestamp": "2026-01-01T10:00:00Z",
  "metadata": {
    "type": "holdCard",
    "hold": {
      "propertyId": "rincon-principal",
      "start": "2026-01-15",
      "end": "2026-01-17",
      "holdExpires": "2025-12-10T18:00:00Z",
      "leadId": "L-2025-001"
    }
  }
}
```

Create hold payload:
```json
POST /api/manual-agents/quintas/holds
{
  "propertyId": "rincon-principal",
  "start": "2026-01-15",
  "end": "2026-01-17",
  "leadId": "L-2025-001",
  "holdHours": 24,
  "notes": "espera de pago"
}
```

Hold created response (example):
```json
{
  "status": "hold",
  "holdExpires": "2025-12-10T18:00:00Z",
  "message": "Listo, reservo la fecha por 24 horas. Avisame cuando envíes la seña."
}
```

## Roles and Permissions (Draft)
- Admin: can create holds, confirm payments, revoke share links.
- Operator: can create holds, cannot confirm payments.
- Public: chat only, no admin actions.

## Error Responses (Draft)
Expired hold:
```json
{
  "error": "hold_expired",
  "message": "El hold ya venció. Querés que busque fechas cercanas?"
}
```

Overlap/conflict:
```json
{
  "error": "date_unavailable",
  "message": "Esas fechas ya no están disponibles. Puedo ofrecerte alternativas."
}
```

## Open Questions
- Where should manual agents be stored in the UI hierarchy (top-level or under Agentflows)?
- Should manual agents be versioned per change (v1, v2)?
- Should we allow multiple active share links per agent or only one?
- Should public sessions be persisted or ephemeral?

## Out of Scope (for v1)
- Advanced analytics dashboards.
- Multi-tenant org-level sharing beyond token links.
- Full JSON editor with schema-aware auto-complete.

## Risks
- Security risk if Mongo allowlists are too permissive.
- Token leakage if not hashed or revocable.
- Data growth in chat history without retention policy.

## Suggested Next Steps
- Align on schema for ManualAgent.definition.
- Confirm placement of UI page and routing.
- Decide if public chats should be stored long-term.

## Progress Tracker
Progress: 100%
- [x] Manual agents API + Mongo wiring (list/chat/holds/payments/share/public chat)
- [x] Manual Agents UI page + sidebar entry (pagination + last updated)
- [x] Public chat route and share link flow (agent name/description)
- [x] Hold confirmation UI button (admin)
- [x] Quintas seed loader (calendar/catalog/restrictions)
- [x] KPI dashboard + outbound suggestions
- [x] Outbound send action + scheduling + run logging
- [x] Share link management UI (list + revoke + usage stats)
- [x] Manual agent details panel (metadata/tools/collections)
- [x] Public chat rate limiting (IP + token)
- [x] Enforce per-agent allowlists for Mongo ops
- [x] Manual agent delete action (if needed)

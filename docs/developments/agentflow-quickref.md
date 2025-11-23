# Agentflow Quick Reference

Read this once to build or reason about Agentflows directly in chat. Sources: `docs/how to use/*` (Agentflow V2 primary, V1 legacy).

## Builders at a Glance
- **Assistant**: Fast, single assistant with tools + uploads. Minimal wiring.
- **Chatflow**: Classic single-agent graphs and simple LLM flows.
- **Agentflow V2**: Use for new work. Explicit orchestration, branches/loops, HITL, shared state, multi-agent patterns.
- **Agentflow V1**: Deprecated; keep only for legacy (`agentflowv1(depracated,dontuse).md`).

## Agentflow V2 Essentials
- **Explicit graph**: Each node is a discrete action; edges define order.
- **Flow State (`$flow.state`)**: Per-run key/value store.
  - Initialize all keys in **Start** (even empty); nodes can only update existing keys.
  - Read anywhere with `{{ $flow.state.key }}`; use to pass data across branches or late steps.
- **Memory** (LLM/Agent nodes): Toggle, window size, token cap. Off = stateless per run.
- **Human-in-the-loop**: **Human Input** node pauses and branches on user choice.
- **Variables syntax**: Use `{{ variable }}` to pull from prior nodes or Flow State; typing `{{` in UI shows options.
- **Tools vs Agent vs Tool node**: Agent chooses tools/knowledge; Tool node deterministically runs one tool with mapped args.

## Node Guide (V2)
- **Start**: Entry. Chat vs Form input, Ephemeral Memory, Flow State init.
- **LLM**: Direct model call; structured messages; optional JSON schema; memory; Flow State update.
- **Agent**: Goal-driven reasoning using messages, tools, document stores/vector stores; memory; Flow State update.
- **Tool**: Deterministic tool call; map arguments from outputs/state; optional Flow State update.
- **Retriever**: Query selected Document Stores; return text or text+metadata; can store in Flow State.
- **HTTP**: External API call (method/headers/body/auth); set response type.
- **Condition**: Rule-based branching on string/number/boolean comparisons.
- **Condition Agent**: LLM-based routing using instructions + scenarios.
- **Iteration**: For-each loop over an array; runs nested sub-flow per item.
- **Loop**: Jump back to a prior node; guard with Max Loop Count.
- **Human Input**: Pause for approval/feedback; proceed/reject outputs; description fixed or LLM-generated.
- **Direct Reply**: Send final message; end that path.
- **Custom Function**: Server-side JS; access `$flow.*`, `$vars.*`, defined inputs; must `return` a string; can update Flow State.
- **Execute Flow**: Call another Chatflow/Agentflow; pass input, optional override/base URL; returns result.

## Build Checklist (do this every time)
1) **Define inputs + outputs**: User chat vs form fields; final message shape.
2) **Plan Flow State schema** in Start (e.g., `task`, `facts`, `decision`, `result`, `retries`, `attachments`).
3) **Normalize input**: LLM node to clean/validate user/form data into Flow State keys.
4) **Route**: Condition (rules) or Condition Agent (LLM) to pick the branch.
5) **Act**: Agent (tools/knowledge), Tool, HTTP, Retriever. Persist important outputs to Flow State.
6) **Control**: Iteration for lists; Loop for retries; Human Input for approvals/safety stops.
7) **Finish**: Direct Reply or LLM/Agent with Return Response, composing from Flow State.
8) **Reuse**: Execute Flow for shared subflows; keep prompts and state keys consistent.

## Starter Patterns
- **Retrieval QA**: Start → LLM normalize question (store `query`) → Retriever (Document Store) → LLM answer using `{{ retriever.output }}` → Direct Reply.
- **Tool-first action**: Start → LLM extract params to Flow State → Tool node with mapped args → Human Input (optional approve) → Direct Reply with result.
- **Multi-agent**: Start (init `task`, `plan`, `workerResult`) → Agent (Supervisor messages, tools/knowledge) → Condition/Loop for delegation pattern → Agent (Worker) with scoped tools → Human Input for approvals → Direct Reply. Keep names descriptive so Supervisor can infer roles.
- **API orchestrator**: Start → LLM build request body → HTTP → LLM summarize/format → Direct Reply; add Loop for retry on non-200.

## Field Mapping Tips
- Use Flow State for anything needed later or across branches.
- Map tool/HTTP args from prior node outputs or Flow State (e.g., `{{ $flow.state.userEmail }}`).
- Set Return Response type on LLM/Agent to control how memory treats the output.
- For JSON schema outputs, define keys + types so downstream nodes read predictable data.

## Pitfalls to Avoid
- Forgetting to initialize Flow State keys in Start (nodes cannot add new keys mid-run).
- No Max Loop Count set on Loop; no guard on retries.
- Using memory when you wanted stateless (toggle off in LLM/Agent).
- Vague worker/supervisor names in multi-agent; Supervisor picks based on names.
- Not marking tools that need human approval (use Human Input or Require Human Input where applicable).

## Supporting Features (see `docs/how to use/Using Freia`)
- Document Stores / Upsertion / Uploads (knowledge prep), Streaming (SSE), Variables, Workspaces, Monitoring, Evaluations, Embed, Prediction.

## Data & Tools (Freia specifics)
- **Vector store (Pinecone)**: Default index `freia-rag`, namespace `Gomeria-v1.2` (from shared chatflows). Keep embedding model dimensions aligned with the index (existing flows use OpenAI embeddings). Use metadata filters (can include `$flow.chatId`, `$flow.state.*`) to scope results; file uploads add `chatId` metadata automatically.
- **Retrieval wiring**: Document Loader(s) → Embeddings → Pinecone → Retriever. Only one vector store can accept file uploads at a time; connect at least one Document Loader to enable uploads.
- **Upsert/refresh**: Prefer Document Stores; use Record Manager outputs for clean deletes/sync. API: `/vector/upsert/{id}` for chatflow-level upserts; Document Store APIs for refresh/delete.
- **Memory storage**: `MongoDBAtlasChatMemory` node persists chat history. Configure credential, `databaseName`, `collectionName`, `sessionId` (use `$flow.chatId`), and `memoryKey` to surface history into prompts. Toggle memory in LLM/Agent nodes per need; Flow State is separate and per run.
- **Tool usage**: Agent node with allowed tools (or Tool node for deterministic calls). When attaching Pinecone to Agent/Retriever, describe the knowledge so the agent knows when to use it. Name supervisors/workers and tools descriptively so routing stays accurate.

## Freia API Toolset (for Agents)
Env: `FREIA_API_BASE_URL`, `FREIA_API_KEY`; WhatsApp uses `WASENDER_API_KEY`.

- **Customers (customer-management-tools.json)**
  - Get customer info/history/search; create/update customer; create lead; save preferences; get analytics.
  - Typical fields: `clientId`, `name`, `email`, `phone`, `customerType` (`final_consumer`|`tire_shop`), `taxId`, `notes`.
  - Pattern: Start → LLM extract customer identifiers → Tool (GET/POST/PUT) → store result in Flow State for downstream sales/promo steps.
- **Inventory (inventory-tools.json)**
  - Check stock, low-stock alerts, reserve stock, update stock, find alternatives, create stock notification.
  - Keys: `productId`/`productCode`/`productName`, `quantity`, `clientId`, `threshold`, `category/brand/priceRange`.
  - Pattern: Before quoting, call **Check Product Stock**; on zero stock, call **Find Product Alternatives**; on interest, **Reserve Product Stock**; if out-of-stock, **Create Stock Notification**.
- **Sales Flow (sales-flow-tools.json)**
  - Create quote, product alternatives for price objections, apply discount, request price approval, delivery options, delivery improvement, create sale, payment methods, generate order number, sale summary.
  - Keys: `quoteId`, `clientId`, `productId`, `quantity`, `clientType`, `requestedDiscount`, `priority`, `address`, `urgency`, `paymentMethod`.
  - Pattern: Check stock → Create quote → Apply discount → If still blocked, Request price approval → Show delivery options → Confirm payment → Create sale → Generate order number → Get sale summary for Direct Reply.
- **Promotions (promotional-system-tools.json)**
  - Complementary products, seasonal promotions, bundle offers, custom bundle, loyalty rewards, clearance items, apply promo code.
  - Keys: `productId/category/vehicleModel`, `clientType`, `discountPercentage`, `validUntil`, `rewardType`.
  - Pattern: After quote/stock check, surface cross-sell/upsell with **Complementary**/**Bundle**/**Seasonal**; apply code or custom bundle if user mentions discounts.
- **Outbound / Notifications (outbound-contact-tools.json)**
  - Schedule/execute follow-ups, get pending follow-ups, send WhatsApp, notify price approval or delivery improvement.
  - Keys: `customerId/clientId`, `phoneNumber`, `saleId/followUpId`, `followUpType`, `scheduledAt`, `attemptNumber/maxAttempts`, `priority`.
  - Pattern: If user drops off or wants async response: **Schedule Follow-up**. For WhatsApp send, use `WASENDER_API_KEY`. When admin decisions come back, use notify endpoints.

### Tool wiring tips
- Map required params from Flow State (`clientId`, `productId`, `quoteId`, `chatId`, `chatflowId`).
- Keep auth headers in the tool config; avoid placing keys in prompts.
- Use Human Input before executing high-impact calls (price approvals, delivery changes, sale creation).
- Log tool outputs into Flow State (e.g., `quote`, `saleSummary`, `stockCheck`) for later message composition and to avoid repeated calls.

## When to Consider V1
- Only to maintain existing sequential/multi-agent V1 flows; all new builds should target V2.

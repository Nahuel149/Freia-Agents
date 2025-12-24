# Smart Wifi Access Agent Overview

## Frontend agent hook
- `frontend/src/components/chatbot/GuidedChat.tsx` – defines `INITIAL_CONVERSATION_STATE`, session setup (UUID per visitor), opening the chat window, the guided-chat flow (`handleSendMessage`), and the keyboard shortcut (`handleKeyPress`). The component emits the “Smart Wifi Access agent” greeting + state updates, and increments `currentQuestionIndex` based on `stateUpdates`/`isFinalStep`.
- `frontend/src/services/api.ts` – `sendChatMessage` converts `FrontendMessage` objects into the backend’s `ChatMessageInput` array, posts to `/api/chat/rag`, and parses the backend’s JSON response (`answer`, `stateUpdates`, `isFinalStep`).

## Backend agent entry points
- `backend/routers/chat.py` – exposes `/api/chat/rag`, ensures a Mongo `chat_history` document exists per `session_id`, logs every human/AI pair with timestamps, and routes each request to either the guided LangChain chain (when `current_state` is provided) or the fallback RAG chain. Returns `answer`, optional `state_updates`, and `is_final_step`.
- `backend/services/chat_service.py` – stores `GUIDED_QUESTIONS`, `EXPECTED_STATE_KEYS`, and the strict JSON-guided prompt (`GUIDED_SYSTEM_PROMPT`), builds the `GuidedChatResponseSchema`/`JsonOutputParser`, caches and reuses the guided chain, and also creates the MongoDB vector retriever + RAG prompt/chain that returns plain text. Uses environment-configured Mongo URI, database, collection, and index names.

## Visitor logging and persistence
- `backend/main.py` – boots FastAPI, wires `VisitorLoggingMiddleware`, connects to MongoDB using `MONGODB_URI`/`DATABASE_NAME`, creates indexes on `visitor_logs`, and stores the DB client on `app.state.db`.
- `backend/core/middleware/visitor_logging.py` – assigns or reads the `visitor_session_id` cookie, captures `ip_address`, `user_agent`, and timestamp, and inserts entries via `log_visitor` into `db.visitor_logs`.
- `backend/models/visitor_log.py` – Pydantic schema for saved visitor data, including Mongo `_id`, `ip_address`, `session_id`, `user_agent`, and `timestamp`.

## Configuration sources
- `backend/.env.development` – defines `MONGODB_URI`, `DATABASE_NAME`, `COLLECTION_NAME`, `CHAT_HISTORY_COLLECTION`, and `OPENAI_API_KEY` used by the chat service; also carries sensitive admin/jwt/mail settings that should be rotated before sharing.

## Storage details
- `chat_history` collection (name from `CHAT_HISTORY_COLLECTION`) keeps documents keyed by `session_id` with `started_at` and an array of `{ role, content, timestamp }` pairs for replay/debug.
- `visitor_logs` collection stores the Mumbai tracking docs `ip_address`, `session_id`, `user_agent`, and `timestamp` whenever the middleware sees a new session (with a `visitor_session_id` cookie set for 1 year).
- The guided chain uses MongoDBAtlasVectorSearch on the `MONGODB_VECTOR_COLLECTION` and `MONGODB_VECTOR_INDEX_NAME` to embed website docs for the RAG path, returning the top-15 chunks when `current_state` is null.

The “Smart Wifi Access agent” lives in both the frontend guided-chat UI and the backend guided-chat/service layers, while the backend visitor log paths capture the browser’s user-agent for analytics.

GuidedChat.tsx (line 46) – the guided chat component’s prompt list introduces “Hello! I’m a Smart Wifi Access agent…,” so this file defines the agent’s voice and flow.
GuidedChat.tsx (line 276) – the same component surfaces the “Connecting to Smart Wifi Access agent…” hint while the UI waits for the backend.
chat_service.py (line 47) – GUIDED_QUESTIONS starts with the exact agent greeting and the rest of that module wires the LangChain-driven agent flow.
visitor_logging.py (line 39) – middleware that captures each request’s user-agent header (logging the visiting browser/agent).
visitor_log.py (line 12) – visitor log schema includes user_agent, so any stored visit can be traced back to the requesting agent string.
Let me know if you’d like a broader inventory (e.g., search for other “agent” strings) or to follow a specific file’s logic next.

list me all the files involved and explanations like you did and how its stored in the db and everything


Agent Inventory

The React widget in GuidedChat.tsx (line 11),  (line 24),  (line 41), and  (line 46) defines the guided state defaults, spins up a sessionId/initial greeting whenever the panel opens, and, via handleSendMessage ( (line 124)), keeps the message list, AI thinking flag, and keyboard shortcut ( (line 204)) in sync while applying the backend’s stateUpdates and isFinalStep ( (line 173)).
sendChatMessage in api.ts (line 39)/ (line 49) centralizes the /api/chat/rag call: it wraps each FrontendMessage as a ChatMessageInput, sends the session_id, messages, and optional currentState, and parses the JSON answer, stateUpdates, and isFinalStep fields that the backend promises.
The backend router (chat.py (line 22),  (line 27),  (line 61)) accepts that shape, upserts a chat_history document with session_id, started_at, and a messages array ( (line 69)), then decides with current_state ( (line 97)) whether to hit the guided chain (appending each human/AI turn in  (line 115) and returning state_updates/is_final_step via  (line 125)- (line 127)) or fall back to the RAG chain and log the reply at  (line 146); every log entry stores role, content, and timestamp so you can replay the session in Mongo.
chat_service.py wires the actual agents: it loads MONGODB_URI, DATABASE_NAME, MONGODB_VECTOR_COLLECTION, MONGODB_VECTOR_INDEX_NAME, and OPENAI_API_KEY ( (line 31)- (line 34)), defines the guided question/state list plus the detailed GUIDED_SYSTEM_PROMPT ( (line 45),  (line 46),  (line 62)), builds the cached guided chain with GuidedChatResponseSchema/JsonOutputParser so only JSON comes back ( (line 119),  (line 147)), and constructs a MongoDBAtlasVectorSearch retriever ( (line 172),  (line 185),  (line 186),  (line 194),  (line 200)) that pulls the top 15 chunks ( (line 222)), formats their metadata ( (line 233)), and feeds them into the RAG template ( (line 243),  (line 253)) before StrOutputParser returns text ( (line 292)).
Mongo connectivity and analytics live in main.py/middleware: the app wires VisitorLoggingMiddleware (main.py (line 17),  (line 63)), opens the MongoClient ( (line 92)), creates visitor_logs indexes ( (line 99),  (line 100),  (line 101)), and stores the handle on app.state.db ( (line 105)); the middleware (visitor_logging.py (line 9)) traces new sessions via the visitor_session_id cookie ( (line 26)- (line 29),  (line 57)), records ip_address, user_agent, and timestamp ( (line 38),  (line 39),  (line 43)- (line 46),  (line 51)) into db.visitor_logs, and matches the VisitorLog schema (visitor_log.py (line 5),  (line 13)). All of these Mongo targets (the Chat History collection name, visitor/logging info, and the OpenAI key) are driven by .env.development (line 2)- (line 5) plus  (line 8).
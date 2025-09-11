# Agentflow v2 Manual — Building Agents in Freia

This manual explains how to design, configure, and operate Agentflow v2 agents in Freia. It is written for humans and LLMs, with step-by-step instructions, node-by-node options, wiring rules, execution behavior, patterns, and troubleshooting. Use it to build reliable agents quickly and consistently.

0) Quick Start — Build your first agent in 5 minutes
- Goal: Create a minimal Start → Agent → Direct Reply flow that echoes and reformats a user’s message.
- Steps (UI):
  1. Go to Agentflows (v2) → New.
  2. Add Start node (if not present). In Start: set startInputType = chatInput.
  3. Add an Agent node (agentAgentflow). Connect Start → Agent.
  4. In Agent: choose a model, set temperature to 0.2, and set systemMessage to “You are a helpful assistant. Keep answers concise.”
  5. Add Direct Reply node. Connect Agent → Direct Reply.
  6. Click Run and type a test prompt. You should see a streamed answer in the execution panel.
- Tip: If you need a ready-made example, import a template from Templates/Marketplace (e.g., a simple “Hello Agent” flow) and customize it.

1) Core Concepts
- Agentflow v2: A directed graph of nodes (steps) and edges (transitions) that controls an agent’s reasoning, tool use, retrieval, and messaging.
- Node: A self-contained capability (Start, LLM, Tool Agent, Retriever, HTTP, Condition, Human Input, Loop/Iteration, Direct Reply, Execute Flow, Sticky Note). Each node has:
  - data.name: unique technical name (e.g., startAgentflow, agentAgentflow)
  - data.label: display label (human-friendly)
  - data.inputParams: declarative form schema for the node’s configurable options
  - data.inputs: the node’s current values for each input parameter
  - inputAnchors / outputAnchors: typed connectors controlling how nodes can be wired
- Edge: A connection from an output handle of one node to an input handle of another.
- Input Params: Each field has name, label, type, optional, default, and often description. Common types: string, number, boolean, options, multiOptions, asyncOptions (populated dynamically), json, jsonArray, file.

2) Creating an Agentflow
- From Templates:
  - Go to Templates/Marketplace, choose an Agentflow v2 template, click Use or Import.
  - Templates are regular JSON files; the backend auto-discovers them from the Agentflow v2 marketplace directory.
- From Scratch:
  - Agentflows (v2) → New → Add nodes from the left panel, then wire them by dragging connectors.
  - Start node is the entry point and should be placed once per flow.
- Saving & Versioning:
  - Name your flow clearly (e.g., “Support QA Agent v2”).
  - Keep incremental variants (v2.1, v2.2) when trying new logic.

3) Node Catalog (Agentflow v2)
Below are the canonical node types as exposed by the UI. For each, you’ll find typical uses, common inputs, and wiring tips.

- startAgentflow — Start
  - Use: Define how a run begins (chat or form), initial memory behavior, and optional initial state.
  - Outputs: The initial message and state for downstream nodes.
  - Tips: Exactly one Start per flow. Choose chatInput for conversational flows; formInput for task-style workflows.

- llmAgentflow — LLM
  - Use: A single LLM call (no tool calling). Great for summarization, formatting, drafting, and transformations.
  - Common inputs: modelName, temperature, topP, maxTokens, presencePenalty, frequencyPenalty, streaming, stopSequence, systemMessage.
  - Tips: Keep temperature low for deterministic outputs; document schemas in systemMessage.

- agentAgentflow — Tool Agent
  - Use: An LLM agent with tool/function-calling and optional knowledge/RAG.
  - Common inputs: modelName (+ decoding params), systemMessage, maxIterations, agentTools/llmTools/selectedTool, retriever inputs.
  - Tips: Start with a small toolset; add tools only as needed. Set maxIterations to avoid runaway loops.

- retrieverAgentflow — Retriever
  - Use: Pull relevant documents from a vector or document store for grounding.
  - Common inputs: provider/index selection, topK, filters, similarity metric, reranking options.
  - Tips: Keep topK modest; prefer high-quality filtering to reduce noise.

- toolAgentflow — Tool Wrapper
  - Use: Encapsulate a specific tool or action that the Agent can call.
  - Outputs: A tool handle that connects to an Agent node’s Tools input.
  - Tips: Give descriptive labels so Agents can choose tools correctly via instructions.

- httpAgentflow — HTTP
  - Use: Call external HTTP APIs; transform or enrich data mid-chain.
  - Common inputs: method, url, headers, body, response handling.
  - Tips: Secure credentials via environment variables or model config fields; avoid logging secrets.

- conditionAgentflow — Condition
  - Use: Branch based on an expression/flag (e.g., if confidence > threshold).
  - Outputs: Typically two branches (true/false) or more named branches.
  - Tips: Ensure all branches are wired to avoid dead ends.

- conditionAgentAgentflow — Conditional Agent
  - Use: Condition step scoped to agent contexts (branch within agent-oriented flows).
  - Tips: Keep branch naming explicit; document logic with a Nearby Sticky Note.

- humanInputAgentflow — Human-in-the-Loop
  - Use: Pause execution, collect approval or manual input, then resume.
  - Tips: Use before risky actions (writes, high-cost calls). Make instructions short and actionable.

- loopAgentflow / iterationAgentflow — Loop / Iteration Grouping
  - Use: Repeat a subgraph or group repeated steps for visualization.
  - Tips: Provide clear loop bounds; expose iteration index to downstream nodes if needed.

- directReplyAgentflow — Direct Reply
  - Use: Return a response to the user immediately; often the terminal node.
  - Tips: Ensure at least one path reaches a reply or terminal node.

- executeFlowAgentflow — Execute Flow
  - Use: Call another flow (compose larger systems from smaller ones).
  - Tips: Validate required inputs/outputs; document contracts.

- stickyNoteAgentflow — Sticky Note
  - Use: Add non-executable documentation to the canvas.
  - Tips: Document assumptions, prompt fragments, or API contracts near relevant nodes.

4) Start Node Configuration
- startInputType (options)
  - chatInput: Free-form chat. Best for conversational agents.
  - formInput: Renders a form before execution.
    - formTitle (string): Title shown above the form.
    - formDescription (string): Helper text.
    - formInputTypes (array): Each item defines a form field with:
      - type: string | number | boolean | options | multiOptions | json | file
      - name (string) and label (string)
      - default (any), optional (boolean)
      - options (array) if type is options/multiOptions
- startEphemeralMemory (boolean)
  - true: don’t load prior chat history; clean run
  - false: include previous messages for context
- startState (json): initial shared state object (e.g., { "priority": "normal", "region": "US" })
- Best practices
  - Prefer chatInput for general-purpose agents; use formInput for structured tasks.
  - Keep the number of form fields minimal; only collect what’s needed.

5) LLM and Agent Nodes (Reasoning & Tool Use)
A) llmAgentflow — plain model call
- Key inputs (names may vary by provider, intent is consistent):
  - modelName (asyncOptions): choose provider/model
  - temperature, topP, maxTokens, presencePenalty, frequencyPenalty
  - streaming (boolean), stopSequence (comma-separated list)
  - systemMessage (string): role and constraints
  - baseOptions/basepath/proxyUrl (advanced): vendor-specific fields
  - allowImageUploads (boolean): for multimodal workflows if supported
- Prompting tips
  - Define output schema in the systemMessage (e.g., JSON keys).
  - Set temperature low for classification/extraction; higher for creative tasks.

B) agentAgentflow — tool-using agent
- Adds tool orchestration and RAG on top of LLM.
- Common inputs
  - systemMessage (string)
  - maxIterations (number)
  - Tools: agentTools | llmTools | selectedTool (depending on configuration)
  - Knowledge: connect retrieverAgentflow for context
  - Separate per-node model configs may exist (e.g., agentModelConfig, conditionAgentModelConfig)
- Tool attachment patterns
  - Graph wiring: Connect toolAgentflow → Agent’s Tools input.
  - Inputs list: Some Agents accept selectedTool(s) via inputs.
- RAG pattern
  - Retriever → Agent with systemMessage instructing usage of retrieved context.
- Guardrails
  - Use Human Input + Condition before effectful HTTP or write actions.

6) Tools and Integrations
- toolAgentflow (Tool Wrapper):
  - Configure a specific tool and pass it to an Agent via wiring.
  - Provide clear tool name, description, parameters; agents rely on descriptions to decide usage.
- httpAgentflow (HTTP):
  - method: GET/POST/PUT/DELETE/PATCH
  - url: endpoint with path params (use variables from state if supported)
  - headers/body: support JSON; never hardcode secrets
  - parse: map response fields to next steps
- retrieverAgentflow (Retriever):
  - provider/index: choose collection
  - topK: number of results
  - filters: metadata filters (e.g., tags, dates)
  - ranking: similarity/hybrid; optional rerank
- customFunctionAgentflow (if available):
  - Implement bespoke transformations or deterministic logic.

7) Control Flow Nodes
- conditionAgentflow
  - Inputs: expression/value; outputs: true/false (or named branches)
  - Ensure both branches connect to a valid next step.
- conditionAgentAgentflow
  - Same intent but scoped for agent contexts.
- humanInputAgentflow
  - Presents an approval gate or input form; resumes based on decision.
- loopAgentflow / iterationAgentflow
  - Define iteration bounds or a collection to map over; inspect grouped executions in the UI.

8) Memory
- Buffer Memory
  - Stores/retrieves conversation history under a sessionId and memoryKey (e.g., "chat_history").
  - Use persistent memory for assistants that benefit from context across messages.
- Ephemeral vs Persistent
  - Control initial loading via Start (startEphemeralMemory).
  - Persist outputs by keeping sessionId stable between runs in the same conversation.

9) Wiring and Valid Connections
- Types
  - Tools: toolAgentflow → agentAgentflow (Tools input)
  - Knowledge: retrieverAgentflow → agentAgentflow (Knowledge/Context input)
  - Control: condition/humanInput/loop link to standard flow inputs
- Rules
  - Place exactly one Start node and ensure at least one terminal path (e.g., Direct Reply).
  - Avoid dangling nodes (no incoming/outgoing edges).
  - Use descriptive labels for readability.

10) Input Param Schema (applies to all nodes)
- Field attributes
  - name (string), label (string)
  - type: string | number | boolean | options | multiOptions | asyncOptions | json | jsonArray | file
  - default (any), optional (boolean)
  - description (string), additionalParams (boolean)
  - rows (number) for multiline text; step (number) for numeric increments
  - options (array of { name, label }) for options/multiOptions
  - loadMethod (string) for asyncOptions (e.g., listModels)
- Dynamic visibility
  - Fields can appear/disappear based on other selections; the UI computes visibility before rendering.

11) Execution & Streaming
- Runs stream token-by-token for responsiveness.
- Execution panel shows node statuses (INPROGRESS/FINISHED/ERROR), tools invoked, artifacts produced, and retrieved documents.
- Iterations are grouped under an iteration node for readability.

12) Programmatic Usage (per-node configuration)
- When calling flows programmatically, per-node configs are often namespaced by node key (e.g., agentAgentflow_0).
- Example: agentModelConfig[agentAgentflow_0][apiKey] sets credentials for the first Agent node.
- This allows different providers/models per node inside one flow.

13) Templates & Reuse Patterns
- Minimal: Start → Agent → Direct Reply
- RAG: Start → Retriever → Agent (systemMessage: "Use only retrieved context. Answer concisely.") → Direct Reply
- Human approval: Start → Agent → Human Input → (Approve → HTTP) → Agent → Direct Reply
- Supervisor/Worker: Start → Agent (planner) → Loop/Iteration (workers) → Aggregation Agent → Direct Reply
- Compose: Start → Execute Flow (subflow) → Agent → Direct Reply

14) Best Practices
- Guardrails: Condition + Human Input before high-risk tools.
- Prompting: Be explicit about role, constraints, and output schema; add examples when needed.
- Models: Keep temperature ≤ 0.3 for deterministic tasks; increase for creativity.
- Knowledge: Prefer tight filters and smaller topK; rerank when supported.
- Observability: Use Sticky Notes to document intent and assumptions near relevant nodes.
- Modularity: Encapsulate tools and subflows for reuse.

15) Troubleshooting
- No output / flow stalls
  - Ensure there’s a terminal node reachable from Start (e.g., Direct Reply).
  - Check that required inputs on nodes are filled (model, URL, etc.).
- Model/tool not available
  - Select a provider/model via asyncOptions; supply credentials in per-node config sections.
- Unexpected branching
  - Inspect Condition node expression and actual values; log intermediate outputs with a temporary LLM node if needed.
- Retrieval is noisy
  - Reduce topK, add stronger filters, or add a rerank step if available.
- Tool loops too long
  - Lower maxIterations; tighten systemMessage to make tool use more targeted.

16) FAQ
- Q: How many Start nodes can I have?
  - A: One per flow.
- Q: Do I need a Direct Reply node?
  - A: Not strictly, but you need a terminal path that returns output to the user or an API caller.
- Q: Can I use different models for different Agent nodes?
  - A: Yes. Configure per-node model settings independently.
- Q: How do I pass variables between nodes?
  - A: Use the shared state and node outputs; downstream nodes can reference earlier outputs when configured to do so.

Appendix A — Field Reference Cheat Sheet
- Start (startAgentflow)
  - startInputType: chatInput | formInput
  - formTitle, formDescription, formInputTypes[] (type, name, label, default, optional, options)
  - startEphemeralMemory: boolean
  - startState: json
- LLM (llmAgentflow)
  - modelName, temperature, topP, maxTokens, presencePenalty, frequencyPenalty, streaming, stopSequence, systemMessage
- Agent (agentAgentflow)
  - modelName (+ decoding params), systemMessage, maxIterations
  - agentTools | llmTools | selectedTool
  - retriever/knowledge inputs (connect a Retriever node)
- Retriever (retrieverAgentflow)
  - provider/index, topK, filters, ranking/rerank
- Tool Wrapper (toolAgentflow)
  - tool configuration; output connects to Agent Tools input
- HTTP (httpAgentflow)
  - method, url, headers, body, parse/transform
- Condition (conditionAgentflow / conditionAgentAgentflow)
  - expression → true/false (or named) branches
- Human Input (humanInputAgentflow)
  - approval/input schema; resumes flow based on decision
- Loop/Iteration (loopAgentflow / iterationAgentflow)
  - iteration bounds/collection; groups executions for readability
- Direct Reply (directReplyAgentflow)
  - returns final output
- Execute Flow (executeFlowAgentflow)
  - target flow id + required inputs
- Sticky Note (stickyNoteAgentflow)
  - documentation only
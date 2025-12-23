# agentmaker.md - How to generate a Flowise Agentflow export (LLM-friendly)

Goal: given a high-level spec, produce a Flowise-compatible Agentflow V2 export JSON that imports cleanly (nodes render, dialogs open, no NaN/JSON.parse errors).

## Sources of truth
- Component schemas: `packages/components/nodes/agentflow/*/*.ts`
- Memory schema (if used): `packages/components/nodes/memory/MongoDBMemory/MongoDBMemory.ts`
- Icons/colors: `packages/ui/src/store/constant.js`
- Validator: `scripts/agentflow-validate.py`

## File format (top level)
- JSON with exactly two keys: `nodes` (array) and `edges` (array). Nothing else.

## Node object
```
{
  "id": "unique_string",
  "type": "agentFlow",
  "position": { "x": 0, "y": 0 },
  "data": {
    "id": "same_as_id",
    "label": "Human label",
    "name": "<component_name>",         // e.g., llmAgentflow
    "version": 1.0,                     // use component version
    "type": "<ComponentType>",          // e.g., LLM
    "color": "#RRGGBB",
    "baseClasses": ["<ComponentType>"],
    "category": "Agent Flows",
    "description": "...",
    "hideInput": true|false,            // true only for startAgentflow
    "hideOutput": true|false,           // true for directReplyAgentflow, loopAgentflow
    "inputAnchors": [],                 // optional but recommended
    "outputs": {},                      // optional but recommended
    "inputParams": [ ... ],             // matches component schema exactly
    "inputs": { ... },                  // keys match inputParams names
    "outputAnchors": [
      { "id": "<handle_id>", "name": "<handle_id>", "label": "<handle_id>" }
    ],
    "selected": false
  }
}
```

Notes:
- `inputParams` defines the UI fields; `inputs` holds the values.
- For any `inputParams` entry with `type: "asyncOptions"`, the UI will call the node load method; keep `loadMethod`/`loadConfig` intact.
- For fields with `show` or `optional`, you can omit the matching `inputs` key if you are not using it.
- For `array` input params, the `inputs` value must be an array of objects with the exact keys described in `inputParams.array`.
- Avoid empty string for arrays (use `[]`).

## Edge object
```
{
  "id": "<source>-<sourceHandle>-<target>-<targetHandle>",
  "source": "<source_node_id>",
  "target": "<target_node_id>",
  "sourceHandle": "<source_handle_id>",
  "targetHandle": "<target_node_id>",   // Flowise expects targetHandle == target id
  "type": "agentFlow",
  "data": { "sourceColor": "#...", "targetColor": "#...", "edgeLabel": "..." }
}
```

## Output anchors and handles
- Every `edge.sourceHandle` must exist in the source node `outputAnchors`.
- Use a consistent handle naming style:
  - Single-output nodes: `output` or `<nodeId>-output-<componentName>`.
  - ConditionAgent: `<nodeId>-output-<index>` OR scenario names. Pick one and make edges match.
  - Condition: `0`/`1` (else) and/or `true`/`false`. Make edges match.
  - HumanInput: `proceed` and `reject`.
- `outputAnchors` can include more handles than you use; it will not break imports.

## Placeholder handling
- Placeholders like `{{LLM_CREDENTIAL_ID}}`, `{{DOCSTORE_ID}}`, `{{ $flow.input }}` must stay as raw strings.
- Do not JSON-encode placeholders.
- For JSON-capable fields, prefer actual arrays/objects instead of JSON strings.

## Flowise variables ($vars)
- `$vars.NAME` resolves from Flowise Variables (Settings > Variables).
- Variables can be `static` (stored in DB) or `runtime` (read from server env).
- For `runtime`, set the env var in `packages/server/.env` with the same name.
- If a flow uses `$vars.NAME`, ensure it exists or the placeholder stays literal at runtime.
- Example runtime vars: FLOWISE_BASE_URL, FLOWISE_API_KEY, LEADS_DOCSTORE_ID, LEADS_DOC_ID, BOOKING_API_URL, BOOKING_API_KEY.

## Common sub-structures
- **Flow state updates** (used by LLM/Agent/Retriever/Tool/ExecuteFlow/CustomFunction):
  ```
  [{ "key": "stateKey", "value": "{{ some.variable }}" }]
  ```
- **LLM/Agent messages**:
  ```
  [{ "role": "system|assistant|developer|user", "content": "..." }]
  ```
- **Condition scenarios**:
  ```
  [{ "scenario": "name" }, { "scenario": "name2" }]
  ```
- **Document stores**:
  ```
  [{ "documentStore": "<UUID>:<NAME>" }]
  ```
- **Tool input args**:
  ```
  [{ "inputArgName": "arg", "inputArgValue": "{{ $flow.state.value }}" }]
  ```
- **Custom function variables**:
  ```
  [{ "variableName": "foo", "variableValue": "{{ $flow.state.foo }}" }]
  ```

## Component schemas (Agentflow V2)
Keep `name`, `type`, `version`, `color`, and `baseClasses` aligned with the component definitions below.

### startAgentflow (Start)
- `name`: startAgentflow
- `type`: Start
- `version`: 1.1
- `color`: #7EE787
- `inputParams`:
  - `startInputType` (options: chatInput|formInput, default chatInput)
  - `formTitle` (string, show when formInput)
  - `formDescription` (string, show when formInput)
  - `formInputTypes` (array of {type,label,name,addOptions})
  - `startEphemeralMemory` (boolean, optional)
  - `startState` (array of {key,value}, optional)
  - `startPersistState` (boolean, optional)
- `inputs` (minimum):
  - `startInputType`
  - `formTitle` ("" if chatInput)
  - `formDescription` ("" if chatInput)
  - `formInputTypes` ([] if chatInput)
  - `startState` ([])
  - `startPersistState` (optional)
- `hideInput`: true

### llmAgentflow (LLM)
- `name`: llmAgentflow
- `type`: LLM
- `version`: 1.0
- `color`: #64B5F6
- `inputParams`:
  - `llmModel` (asyncOptions listModels, loadConfig true)
  - `llmMessages` (array of {role, content})
  - `llmEnableMemory` (boolean, default true, optional)
  - `llmMemoryType` (options: allMessages|windowSize|conversationSummary|conversationSummaryBuffer, optional)
  - `llmMemoryWindowSize` (number, show when memoryType == windowSize)
  - `llmMemoryMaxTokenLimit` (number, show when memoryType == conversationSummaryBuffer)
  - `llmUserMessage` (string, optional, show when memory enabled)
  - `llmReturnResponseAs` (options: userMessage|assistantMessage, default userMessage)
  - `llmStructuredOutput` (array of {key,type,enumValues,jsonSchema,description}, optional)
  - `llmUpdateState` (array of {key,value}, optional)
- `inputs`:
  - `llmModel` (e.g., "chatOpenAI")
  - `llmMessages` (array)
  - Optional fields above as needed
  - `llmModelConfig` (object, includes `FLOWISE_CREDENTIAL_ID` and model settings)

### agentAgentflow (Agent)
- `name`: agentAgentflow
- `type`: Agent
- `version`: 2.0
- `color`: #4DD0E1
- `inputParams`:
  - `agentModel` (asyncOptions listModels, loadConfig true)
  - `agentMessages` (array of {role, content})
  - `agentToolsBuiltInOpenAI` (multiOptions, show when agentModel == chatOpenAI)
  - `agentTools` (array of {agentSelectedTool, agentSelectedToolRequiresHumanInput})
  - `agentKnowledgeDocumentStores` (array of {documentStore, docStoreDescription, returnSourceDocuments})
  - `agentKnowledgeVSEmbeddings` (array of {vectorStore, embeddingModel, knowledgeName, knowledgeDescription, returnSourceDocuments})
  - `agentEnableMemory` (boolean, default true, optional)
  - `agentMemoryType` (options: allMessages|windowSize|conversationSummary|conversationSummaryBuffer, optional)
  - `agentMemoryWindowSize` (number, show when memoryType == windowSize)
  - `agentMemoryMaxTokenLimit` (number, show when memoryType == conversationSummaryBuffer)
  - `agentUserMessage` (string, optional, show when memory enabled)
  - `agentReturnResponseAs` (options: userMessage|assistantMessage, default userMessage)
  - `agentUpdateState` (array of {key,value}, optional)
- `inputs`:
  - `agentModel`
  - `agentMessages`
  - Optional fields above as needed
  - `agentModelConfig` (object with `FLOWISE_CREDENTIAL_ID` and model settings)
  - Each entry in `agentTools` may include `agentSelectedToolConfig` (object with credentials/tool settings)

### conditionAgentAgentflow (Condition Agent)
- `name`: conditionAgentAgentflow
- `type`: ConditionAgent
- `version`: 1.1
- `color`: #ff8fab
- `inputParams`:
  - `conditionAgentModel` (asyncOptions listModels, loadConfig true)
  - `conditionAgentInstructions` (string)
  - `conditionAgentInput` (string)
  - `conditionAgentScenarios` (array of {scenario})
  - `conditionAgentOverrideSystemPrompt` (boolean, optional)
  - `conditionAgentSystemPrompt` (string, optional, show when override == true)
- `inputs`:
  - Above keys plus `conditionAgentModelConfig` (object with credentials/settings)

### conditionAgentflow (Condition)
- `name`: conditionAgentflow
- `type`: Condition
- `version`: 1.0
- `color`: #FFB938
- `inputParams`:
  - `conditions` (array)
    - `type` must be one of: `string`, `number`, `boolean` (lowercase)
    - `operation` depends on type:
      - string: contains, endsWith, equal, notContains, notEqual, regex, startsWith, isEmpty, notEmpty
      - number: smaller, smallerEqual, equal, notEqual, larger, largerEqual, isEmpty, notEmpty
      - boolean: equal, notEqual
    - `value1`, `value2` are type-specific
- `inputs`:
  - `conditions` array (do not pass as a raw JSON string)

### retrieverAgentflow (Retriever)
- `name`: retrieverAgentflow
- `type`: Retriever
- `version`: 1.0
- `color`: #b8bedd
- `inputParams`:
  - `retrieverKnowledgeDocumentStores` (array of {documentStore} using `listStores`)
  - `retrieverQuery` (string)
  - `outputFormat` (options: text|textWithMetadata, default text)
  - `retrieverUpdateState` (array of {key,value}, optional)
- `inputs`:
  - `retrieverKnowledgeDocumentStores`: `[{ "documentStore": "<UUID>:<NAME>" }]`
  - `retrieverQuery`, `outputFormat`, `retrieverUpdateState`

### toolAgentflow (Tool)
- `name`: toolAgentflow
- `type`: Tool
- `version`: 1.1
- `color`: #d4a373
- `inputParams`:
  - `toolAgentflowSelectedTool` (asyncOptions listTools, loadConfig true)
  - `toolInputArgs` (array of {inputArgName, inputArgValue})
  - `toolUpdateState` (array of {key,value}, optional)
- `inputs`:
  - `toolAgentflowSelectedTool`
  - `toolInputArgs`
  - Optional `toolUpdateState`
  - `toolAgentflowSelectedToolConfig` (object with credentials/tool settings, if required)

### httpAgentflow (HTTP)
- `name`: httpAgentflow
- `type`: HTTP
- `version`: 1.1
- `color`: #FF7F7F
- `inputParams`:
  - `method` (options: GET|POST|PUT|DELETE|PATCH, default GET)
  - `url` (string)
  - `headers` (array of {key,value}, optional)
  - `queryParams` (array of {key,value}, optional)
  - `bodyType` (options: json|raw|formData|xWwwFormUrlencoded, optional)
  - `body` (string for json/raw, array for formData/xWwwFormUrlencoded)
  - `responseType` (options: json|text|arraybuffer|base64, optional)
- `inputs`:
  - `method`, `url`, plus optional fields above
  - `credential` (optional, for httpBasicAuth/httpBearerToken/httpApiKey)

### customFunctionAgentflow (Custom Function)
- `name`: customFunctionAgentflow
- `type`: CustomFunction
- `version`: 1.0
- `color`: #E4B7FF
- `inputParams`:
  - `customFunctionInputVariables` (array of {variableName, variableValue})
  - `customFunctionJavascriptFunction` (code string)
  - `customFunctionUpdateState` (array of {key,value}, optional)
- `inputs`:
  - Use `variableName`/`variableValue` (not `name`/`value`)

### humanInputAgentflow (Human Input)
- `name`: humanInputAgentflow
- `type`: HumanInput
- `version`: 1.0
- `color`: #6E6EFD
- `inputParams`:
  - `humanInputDescriptionType` (options: fixed|dynamic)
  - `humanInputDescription` (string, show when fixed)
  - `humanInputModel` (asyncOptions listModels, show when dynamic)
  - `humanInputModelPrompt` (string, show when dynamic)
  - `humanInputEnableFeedback` (boolean, default true)
- `inputs`:
  - Above keys as needed
  - `humanInputModelConfig` when using dynamic mode

### directReplyAgentflow (Direct Reply)
- `name`: directReplyAgentflow
- `type`: DirectReply
- `version`: 1.0
- `color`: #4DDBBB
- `inputParams`: `directReplyMessage` (string)
- `hideOutput`: true

### loopAgentflow (Loop)
- `name`: loopAgentflow
- `type`: Loop
- `version`: 1.0
- `color`: #FFA07A
- `inputParams`:
  - `loopBackToNode` (string, format: "<nodeId>-<nodeLabel>")
  - `maxLoopCount` (number, default 5)
- `hideOutput`: true

### iterationAgentflow (Iteration)
- `name`: iterationAgentflow
- `type`: Iteration
- `version`: 1.0
- `color`: #9C89B8
- `inputParams`:
  - `iterationInput` (string, JSON array; accepts variables)

### executeFlowAgentflow (Execute Flow)
- `name`: executeFlowAgentflow
- `type`: ExecuteFlow
- `version`: 1.1
- `color`: #a3b18a
- `inputParams`:
  - `executeFlowSelectedFlow` (asyncOptions listFlows)
  - `executeFlowInput` (string)
  - `executeFlowOverrideConfig` (json object, optional)
  - `executeFlowBaseURL` (string, optional)
  - `executeFlowReturnResponseAs` (options: userMessage|assistantMessage, default userMessage)
  - `executeFlowUpdateState` (array of {key,value}, optional)
- `inputs`:
  - Above keys as needed
  - `credential` (optional, chatflowApi)

### stickyNoteAgentflow (Sticky Note)
- `name`: stickyNoteAgentflow
- `type`: StickyNote
- `version`: 1.0
- `color`: #fee440
- `inputParams`: `note` (string, optional)

### MongoDBAtlasChatMemory (Memory node)
- `name`: MongoDBAtlasChatMemory
- `type`: MongoDBAtlasChatMemory
- `version`: 1.0
- `inputParams`:
  - `databaseName` (string)
  - `collectionName` (string)
  - `sessionId` (string, optional)
  - `memoryKey` (string, default chat_history)
- `inputs`:
  - `credential` (placeholder for mongoDBUrlApi)
  - `databaseName`, `collectionName`, `sessionId`, `memoryKey`

## Validation checklist (before delivering JSON)
1) Top-level only `nodes` and `edges`.
2) Every edge `source`/`target` exists in `nodes`.
3) Every edge `sourceHandle` appears in the source node `outputAnchors`.
4) Every edge `targetHandle` equals the target node id.
5) Every node has `type: "agentFlow"` and `data.name` is a real component name.
6) `inputParams` match component schemas; `inputs` keys match `inputParams` names.
7) Arrays are arrays; booleans are booleans; no JSON strings for array fields.
8) All `$flow.state.*` keys used anywhere are initialized in `startState`.
9) Placeholders are plain strings (no extra JSON encoding).
10) Run `python scripts/agentflow-validate.py --flow <file>` if available.

## Runtime prerequisites (so the UI does not hang)
- Async option dropdowns (models, tools, document stores) call `/api/v1/node-load-method/*`. A 401 means the UI is not authenticated.
- Ensure you are logged in, your token is valid, and the UI points to the correct API base URL.
- Document stores referenced by `documentStore` must exist and be in `SYNC` status in the same workspace.
- Model credentials must exist and match `FLOWISE_CREDENTIAL_ID` in `*_ModelConfig`.

## Repairing edges/handles after "Sync Nodes"
If a sync wipes handles and lines, restore them with a known-good reference:
- Keep a reference export with correct edges (for example `agent-quintas-flowise-export.json`).
- Overwrite the broken file `edges` with the reference `edges`.
- Rebuild `outputAnchors` from edges: for each node, collect all `sourceHandle` values from outgoing edges and set `data.outputAnchors` to that set.
- Ensure each edge `targetHandle` equals the target node id.
- Save and re-import; connections will reappear without changing node positions or inputs.

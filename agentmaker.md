# agentmaker.md — How to generate a Flowise Agentflow export (LLM-friendly)

Goal: given a high-level spec, produce a Flowise-compatible Agentflow V2 export JSON that imports cleanly (nodes render, dialogs open, no `NaN`/`JSON.parse` errors).

## File format (top level)
- JSON with two keys: `nodes` (array) and `edges` (array). Nothing else.

### Node object
```
{
  "id": "unique_string",
  "type": "agentFlow",
  "position": { "x": 0, "y": 0 },       // numbers
  "data": {
    "id": "same_as_id",
    "label": "Human label",
    "name": "<component_name>",         // e.g., llmAgentflow
    "version": 1.0,                     // optional but preferred
    "type": "<ComponentType>",          // e.g., LLM
    "color": "#RRGGBB",                 // optional, matches AGENTFLOW_ICONS if possible
    "baseClasses": ["<ComponentType>"], // optional
    "category": "Agent Flows",          // optional
    "description": "...",               // optional
    "hideInput": true|false,            // set true for startAgentflow only
    "inputParams": [ ... ],             // matches Flowise component schema
    "inputs": { ... },                  // keys match inputParams names; values are strings/numbers/booleans/arrays
    "outputAnchors": [
      { "id": "<handle_id>", "name": "<handle_id>", "label": "<handle_id>" }
    ],
    "selected": false
  }
}
```

### Edge object
```
{
  "id": "<source>-<sourceHandle>-<target>-<targetHandle>",
  "source": "<source_node_id>",
  "target": "<target_node_id>",
  "sourceHandle": "<source_handle_id_or_output>",
  "targetHandle": "<target_node_id>",   // Flowise expects target handle equal to target id
  "type": "agentFlow",
  "data": { "sourceColor": "#...", "targetColor": "#...", "edgeLabel": "..." } // optional
}
```

## Allowed components and required inputs
Match these exactly; use the names from Flowise components.

- **startAgentflow (Start)**
  - `inputParams`: `startInputType` (options: chatInput/formInput, default chatInput), `formTitle` (string, show when form), `formDescription` (string, show when form), `formInputTypes` (array of form field configs), `startEphemeralMemory` (boolean, optional), `startState` (array of {key,value}, optional), `startPersistState` (boolean, optional).
  - `inputs`: `startInputType`, `formTitle`, `formDescription`, `formInputTypes` (empty string if unused), `startState` (array), `startPersistState` (optional).
  - Set `hideInput: true`.

- **llmAgentflow (LLM)**
  - `inputParams`: `llmModel` (asyncOptions), `llmMessages` (array of {role, content}, roles: system/assistant/developer/user), `llmEnableMemory` (boolean, default true, optional), `llmMemoryType` (options, optional), `llmSystemMessage` (string, optional), `llmOverrideSystemPrompt` (boolean, optional).
  - `inputs`: `llmModel`, `llmMessages` (array), others as needed.
  - Keep templated strings (e.g., `{{ $flow.input }}`) as plain strings.

- **conditionAgentAgentflow (Condition Agent)**
  - `inputParams`: `conditionAgentModel` (asyncOptions), `conditionAgentInstructions` (string), `conditionAgentInput` (string), `conditionAgentScenarios` (array of {scenario}), `conditionAgentOverrideSystemPrompt` (boolean, optional), `conditionAgentSystemPrompt` (string, optional, show when override).
  - `inputs`: match names above; `conditionAgentScenarios` is an array of objects, not a raw string.

- **conditionAgentflow (Condition)**
  - `inputParams`: `conditions` (array). Each entry has fields driven by `conditions[$index].type` (string/number/boolean) with `value1`, `operation`, `value2` or `compareValue`. Follow Flowise’s built-in structure.
  - `inputs`: `conditions` as an array of objects.

- **retrieverAgentflow (Retriever)**
  - `inputParams`: `retrieverKnowledgeDocumentStores` (array of `{documentStore}` asyncOptions loadMethod `listStores`), `retrieverQuery` (string, acceptVariable), `outputFormat` (options: text, textWithMetadata, default text), `retrieverUpdateState` (array of {key,value}, optional).
  - `inputs`: `retrieverKnowledgeDocumentStores` as array of `{ documentStore: "<DOCSTORE_ID_OR_PLACEHOLDER>" }`, `retrieverQuery` string (templated allowed), `outputFormat`, `retrieverUpdateState` array if needed.

- **customFunctionAgentflow (Custom Function)**
  - `inputParams`: `customFunctionInputVariables` (array of {variableName, variableValue}), `customFunctionJavascriptFunction` (code string), `customFunctionUpdateState` (array, optional).
  - `inputs`: match names; put JS code as string.

- **directReplyAgentflow (Direct Reply)**
  - `inputParams`: `directReplyMessage` (string).
  - `inputs`: `directReplyMessage`.

- **humanInputAgentflow (Human Input)**
  - `inputParams`: `humanInputDescriptionType` (options fixed/dynamic), `humanInputDescription` (string, show when fixed), `humanInputModel` (asyncOptions, show when dynamic), `humanInputModelPrompt` (string, show when dynamic), `humanInputEnableFeedback` (boolean).
  - `inputs`: match names; arrays/strings as needed.

- **executeFlowAgentflow (Execute Flow)** (if used)
  - `inputParams`: follow Flowise schema (e.g., target flow ID, payload input).
  - `inputs`: match names.

- **MongoDBAtlasChatMemory** (memory node)
  - `inputParams`: `databaseName` (string), `collectionName` (string), `sessionId` (string, optional), `memoryKey` (string, default chat_history).
  - `credentialNames`: `mongoDBUrlApi` (set via credential picker).
  - `inputs`: `credential` (placeholder), `databaseName`, `collectionName`, `sessionId`, `memoryKey`.

- Other supported: `loopAgentflow`, `iterationAgentflow`, `httpAgentflow`, `toolAgentflow`, `agentAgentflow`—mirror the working Gomería export for their exact fields.

## Placeholder handling
- Placeholders like `{{LLM_CREDENTIAL_ID}}`, `{{DOCSTORE_*_ID}}`, `{{ $flow.input }}` must stay as plain strings.
- Do NOT JSON-encode these placeholders; they should be simple string values in `inputs`.
- For array fields (`llmMessages`, `conditionAgentScenarios`, `conditions`, `retrieverKnowledgeDocumentStores`, etc.), use actual JSON arrays/objects, not strings.

## Output anchors and handles
- For each node, `outputAnchors` should list every outgoing handle used by edges. Typical defaults:
  - Start/LLM/Retriever/CustomFunction/DirectReply/HumanInput: one handle `output`.
  - ConditionAgent: one handle per scenario (ids often like `<nodeId>-output-<index>`); match the handles used in edges.
  - Condition: handles `true` and `false` (or `0/1` if numbered); match edges.
- Edge `targetHandle` must equal the target node id (Flowise’s agentflow renderer expects that).

## Positioning
- `position.x`/`position.y` numeric, reasonably spaced so the canvas auto-zooms well. Negative values are fine. Avoid extremely large ranges.

## Validation checklist (before delivering JSON)
1) Top-level only `nodes` and `edges`.
2) Every edge `source`/`target` exists in `nodes`.
3) Every edge `sourceHandle` appears in the source node’s `outputAnchors`.
4) Every node has `type: "agentFlow"` and `data.name` is a real Flowise component name (see list above).
5) `inputParams` match the component schema (names and types).
6) `inputs` keys match `inputParams` names; arrays are arrays, strings are strings; placeholders are plain strings.
7) No `NaN`, no unparsed JSON strings; if a field is JSON-typed, supply a valid JSON string or an array/object per schema.
8) Set `hideInput: true` only for `startAgentflow`.

## Example minimal node (LLM)
```
{
  "id": "llm_intent",
  "type": "agentFlow",
  "position": { "x": 200, "y": 0 },
  "data": {
    "id": "llm_intent",
    "label": "LLM Intent",
    "name": "llmAgentflow",
    "type": "LLM",
    "color": "#64B5F6",
    "inputParams": [ { "label": "Model", "name": "llmModel", "type": "asyncOptions", "loadMethod": "listModels", "loadConfig": true }, { "label": "Messages", "name": "llmMessages", "type": "array", "array": [ { "label": "Role", "name": "role", "type": "options", "options": [ { "label": "System", "name": "system" }, { "label": "User", "name": "user" } ] }, { "label": "Content", "name": "content", "type": "string", "rows": 4, "acceptVariable": true } ] } ],
    "inputs": {
      "llmModel": "{{LLM_CREDENTIAL_ID}}",
      "llmMessages": [
        { "role": "system", "content": "Classify intent..." },
        { "role": "user", "content": "{{ $flow.input }}" }
      ]
    },
    "outputAnchors": [ { "id": "output", "name": "output", "label": "output" } ],
    "selected": false
  }
}
```

Use this guide as the contract for any LLM generating Agentflow exports: if every rule here is followed, the file will import and node dialogs will render without runtime JSON/NaN errors.***

## Repairing edges/handles after “Sync Nodes”
If a sync wipes handles and lines, restore them with a known-good reference:
- Keep a reference export with correct edges (e.g., `agent-quintas-flowise-export.json`).
- Overwrite the broken file’s `edges` with the reference `edges`.
- Rebuild `outputAnchors` from edges: for each node, collect all `sourceHandle` values from outgoing edges and set `data.outputAnchors` to that sorted set (`[{id,name,label}=handle]`).
- Ensure each edge’s `targetHandle` equals the target node id.
- Save and re-import; connections will reappear without changing node positions or inputs.

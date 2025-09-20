# Assistants

## Create a new assistant

> Create a new assistant with the provided details

```json
{"tags":[{"name":"assistants"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/assistants":{"post":{"tags":["assistants"],"operationId":"createAssistant","summary":"Create a new assistant","description":"Create a new assistant with the provided details","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"details":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"model":{"type":"string"},"instructions":{"type":"string"},"temperature":{"type":"number"},"top_p":{"type":"number"},"tools":{"type":"array","items":{"type":"string"}},"tool_resources":{"type":"object","additionalProperties":{"type":"object"}}}},"credential":{"type":"string"},"iconSrc":{"type":"string"},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}},"required":true},"responses":{"200":{"description":"Assistant created successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1assistants/post/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid input provided"},"422":{"description":"Validation exception"}}}}}}
```

## Get assistant by ID

> Retrieve a specific assistant by ID

```json
{"tags":[{"name":"assistants"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/assistants/{id}":{"get":{"tags":["assistants"],"summary":"Get assistant by ID","description":"Retrieve a specific assistant by ID","operationId":"getAssistantById","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Assistant ID"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"details":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"model":{"type":"string"},"instructions":{"type":"string"},"temperature":{"type":"number"},"top_p":{"type":"number"},"tools":{"type":"array","items":{"type":"string"}},"tool_resources":{"type":"object","additionalProperties":{"type":"object"}}}},"credential":{"type":"string"},"iconSrc":{"type":"string"},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}},"400":{"description":"The specified ID is invalid"},"404":{"description":"Assistant not found"},"500":{"description":"Internal error"}}}}}}
```

## Update assistant details

> Update the details of an existing assistant

```json
{"tags":[{"name":"assistants"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/assistants/{id}":{"put":{"tags":["assistants"],"summary":"Update assistant details","description":"Update the details of an existing assistant","operationId":"updateAssistant","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Assistant ID"}],"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"details":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"model":{"type":"string"},"instructions":{"type":"string"},"temperature":{"type":"number"},"top_p":{"type":"number"},"tools":{"type":"array","items":{"type":"string"}},"tool_resources":{"type":"object","additionalProperties":{"type":"object"}}}},"credential":{"type":"string"},"iconSrc":{"type":"string"},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}},"responses":{"200":{"description":"Assistant updated successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1assistants~1{id}/put/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"The specified ID is invalid or body is missing"},"404":{"description":"Assistant not found"},"500":{"description":"Internal error"}}}}}}
```

## Delete an assistant

> Delete an assistant by ID

```json
{"tags":[{"name":"assistants"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/assistants/{id}":{"delete":{"tags":["assistants"],"summary":"Delete an assistant","description":"Delete an assistant by ID","operationId":"deleteAssistant","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Assistant ID"}],"responses":{"200":{"description":"Assistant deleted successfully"},"400":{"description":"The specified ID is invalid"},"404":{"description":"Assistant not found"},"500":{"description":"Internal error"}}}}}}
```

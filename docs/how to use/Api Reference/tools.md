# Tools

## Create a new tool

> Create a new tool

```json
{"tags":[{"name":"tools"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/tools":{"post":{"tags":["tools"],"operationId":"createTool","summary":"Create a new tool","description":"Create a new tool","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the tool"},"name":{"type":"string","description":"Name of the tool"},"description":{"type":"string","description":"Description of the tool"},"color":{"type":"string","description":"Color associated with the tool"},"iconSrc":{"type":"string","nullable":true,"description":"Source URL for the tool's icon"},"schema":{"type":"string","nullable":true,"description":"JSON schema associated with the tool"},"func":{"type":"string","nullable":true,"description":"Functionality description or code associated with the tool"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the tool was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the tool was last updated"}}}}},"required":true},"responses":{"200":{"description":"Tool created successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1tools/post/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid request body"},"422":{"description":"Validation error"},"500":{"description":"Internal server error"}}}}}}
```

## List all tools

> Retrieve a list of all tools

```json
{"tags":[{"name":"tools"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/tools":{"get":{"tags":["tools"],"summary":"List all tools","description":"Retrieve a list of all tools","operationId":"getAllTools","responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the tool"},"name":{"type":"string","description":"Name of the tool"},"description":{"type":"string","description":"Description of the tool"},"color":{"type":"string","description":"Color associated with the tool"},"iconSrc":{"type":"string","nullable":true,"description":"Source URL for the tool's icon"},"schema":{"type":"string","nullable":true,"description":"JSON schema associated with the tool"},"func":{"type":"string","nullable":true,"description":"Functionality description or code associated with the tool"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the tool was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the tool was last updated"}}}}}}},"500":{"description":"Internal server error"}}}}}}
```

## Get a tool by ID

> Retrieve a specific tool by ID

```json
{"tags":[{"name":"tools"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/tools/{id}":{"get":{"tags":["tools"],"summary":"Get a tool by ID","description":"Retrieve a specific tool by ID","operationId":"getToolById","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Tool ID"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the tool"},"name":{"type":"string","description":"Name of the tool"},"description":{"type":"string","description":"Description of the tool"},"color":{"type":"string","description":"Color associated with the tool"},"iconSrc":{"type":"string","nullable":true,"description":"Source URL for the tool's icon"},"schema":{"type":"string","nullable":true,"description":"JSON schema associated with the tool"},"func":{"type":"string","nullable":true,"description":"Functionality description or code associated with the tool"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the tool was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the tool was last updated"}}}}}},"400":{"description":"Invalid ID provided"},"404":{"description":"Tool not found"},"500":{"description":"Internal server error"}}}}}}
```

## Update a tool by ID

> Update a specific tool by ID

```json
{"tags":[{"name":"tools"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/tools/{id}":{"put":{"tags":["tools"],"summary":"Update a tool by ID","description":"Update a specific tool by ID","operationId":"updateTool","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Tool ID"}],"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the tool"},"name":{"type":"string","description":"Name of the tool"},"description":{"type":"string","description":"Description of the tool"},"color":{"type":"string","description":"Color associated with the tool"},"iconSrc":{"type":"string","nullable":true,"description":"Source URL for the tool's icon"},"schema":{"type":"string","nullable":true,"description":"JSON schema associated with the tool"},"func":{"type":"string","nullable":true,"description":"Functionality description or code associated with the tool"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the tool was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the tool was last updated"}}}}},"required":true},"responses":{"200":{"description":"Tool updated successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1tools~1{id}/put/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid ID or request body provided"},"404":{"description":"Tool not found"},"500":{"description":"Internal server error"}}}}}}
```

## Delete a tool by ID

> Delete a specific tool by ID

```json
{"tags":[{"name":"tools"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/tools/{id}":{"delete":{"tags":["tools"],"summary":"Delete a tool by ID","description":"Delete a specific tool by ID","operationId":"deleteTool","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Tool ID"}],"responses":{"200":{"description":"Tool deleted successfully"},"400":{"description":"Invalid ID provided"},"404":{"description":"Tool not found"},"500":{"description":"Internal server error"}}}}}}
```

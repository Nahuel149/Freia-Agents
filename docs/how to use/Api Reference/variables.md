# Variables

## Create a new variable

> Create a new variable

```json
{"tags":[{"name":"variables"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/variables":{"post":{"tags":["variables"],"operationId":"createVariable","summary":"Create a new variable","description":"Create a new variable","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the variable"},"name":{"type":"string","description":"Name of the variable"},"value":{"type":"string","description":"Value of the variable","nullable":true},"type":{"type":"string","description":"Type of the variable (e.g., string, number)"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the variable was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the variable was last updated"}}}}},"required":true},"responses":{"200":{"description":"Variable created successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1variables/post/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid request body"},"422":{"description":"Validation error"},"500":{"description":"Internal server error"}}}}}}
```

## List all variables

> Retrieve a list of all variables

```json
{"tags":[{"name":"variables"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/variables":{"get":{"tags":["variables"],"summary":"List all variables","description":"Retrieve a list of all variables","operationId":"getAllVariables","responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the variable"},"name":{"type":"string","description":"Name of the variable"},"value":{"type":"string","description":"Value of the variable","nullable":true},"type":{"type":"string","description":"Type of the variable (e.g., string, number)"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the variable was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the variable was last updated"}}}}}}},"500":{"description":"Internal server error"}}}}}}
```

## Update a variable by ID

> Update a specific variable by ID

```json
{"tags":[{"name":"variables"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/variables/{id}":{"put":{"tags":["variables"],"summary":"Update a variable by ID","description":"Update a specific variable by ID","operationId":"updateVariable","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Variable ID"}],"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the variable"},"name":{"type":"string","description":"Name of the variable"},"value":{"type":"string","description":"Value of the variable","nullable":true},"type":{"type":"string","description":"Type of the variable (e.g., string, number)"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the variable was created"},"updatedDate":{"type":"string","format":"date-time","description":"Date and time when the variable was last updated"}}}}},"required":true},"responses":{"200":{"description":"Variable updated successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1variables~1{id}/put/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid ID or request body provided"},"404":{"description":"Variable not found"},"500":{"description":"Internal server error"}}}}}}
```

## Delete a variable by ID

> Delete a specific variable by ID

```json
{"tags":[{"name":"variables"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/variables/{id}":{"delete":{"tags":["variables"],"summary":"Delete a variable by ID","description":"Delete a specific variable by ID","operationId":"deleteVariable","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Variable ID"}],"responses":{"200":{"description":"Variable deleted successfully"},"400":{"description":"Invalid ID provided"},"404":{"description":"Variable not found"},"500":{"description":"Internal server error"}}}}}}
```

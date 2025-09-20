# Leads

## Get all leads for a specific chatflow

> Retrieve all leads associated with a specific chatflow

```json
{"tags":[{"name":"leads"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/leads/{id}":{"get":{"tags":["leads"],"summary":"Get all leads for a specific chatflow","description":"Retrieve all leads associated with a specific chatflow","operationId":"getAllLeadsForChatflow","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Chatflow ID"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the lead"},"name":{"type":"string","description":"Name of the lead"},"email":{"type":"string","description":"Email address of the lead"},"phone":{"type":"string","description":"Phone number of the lead"},"chatflowid":{"type":"string","description":"ID of the chatflow the lead is associated with"},"chatId":{"type":"string","description":"ID of the chat session the lead is associated with"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the lead was created"}}}}}}},"400":{"description":"Invalid ID provided"},"404":{"description":"Leads not found"},"500":{"description":"Internal server error"}}}}}}
```

## Create a new lead in a chatflow

> Create a new lead associated with a specific chatflow

```json
{"tags":[{"name":"leads"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/leads":{"post":{"tags":["leads"],"operationId":"createLead","summary":"Create a new lead in a chatflow","description":"Create a new lead associated with a specific chatflow","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the lead"},"name":{"type":"string","description":"Name of the lead"},"email":{"type":"string","description":"Email address of the lead"},"phone":{"type":"string","description":"Phone number of the lead"},"chatflowid":{"type":"string","description":"ID of the chatflow the lead is associated with"},"chatId":{"type":"string","description":"ID of the chat session the lead is associated with"},"createdDate":{"type":"string","format":"date-time","description":"Date and time when the lead was created"}}}}},"required":true},"responses":{"200":{"description":"Lead created successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1leads/post/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid request body"},"422":{"description":"Validation error"},"500":{"description":"Internal server error"}}}}}}
```

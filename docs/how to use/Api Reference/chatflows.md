# Chatflows

## List all chatflows

> Retrieve a list of all chatflows

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows":{"get":{"tags":["chatflows"],"summary":"List all chatflows","description":"Retrieve a list of all chatflows","operationId":"listChatflows","responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"flowData":{"type":"string"},"deployed":{"type":"boolean"},"isPublic":{"type":"boolean"},"apikeyid":{"type":"string"},"chatbotConfig":{"type":"string"},"apiConfig":{"type":"string"},"analytic":{"type":"string"},"speechToText":{"type":"string"},"category":{"type":"string"},"type":{"type":"string","enum":["CHATFLOW","MULTIAGENT"]},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}}},"500":{"description":"Internal error"}}}}}}
```

## Get chatflow by ID

> Retrieve a specific chatflow by ID

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows/{id}":{"get":{"tags":["chatflows"],"summary":"Get chatflow by ID","description":"Retrieve a specific chatflow by ID","operationId":"getChatflowById","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Chatflow ID"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"flowData":{"type":"string"},"deployed":{"type":"boolean"},"isPublic":{"type":"boolean"},"apikeyid":{"type":"string"},"chatbotConfig":{"type":"string"},"apiConfig":{"type":"string"},"analytic":{"type":"string"},"speechToText":{"type":"string"},"category":{"type":"string"},"type":{"type":"string","enum":["CHATFLOW","MULTIAGENT"]},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}},"400":{"description":"The specified ID is invalid"},"404":{"description":"Chatflow not found"},"500":{"description":"Internal error"}}}}}}
```

## Get chatflow by API key

> Retrieve a chatflow using an API key

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows/apikey/{apikey}":{"get":{"tags":["chatflows"],"summary":"Get chatflow by API key","description":"Retrieve a chatflow using an API key","operationId":"getChatflowByApiKey","parameters":[{"in":"path","name":"apikey","required":true,"schema":{"type":"string"},"description":"API key associated with the chatflow"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"flowData":{"type":"string"},"deployed":{"type":"boolean"},"isPublic":{"type":"boolean"},"apikeyid":{"type":"string"},"chatbotConfig":{"type":"string"},"apiConfig":{"type":"string"},"analytic":{"type":"string"},"speechToText":{"type":"string"},"category":{"type":"string"},"type":{"type":"string","enum":["CHATFLOW","MULTIAGENT"]},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}},"400":{"description":"The specified API key is invalid"},"404":{"description":"Chatflow not found"},"500":{"description":"Internal error"}}}}}}
```

## Update chatflow details

> Update the details of an existing chatflow

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows/{id}":{"put":{"tags":["chatflows"],"summary":"Update chatflow details","description":"Update the details of an existing chatflow","operationId":"updateChatflow","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Chatflow ID"}],"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"flowData":{"type":"string"},"deployed":{"type":"boolean"},"isPublic":{"type":"boolean"},"apikeyid":{"type":"string"},"chatbotConfig":{"type":"string"},"apiConfig":{"type":"string"},"analytic":{"type":"string"},"speechToText":{"type":"string"},"category":{"type":"string"},"type":{"type":"string","enum":["CHATFLOW","MULTIAGENT"]},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}}},"responses":{"200":{"description":"Chatflow updated successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1chatflows~1{id}/put/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"The specified ID is invalid or body is missing"},"404":{"description":"Chatflow not found"},"500":{"description":"Internal error"}}}}}}
```

## Delete a chatflow

> Delete a chatflow by ID

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows/{id}":{"delete":{"tags":["chatflows"],"summary":"Delete a chatflow","description":"Delete a chatflow by ID","operationId":"deleteChatflow","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Chatflow ID"}],"responses":{"200":{"description":"Chatflow deleted successfully"},"400":{"description":"The specified ID is invalid"},"404":{"description":"Chatflow not found"},"500":{"description":"Internal error"}}}}}}
```

## Create a new chatflow

> Create a new chatflow with the provided details

```json
{"tags":[{"name":"chatflows"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/chatflows":{"post":{"tags":["chatflows"],"operationId":"createChatflow","summary":"Create a new chatflow","description":"Create a new chatflow with the provided details","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"flowData":{"type":"string"},"deployed":{"type":"boolean"},"isPublic":{"type":"boolean"},"apikeyid":{"type":"string"},"chatbotConfig":{"type":"string"},"apiConfig":{"type":"string"},"analytic":{"type":"string"},"speechToText":{"type":"string"},"category":{"type":"string"},"type":{"type":"string","enum":["CHATFLOW","MULTIAGENT"]},"createdDate":{"type":"string","format":"date-time"},"updatedDate":{"type":"string","format":"date-time"}}}}},"required":true},"responses":{"200":{"description":"Chatflow created successfully","content":{"application/json":{"schema":{"type":"object","properties":{"$ref":"#/paths/~1chatflows/post/requestBody/content/application~1json/schema/properties"}}}}},"400":{"description":"Invalid input provided"},"422":{"description":"Validation exception"}}}}}}
```

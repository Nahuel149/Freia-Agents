# Attachments

## Create attachments array

> Return contents of the files in plain string format

```json
{"tags":[{"name":"attachments"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/attachments/{chatflowId}/{chatId}":{"post":{"tags":["attachments"],"operationId":"createAttachment","summary":"Create attachments array","description":"Return contents of the files in plain string format","parameters":[{"in":"path","name":"chatflowId","required":true,"schema":{"type":"string"},"description":"Chatflow ID"},{"in":"path","name":"chatId","required":true,"schema":{"type":"string"},"description":"Chat ID"}],"requestBody":{"content":{"multipart/form-data":{"schema":{"type":"object","properties":{"files":{"type":"array","items":{"type":"string","format":"binary"},"description":"Files to be uploaded"},"base64":{"type":"boolean","default":false,"description":"Return contents of the files in base64 format"}},"required":["files"]}}},"required":true},"responses":{"200":{"description":"Attachments created successfully","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"Name of the file"},"mimeType":{"type":"string","description":"Mime type of the file"},"size":{"type":"string","description":"Size of the file"},"content":{"type":"string","description":"Content of the file in string format"}}}}}}},"400":{"description":"Invalid input provided"},"404":{"description":"Chatflow or ChatId not found"},"422":{"description":"Validation error"},"500":{"description":"Internal server error"}}}}}}
```

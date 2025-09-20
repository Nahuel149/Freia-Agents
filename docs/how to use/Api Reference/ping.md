# Ping

## Ping the server

> Ping the server to check if it is running

```json
{"tags":[{"name":"ping"}],"paths":{"/ping":{"get":{"tags":["ping"],"summary":"Ping the server","description":"Ping the server to check if it is running","operationId":"pingServer","responses":{"200":{"description":"Server is running","content":{"text/plain":{"schema":{"type":"string"}}}},"500":{"description":"Internal server error"}}}}}}
```

# Upsert History

## Get all upsert history records

> Retrieve all upsert history records with optional filters

```json
{"tags":[{"name":"upsert-history"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/upsert-history/{id}":{"get":{"tags":["upsert-history"],"summary":"Get all upsert history records","description":"Retrieve all upsert history records with optional filters","operationId":"getAllUpsertHistory","parameters":[{"in":"path","name":"id","required":true,"schema":{"type":"string"},"description":"Chatflow ID to filter records by"},{"in":"query","name":"order","required":false,"schema":{"type":"string","enum":["ASC","DESC"],"default":"ASC"},"description":"Sort order of the results (ascending or descending)"},{"in":"query","name":"startDate","required":false,"schema":{"type":"string","format":"date-time"},"description":"Filter records from this start date (inclusive)"},{"in":"query","name":"endDate","required":false,"schema":{"type":"string","format":"date-time"},"description":"Filter records until this end date (inclusive)"}],"responses":{"200":{"description":"Successful operation","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Unique identifier for the upsert history record"},"chatflowid":{"type":"string","description":"ID of the chatflow associated with the upsert history"},"result":{"type":"string","description":"Result of the upsert operation, stored as a JSON string"},"flowData":{"type":"string","description":"Flow data associated with the upsert operation, stored as a JSON string"},"date":{"type":"string","format":"date-time","description":"Date and time when the upsert operation was performed"}}}}}}},"500":{"description":"Internal server error"}}}}}}
```

## Delete upsert history records

> Soft delete upsert history records by IDs

```json
{"tags":[{"name":"upsert-history"}],"security":[{"bearerAuth":[]}],"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}}},"paths":{"/upsert-history/{id}":{"patch":{"tags":["upsert-history"],"summary":"Delete upsert history records","description":"Soft delete upsert history records by IDs","operationId":"patchDeleteUpsertHistory","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"ids":{"type":"array","items":{"type":"string","format":"uuid"},"description":"List of upsert history record IDs to delete"}}}}}},"responses":{"200":{"description":"Successfully deleted records"},"400":{"description":"Invalid request body"},"500":{"description":"Internal server error"}}}}}}
```

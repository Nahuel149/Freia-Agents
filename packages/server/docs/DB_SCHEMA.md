# Database Schema

Generated on 2025-09-13T16:14:38.369Z

## Tables

- Total: 39

### public.api_key

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | character varying | NO |  | |
| apiKey | character varying | NO |  | |
| apiSecret | character varying | NO |  | |
| keyName | character varying | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | character varying | YES |  | |

#### Indexes
- PK_api_key: `CREATE UNIQUE INDEX "PK_api_key" ON public.api_key USING btree (id)`

### public.apikey

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| apiKey | character varying | NO |  | |
| apiSecret | character varying | NO |  | |
| keyName | character varying | NO |  | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_apikey_workspaceId]`

#### Indexes
- PK_96109043dd704f53-9830ab78f0: `CREATE UNIQUE INDEX "PK_96109043dd704f53-9830ab78f0" ON public.apikey USING btree (id)`
- idx_apikey_workspaceId: `CREATE INDEX "idx_apikey_workspaceId" ON public.apikey USING btree ("workspaceId")`

### public.assistant

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| credential | uuid | NO |  | |
| details | text | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |
| type | text | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_assistant_workspaceId]`

#### Indexes
- PK_assistant: `CREATE UNIQUE INDEX "PK_assistant" ON public.assistant USING btree (id)`
- idx_assistant_workspaceId: `CREATE INDEX "idx_assistant_workspaceId" ON public.assistant USING btree ("workspaceId")`

### public.chat_flow

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| flowData | text | YES |  | |
| deployed | boolean | YES |  | |
| isPublic | boolean | YES |  | |
| apikeyid | character varying | YES |  | |
| chatbotConfig | text | YES |  | |
| apiConfig | text | YES |  | |
| analytic | text | YES |  | |
| speechToText | text | YES |  | |
| followUpPrompts | text | YES |  | |
| category | character varying | YES |  | |
| type | character varying(20) | NO | `'CHATFLOW'::character varying` | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_chat_flow_workspaceId]`

#### Indexes
- PK_chat_flow: `CREATE UNIQUE INDEX "PK_chat_flow" ON public.chat_flow USING btree (id)`
- idx_chat_flow_workspaceId: `CREATE INDEX "idx_chat_flow_workspaceId" ON public.chat_flow USING btree ("workspaceId")`

### public.chat_message

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| role | character varying | NO |  | |
| chatflowid | uuid | NO |  | |
| executionId | character varying | YES |  | |
| content | text | YES |  | |
| sourceDocuments | text | YES |  | |
| usedTools | text | YES |  | |
| fileAnnotations | text | YES |  | |
| agentReasoning | text | YES |  | |
| fileUploads | text | YES |  | |
| artifacts | text | YES |  | |
| action | text | YES |  | |
| chatType | character varying | YES |  | |
| chatId | character varying | NO |  | |
| memoryType | character varying | YES |  | |
| sessionId | character varying | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| leadEmail | character varying | YES |  | |
| followUpPrompts | text | YES |  | |

#### Indexes
- IDX_chat_message_chatflowid: `CREATE INDEX "IDX_chat_message_chatflowid" ON public.chat_message USING btree (chatflowid)`
- IDX_e574527322272fd838f4f0f3d3: `CREATE INDEX "IDX_e574527322272fd838f4f0f3d3" ON public.chat_message USING btree (chatflowid)`
- IDX_f56c36fe42894d57e5c664d229: `CREATE INDEX "IDX_f56c36fe42894d57e5c664d229" ON public.chat_message USING btree (chatflowid)`
- PK_chat_message: `CREATE UNIQUE INDEX "PK_chat_message" ON public.chat_message USING btree (id)`

### public.chat_message_feedback

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| chatflowid | uuid | NO |  | |
| content | text | YES |  | |
| chatId | character varying | NO |  | |
| messageId | uuid | NO |  | |
| rating | character varying | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |

#### Indexes
- IDX_9acddcb7a2b51fe37669049fc6: `CREATE INDEX "IDX_9acddcb7a2b51fe37669049fc6" ON public.chat_message_feedback USING btree ("chatId")`
- IDX_f56c36fe42894d57e5c664d230: `CREATE INDEX "IDX_f56c36fe42894d57e5c664d230" ON public.chat_message_feedback USING btree (chatflowid)`
- PK_98419043dd704f54-9830ab78f9: `CREATE UNIQUE INDEX "PK_98419043dd704f54-9830ab78f9" ON public.chat_message_feedback USING btree (id)`
- UQ_6352078b5a294f2d22179ea7956: `CREATE UNIQUE INDEX "UQ_6352078b5a294f2d22179ea7956" ON public.chat_message_feedback USING btree ("messageId")`

### public.code_agent

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` | |
| name | character varying | NO |  | |
| description | text | YES |  | |
| code | text | NO |  | |
| language | character varying(20) | NO | `'javascript'::character varying` | |
| isPublic | boolean | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | text | YES |  | |

#### Indexes
- code_agent_pkey: `CREATE UNIQUE INDEX code_agent_pkey ON public.code_agent USING btree (id)`

### public.code_agent_execution

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` | |
| codeAgentId | character varying | NO |  | |
| input | text | YES |  | |
| output | text | YES |  | |
| error | text | YES |  | |
| chatHistory | text | YES |  | |
| status | character varying(20) | NO | `'running'::character varying` | |
| startTime | timestamp without time zone | NO | `now()` | |
| endTime | timestamp without time zone | YES |  | |
| workspaceId | text | YES |  | |

#### Indexes
- code_agent_execution_pkey: `CREATE UNIQUE INDEX code_agent_execution_pkey ON public.code_agent_execution USING btree (id)`

### public.credential

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| credentialName | character varying | NO |  | |
| encryptedData | text | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_credential_workspaceId]`

#### Indexes
- PK_credential: `CREATE UNIQUE INDEX "PK_credential" ON public.credential USING btree (id)`
- idx_credential_workspaceId: `CREATE INDEX "idx_credential_workspaceId" ON public.credential USING btree ("workspaceId")`

### public.custom_template

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| flowData | text | NO |  | |
| description | character varying | YES |  | |
| badge | character varying | YES |  | |
| framework | character varying | YES |  | |
| usecases | character varying | YES |  | |
| type | character varying | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_custom_template_workspaceId]`

#### Indexes
- PK_3c7cea7d087ac4b91764574cdbf: `CREATE UNIQUE INDEX "PK_3c7cea7d087ac4b91764574cdbf" ON public.custom_template USING btree (id)`
- idx_custom_template_workspaceId: `CREATE INDEX "idx_custom_template_workspaceId" ON public.custom_template USING btree ("workspaceId")`

### public.customers

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | integer(32,0) | NO | `nextval('customers_id_seq'::regclass)` | |
| phone_number | character varying(20) | NO |  | |
| first_name | character varying(100) | YES |  | |
| last_name | character varying(100) | YES |  | |
| email | character varying(255) | YES |  | |
| default_address | text | YES |  | |
| default_payment_method | character varying(50) | YES |  | |
| previous_purchases | text | YES |  | |
| created_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |
| updated_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |

#### Indexes
- customers_phone_number_key: `CREATE UNIQUE INDEX customers_phone_number_key ON public.customers USING btree (phone_number)`
- customers_pkey: `CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)`
- idx_customers_phone: `CREATE INDEX idx_customers_phone ON public.customers USING btree (phone_number)`

### public.dataset

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| description | character varying | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_dataset_workspaceId]`

#### Indexes
- PK_98419043dd804f54-9830ab99f8: `CREATE UNIQUE INDEX "PK_98419043dd804f54-9830ab99f8" ON public.dataset USING btree (id)`
- idx_dataset_workspaceId: `CREATE INDEX "idx_dataset_workspaceId" ON public.dataset USING btree ("workspaceId")`

### public.dataset_row

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| datasetId | character varying | NO |  | |
| input | text | NO |  | |
| output | text | YES |  | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| sequence_no | integer(32,0) | YES | `'-1'::integer` | |

#### Indexes
- PK_98909027dd804f54-9840ab99f8: `CREATE UNIQUE INDEX "PK_98909027dd804f54-9840ab99f8" ON public.dataset_row USING btree (id)`

### public.document_store

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| description | character varying | YES |  | |
| loaders | text | YES |  | |
| whereUsed | text | YES |  | |
| status | character varying | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| vectorStoreConfig | text | YES |  | |
| embeddingConfig | text | YES |  | |
| recordManagerConfig | text | YES |  | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_document_store_workspaceId]`

#### Indexes
- PK_98495043dd774f54-9830ab78f9: `CREATE UNIQUE INDEX "PK_98495043dd774f54-9830ab78f9" ON public.document_store USING btree (id)`
- idx_document_store_workspaceId: `CREATE INDEX "idx_document_store_workspaceId" ON public.document_store USING btree ("workspaceId")`

### public.document_store_file_chunk

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| docId | uuid | NO |  | |
| chunkNo | integer(32,0) | NO |  | |
| storeId | uuid | NO |  | |
| pageContent | text | YES |  | |
| metadata | text | YES |  | |

#### Indexes
- IDX_e213b811b01405a42309a6a410: `CREATE INDEX "IDX_e213b811b01405a42309a6a410" ON public.document_store_file_chunk USING btree ("storeId")`
- IDX_e76bae1780b77e56aab1h2asd4: `CREATE INDEX "IDX_e76bae1780b77e56aab1h2asd4" ON public.document_store_file_chunk USING btree ("docId")`
- PK_90005043dd774f54-9830ab78f9: `CREATE UNIQUE INDEX "PK_90005043dd774f54-9830ab78f9" ON public.document_store_file_chunk USING btree (id)`

### public.evaluation

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| chatflowId | text | NO |  | |
| chatflowName | text | NO |  | |
| datasetId | character varying | NO |  | |
| datasetName | character varying | NO |  | |
| additionalConfig | text | YES |  | |
| evaluationType | character varying | NO |  | |
| status | character varying | NO |  | |
| average_metrics | text | YES |  | |
| runDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_evaluation_workspaceId]`

#### Indexes
- PK_98989043dd804f54-9830ab99f8: `CREATE UNIQUE INDEX "PK_98989043dd804f54-9830ab99f8" ON public.evaluation USING btree (id)`
- idx_evaluation_workspaceId: `CREATE INDEX "idx_evaluation_workspaceId" ON public.evaluation USING btree ("workspaceId")`

### public.evaluation_run

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| evaluationId | character varying | NO |  | |
| input | text | NO |  | |
| expectedOutput | text | YES |  | |
| actualOutput | text | YES |  | |
| evaluators | text | YES |  | |
| llmEvaluators | text | YES |  | |
| metrics | text | YES |  | |
| runDate | timestamp without time zone | NO | `now()` | |
| errors | text | YES | `'[]'::text` | |

#### Indexes
- PK_98989927dd804f54-9840ab23f8: `CREATE UNIQUE INDEX "PK_98989927dd804f54-9840ab23f8" ON public.evaluation_run USING btree (id)`

### public.evaluator

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| type | text | YES |  | |
| config | text | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_evaluator_workspaceId]`

#### Indexes
- PK_90019043dd804f54-9830ab11f8: `CREATE UNIQUE INDEX "PK_90019043dd804f54-9830ab11f8" ON public.evaluator USING btree (id)`
- idx_evaluator_workspaceId: `CREATE INDEX "idx_evaluator_workspaceId" ON public.evaluator USING btree ("workspaceId")`

### public.execution

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| executionData | text | NO |  | |
| action | text | YES |  | |
| state | character varying | NO |  | |
| agentflowId | uuid | NO |  | |
| sessionId | character varying | NO |  | |
| isPublic | boolean | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| stoppedDate | timestamp without time zone | YES |  | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_execution_workspaceId]`

#### Indexes
- PK_936a419c3b8044598d72d95da61: `CREATE UNIQUE INDEX "PK_936a419c3b8044598d72d95da61" ON public.execution USING btree (id)`
- idx_execution_workspaceId: `CREATE INDEX "idx_execution_workspaceId" ON public.execution USING btree ("workspaceId")`

### public.follow_ups

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | integer(32,0) | NO | `nextval('follow_ups_id_seq'::regclass)` | |
| customer_id | integer(32,0) | YES |  | |
| phone_number | character varying(20) | NO |  | |
| sale_id | integer(32,0) | YES |  | |
| follow_up_type | character varying(50) | NO |  | |
| scheduled_at | timestamp without time zone | NO |  | |
| completed_at | timestamp without time zone | YES |  | |
| status | character varying(20) | YES | `'pending'::character varying` | |
| attempt_number | integer(32,0) | YES | `1` | |
| max_attempts | integer(32,0) | YES | `3` | |
| message_sent | text | YES |  | |
| customer_response | text | YES |  | |
| next_action | character varying(100) | YES |  | |
| created_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |
| updated_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |

#### Foreign Keys
- sale_id → public.sales(id) `[follow_ups_sale_id_fkey]`
- customer_id → public.customers(id) `[follow_ups_customer_id_fkey]`

#### Indexes
- follow_ups_pkey: `CREATE UNIQUE INDEX follow_ups_pkey ON public.follow_ups USING btree (id)`
- idx_followups_customer_id: `CREATE INDEX idx_followups_customer_id ON public.follow_ups USING btree (customer_id)`
- idx_followups_scheduled: `CREATE INDEX idx_followups_scheduled ON public.follow_ups USING btree (scheduled_at)`
- idx_followups_status: `CREATE INDEX idx_followups_status ON public.follow_ups USING btree (status)`

### public.lead

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| chatflowid | character varying | NO |  | |
| chatId | character varying | NO |  | |
| name | text | YES |  | |
| email | text | YES |  | |
| phone | text | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |

#### Indexes
- PK_98419043dd704f54-9830ab78f0: `CREATE UNIQUE INDEX "PK_98419043dd704f54-9830ab78f0" ON public.lead USING btree (id)`

### public.login_activity

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| username | character varying | NO |  | |
| activity_code | integer(32,0) | NO |  | |
| message | character varying | NO |  | |
| attemptedDateTime | timestamp without time zone | NO | `now()` | |
| login_mode | character varying | YES |  | |

#### Indexes
- PK_login_activity: `CREATE UNIQUE INDEX "PK_login_activity" ON public.login_activity USING btree (id)`

### public.login_method

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| organizationId | uuid | YES |  | |
| name | character varying(100) | NO |  | |
| config | text | NO |  | |
| status | character varying(20) | NO | `'ENABLE'::character varying` | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | YES |  | |
| updatedBy | uuid | YES |  | |

#### Foreign Keys
- createdBy → public.user(id) `[FK_login_method_createdBy]`
- updatedBy → public.user(id) `[FK_login_method_updatedBy]`
- organizationId → public.organization(id) `[FK_login_method_organizationId]`

#### Indexes
- IDX_login_method_organizationId: `CREATE INDEX "IDX_login_method_organizationId" ON public.login_method USING btree ("organizationId")`
- PK_login_method: `CREATE UNIQUE INDEX "PK_login_method" ON public.login_method USING btree (id)`

### public.login_sessions

- Type: BASE TABLE
- Primary Key: sid

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| sid | character varying | NO |  | |
| sess | json | NO |  | |
| expire | timestamp without time zone | NO |  | |

#### Indexes
- IDX_session_expire: `CREATE INDEX "IDX_session_expire" ON public.login_sessions USING btree (expire)`
- session_pkey: `CREATE UNIQUE INDEX session_pkey ON public.login_sessions USING btree (sid)`

### public.migrations

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | integer(32,0) | NO | `nextval('migrations_id_seq'::regclass)` | |
| timestamp | bigint(64,0) | NO |  | |
| name | character varying | NO |  | |

#### Indexes
- PK_8c82d7f526340ab734260ea46be: `CREATE UNIQUE INDEX "PK_8c82d7f526340ab734260ea46be" ON public.migrations USING btree (id)`

### public.organization

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying(100) | NO | `'Default Organization'::character varying` | |
| customerId | character varying(100) | YES |  | |
| subscriptionId | character varying(100) | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | YES |  | |
| updatedBy | uuid | YES |  | |
| sso_config | text | YES |  | |

#### Foreign Keys
- createdBy → public.user(id) `[FK_organization_createdBy]`
- updatedBy → public.user(id) `[FK_organization_updatedBy]`

#### Indexes
- PK_organization: `CREATE UNIQUE INDEX "PK_organization" ON public.organization USING btree (id)`

### public.organization_user

- Type: BASE TABLE
- Primary Key: organizationId, userId

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| organizationId | uuid | NO |  | |
| userId | uuid | NO |  | |
| roleId | uuid | NO |  | |
| status | character varying(20) | NO | `'ACTIVE'::character varying` | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | NO |  | |
| updatedBy | uuid | NO |  | |

#### Foreign Keys
- createdBy → public.user(id) `[FK_organization_user_createdBy]`
- organizationId → public.organization(id) `[FK_organization_user_organizationId]`
- roleId → public.role(id) `[FK_organization_user_roleId]`
- updatedBy → public.user(id) `[FK_organization_user_updatedBy]`
- userId → public.user(id) `[FK_organization_user_userId]`

#### Indexes
- IDX_organization_user_organizationId: `CREATE INDEX "IDX_organization_user_organizationId" ON public.organization_user USING btree ("organizationId")`
- IDX_organization_user_userId: `CREATE INDEX "IDX_organization_user_userId" ON public.organization_user USING btree ("userId")`
- PK_organization_user: `CREATE UNIQUE INDEX "PK_organization_user" ON public.organization_user USING btree ("organizationId", "userId")`

### public.role

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| organizationId | uuid | YES |  | |
| name | character varying(100) | NO |  | |
| description | text | YES |  | |
| permissions | text | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | YES |  | |
| updatedBy | uuid | YES |  | |

#### Foreign Keys
- createdBy → public.user(id) `[FK_role_createdBy]`
- updatedBy → public.user(id) `[FK_role_updatedBy]`
- organizationId → public.organization(id) `[FK_role_organizationId]`

#### Indexes
- IDX_role_organizationId: `CREATE INDEX "IDX_role_organizationId" ON public.role USING btree ("organizationId")`
- PK_role: `CREATE UNIQUE INDEX "PK_role" ON public.role USING btree (id)`

### public.roles

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | YES |  | |
| description | character varying | YES |  | |
| permissions | text | YES |  | |

#### Indexes
- PK_98488643dd3554f54-9830ab78f9: `CREATE UNIQUE INDEX "PK_98488643dd3554f54-9830ab78f9" ON public.roles USING btree (id)`

### public.sales

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | integer(32,0) | NO | `nextval('sales_id_seq'::regclass)` | |
| customer_id | integer(32,0) | YES |  | |
| phone_number | character varying(20) | NO |  | |
| product_sku | character varying(100) | NO |  | |
| product_brand | character varying(100) | YES |  | |
| product_model | character varying(100) | YES |  | |
| wheel_size | character varying(50) | YES |  | |
| quantity | integer(32,0) | YES | `1` | |
| unit_price | numeric(10,2) | YES |  | |
| total_price | numeric(10,2) | YES |  | |
| discount_percentage | numeric(5,2) | YES | `0` | |
| final_price | numeric(10,2) | YES |  | |
| payment_method | character varying(50) | YES |  | |
| delivery_method | character varying(50) | YES |  | |
| delivery_address | text | YES |  | |
| sale_status | character varying(20) | YES | `'pending'::character varying` | |
| negotiation_attempts | integer(32,0) | YES | `0` | |
| agent_notes | text | YES |  | |
| created_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |
| updated_at | timestamp without time zone | YES | `CURRENT_TIMESTAMP` | |

#### Foreign Keys
- customer_id → public.customers(id) `[sales_customer_id_fkey]`

#### Indexes
- idx_sales_customer_id: `CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id)`
- idx_sales_phone: `CREATE INDEX idx_sales_phone ON public.sales USING btree (phone_number)`
- idx_sales_status: `CREATE INDEX idx_sales_status ON public.sales USING btree (sale_status)`
- sales_pkey: `CREATE UNIQUE INDEX sales_pkey ON public.sales USING btree (id)`

### public.tool

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| description | text | YES |  | |
| color | character varying | YES |  | |
| iconSrc | character varying | YES |  | |
| schema | text | YES |  | |
| func | text | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_tool_workspaceId]`

#### Indexes
- PK_tool: `CREATE UNIQUE INDEX "PK_tool" ON public.tool USING btree (id)`
- idx_tool_workspaceId: `CREATE INDEX "idx_tool_workspaceId" ON public.tool USING btree ("workspaceId")`

### public.upsert_history

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| chatflowid | character varying | NO |  | |
| result | text | NO |  | |
| flowData | text | NO |  | |
| date | timestamp without time zone | NO | `now()` | |

#### Indexes
- PK_37327b22b6e246319bd5eeb0e88: `CREATE UNIQUE INDEX "PK_37327b22b6e246319bd5eeb0e88" ON public.upsert_history USING btree (id)`

### public.upsertion_records

- Type: BASE TABLE
- Primary Key: uuid

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| uuid | uuid | NO | `gen_random_uuid()` | |
| key | text | NO |  | |
| namespace | text | NO |  | |
| updated_at | double precision(53) | NO |  | |
| group_id | text | YES |  | |

#### Indexes
- group_id_index: `CREATE INDEX group_id_index ON public.upsertion_records USING btree (group_id)`
- key_index: `CREATE INDEX key_index ON public.upsertion_records USING btree (key)`
- namespace_index: `CREATE INDEX namespace_index ON public.upsertion_records USING btree (namespace)`
- updated_at_index: `CREATE INDEX updated_at_index ON public.upsertion_records USING btree (updated_at)`
- upsertion_records_key_namespace_key: `CREATE UNIQUE INDEX upsertion_records_key_namespace_key ON public.upsertion_records USING btree (key, namespace)`
- upsertion_records_pkey: `CREATE UNIQUE INDEX upsertion_records_pkey ON public.upsertion_records USING btree (uuid)`

### public.user

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying(100) | NO |  | |
| email | character varying(255) | NO |  | |
| credential | text | YES |  | |
| tempToken | text | YES |  | |
| tokenExpiry | timestamp without time zone | YES |  | |
| status | character varying(20) | NO | `'UNVERIFIED'::character varying` | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | YES |  | |
| updatedBy | uuid | YES |  | |
| activeWorkspaceId | uuid | YES |  | |
| user_type | character varying | YES |  | |

#### Foreign Keys
- updatedBy → public.user(id) `[FK_user_updatedBy]`
- activeWorkspaceId → public.workspace(id) `[fk_user_activeWorkspaceId]`
- createdBy → public.user(id) `[FK_user_createdBy]`

#### Indexes
- IDX_user_email: `CREATE INDEX "IDX_user_email" ON public."user" USING btree (email)`
- IDX_user_status: `CREATE INDEX "IDX_user_status" ON public."user" USING btree (status)`
- PK_user: `CREATE UNIQUE INDEX "PK_user" ON public."user" USING btree (id)`
- idx_user_activeWorkspaceId: `CREATE INDEX "idx_user_activeWorkspaceId" ON public."user" USING btree ("activeWorkspaceId")`
- user_email_key: `CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email)`

### public.variable

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying | NO |  | |
| value | text | NO |  | |
| type | text | YES |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| workspaceId | uuid | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_variable_workspaceId]`

#### Indexes
- PK_98419043dd704f54-9830ab78f8: `CREATE UNIQUE INDEX "PK_98419043dd704f54-9830ab78f8" ON public.variable USING btree (id)`
- idx_variable_workspaceId: `CREATE INDEX "idx_variable_workspaceId" ON public.variable USING btree ("workspaceId")`

### public.workspace

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| name | character varying(100) | NO | `'Default Workspace'::character varying` | |
| description | text | YES |  | |
| organizationId | uuid | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | YES |  | |
| updatedBy | uuid | YES |  | |

#### Foreign Keys
- createdBy → public.user(id) `[FK_workspace_createdBy]`
- updatedBy → public.user(id) `[FK_workspace_updatedBy]`
- organizationId → public.organization(id) `[FK_workspace_organizationId]`
- organizationId → public.organization(id) `[fk_workspace_organizationId]`

#### Indexes
- IDX_workspace_organizationId: `CREATE INDEX "IDX_workspace_organizationId" ON public.workspace USING btree ("organizationId")`
- PK_workspace: `CREATE UNIQUE INDEX "PK_workspace" ON public.workspace USING btree (id)`
- idx_workspace_organizationId: `CREATE INDEX "idx_workspace_organizationId" ON public.workspace USING btree ("organizationId")`

### public.workspace_shared

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| workspaceId | uuid | NO |  | |
| sharedItemId | character varying | NO |  | |
| itemType | character varying | NO |  | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_workspace_shared_workspaceId]`

#### Indexes
- PK_90016043dd804f55-9830ab97f8: `CREATE UNIQUE INDEX "PK_90016043dd804f55-9830ab97f8" ON public.workspace_shared USING btree (id)`
- idx_workspace_shared_workspaceId: `CREATE INDEX "idx_workspace_shared_workspaceId" ON public.workspace_shared USING btree ("workspaceId")`

### public.workspace_user

- Type: BASE TABLE
- Primary Key: workspaceId, userId

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| workspaceId | uuid | NO |  | |
| userId | uuid | NO |  | |
| roleId | uuid | NO |  | |
| status | character varying(20) | NO | `'ACTIVE'::character varying` | |
| createdDate | timestamp without time zone | NO | `now()` | |
| updatedDate | timestamp without time zone | NO | `now()` | |
| createdBy | uuid | NO |  | |
| updatedBy | uuid | NO |  | |

#### Foreign Keys
- updatedBy → public.user(id) `[FK_workspace_user_updatedBy]`
- createdBy → public.user(id) `[FK_workspace_user_createdBy]`
- workspaceId → public.workspace(id) `[FK_workspace_user_workspaceId]`
- roleId → public.role(id) `[FK_workspace_user_roleId]`
- userId → public.user(id) `[FK_workspace_user_userId]`

#### Indexes
- IDX_workspace_user_userId: `CREATE INDEX "IDX_workspace_user_userId" ON public.workspace_user USING btree ("userId")`
- IDX_workspace_user_workspaceId: `CREATE INDEX "IDX_workspace_user_workspaceId" ON public.workspace_user USING btree ("workspaceId")`
- PK_workspace_user: `CREATE UNIQUE INDEX "PK_workspace_user" ON public.workspace_user USING btree ("workspaceId", "userId")`

### public.workspace_users

- Type: BASE TABLE
- Primary Key: id

#### Columns
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | |
| workspaceId | uuid | NO |  | |
| userId | character varying | NO |  | |
| role | character varying | YES |  | |

#### Foreign Keys
- workspaceId → public.workspace(id) `[fk_workspace_users_workspaceId]`

#### Indexes
- PK_98718943dd804f55-9830ab99f8: `CREATE UNIQUE INDEX "PK_98718943dd804f55-9830ab99f8" ON public.workspace_users USING btree (id)`
- idx_workspace_users_workspaceId: `CREATE INDEX "idx_workspace_users_workspaceId" ON public.workspace_users USING btree ("workspaceId")`


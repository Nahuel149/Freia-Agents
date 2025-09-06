--
-- PostgreSQL database dump
--

\restrict vdX1eAzqn3JQfqHF4VPpGecn2QpEjp1XtYAAousrrvUOjhhJB3dMcCbfxHdz710

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_key; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_key (
    id character varying NOT NULL,
    "apiKey" character varying NOT NULL,
    "apiSecret" character varying NOT NULL,
    "keyName" character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" character varying
);


ALTER TABLE public.api_key OWNER TO postgres;

--
-- Name: apikey; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.apikey (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "apiKey" character varying NOT NULL,
    "apiSecret" character varying NOT NULL,
    "keyName" character varying NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.apikey OWNER TO postgres;

--
-- Name: assistant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assistant (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    credential uuid NOT NULL,
    details text NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid,
    type text
);


ALTER TABLE public.assistant OWNER TO postgres;

--
-- Name: chat_flow; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_flow (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "flowData" text,
    deployed boolean,
    "isPublic" boolean,
    apikeyid character varying,
    "chatbotConfig" text,
    "apiConfig" text,
    analytic text,
    "speechToText" text,
    "followUpPrompts" text,
    category character varying,
    type character varying(20) DEFAULT 'CHATFLOW'::character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.chat_flow OWNER TO postgres;

--
-- Name: chat_message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_message (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role character varying NOT NULL,
    chatflowid uuid NOT NULL,
    "executionId" character varying,
    content text,
    "sourceDocuments" text,
    "usedTools" text,
    "fileAnnotations" text,
    "agentReasoning" text,
    "fileUploads" text,
    artifacts text,
    action text,
    "chatType" character varying,
    "chatId" character varying NOT NULL,
    "memoryType" character varying,
    "sessionId" character varying,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "leadEmail" character varying,
    "followUpPrompts" text
);


ALTER TABLE public.chat_message OWNER TO postgres;

--
-- Name: chat_message_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_message_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chatflowid uuid NOT NULL,
    content text,
    "chatId" character varying NOT NULL,
    "messageId" uuid NOT NULL,
    rating character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_message_feedback OWNER TO postgres;

--
-- Name: credential; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credential (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "credentialName" character varying NOT NULL,
    "encryptedData" text,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.credential OWNER TO postgres;

--
-- Name: custom_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_template (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "flowData" text NOT NULL,
    description character varying,
    badge character varying,
    framework character varying,
    usecases character varying,
    type character varying,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.custom_template OWNER TO postgres;

--
-- Name: dataset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataset (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.dataset OWNER TO postgres;

--
-- Name: dataset_row; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataset_row (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "datasetId" character varying NOT NULL,
    input text NOT NULL,
    output text,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    sequence_no integer DEFAULT '-1'::integer
);


ALTER TABLE public.dataset_row OWNER TO postgres;

--
-- Name: document_store; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_store (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    loaders text,
    "whereUsed" text,
    status character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "vectorStoreConfig" text,
    "embeddingConfig" text,
    "recordManagerConfig" text,
    "workspaceId" uuid
);


ALTER TABLE public.document_store OWNER TO postgres;

--
-- Name: document_store_file_chunk; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_store_file_chunk (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "docId" uuid NOT NULL,
    "chunkNo" integer NOT NULL,
    "storeId" uuid NOT NULL,
    "pageContent" text,
    metadata text
);


ALTER TABLE public.document_store_file_chunk OWNER TO postgres;

--
-- Name: evaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "chatflowId" text NOT NULL,
    "chatflowName" text NOT NULL,
    "datasetId" character varying NOT NULL,
    "datasetName" character varying NOT NULL,
    "additionalConfig" text,
    "evaluationType" character varying NOT NULL,
    status character varying NOT NULL,
    average_metrics text,
    "runDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.evaluation OWNER TO postgres;

--
-- Name: evaluation_run; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_run (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "evaluationId" character varying NOT NULL,
    input text NOT NULL,
    "expectedOutput" text,
    "actualOutput" text,
    evaluators text,
    "llmEvaluators" text,
    metrics text,
    "runDate" timestamp without time zone DEFAULT now() NOT NULL,
    errors text DEFAULT '[]'::text
);


ALTER TABLE public.evaluation_run OWNER TO postgres;

--
-- Name: evaluator; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluator (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    type text,
    config text,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.evaluator OWNER TO postgres;

--
-- Name: execution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "executionData" text NOT NULL,
    action text,
    state character varying NOT NULL,
    "agentflowId" uuid NOT NULL,
    "sessionId" character varying NOT NULL,
    "isPublic" boolean,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "stoppedDate" timestamp without time zone,
    "workspaceId" uuid
);


ALTER TABLE public.execution OWNER TO postgres;

--
-- Name: lead; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chatflowid character varying NOT NULL,
    "chatId" character varying NOT NULL,
    name text,
    email text,
    phone text,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead OWNER TO postgres;

--
-- Name: login_activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_activity (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying NOT NULL,
    activity_code integer NOT NULL,
    message character varying NOT NULL,
    "attemptedDateTime" timestamp without time zone DEFAULT now() NOT NULL,
    login_mode character varying
);


ALTER TABLE public.login_activity OWNER TO postgres;

--
-- Name: login_method; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_method (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "organizationId" uuid,
    name character varying(100) NOT NULL,
    config text NOT NULL,
    status character varying(20) DEFAULT 'ENABLE'::character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid
);


ALTER TABLE public.login_method OWNER TO postgres;

--
-- Name: login_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.login_sessions OWNER TO postgres;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) DEFAULT 'Default Organization'::character varying NOT NULL,
    "customerId" character varying(100),
    "subscriptionId" character varying(100),
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid,
    sso_config text
);


ALTER TABLE public.organization OWNER TO postgres;

--
-- Name: organization_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_user (
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedBy" uuid NOT NULL
);


ALTER TABLE public.organization_user OWNER TO postgres;

--
-- Name: role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "organizationId" uuid,
    name character varying(100) NOT NULL,
    description text,
    permissions text NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid
);


ALTER TABLE public.role OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying,
    description character varying,
    permissions text
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: tool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    color character varying,
    "iconSrc" character varying,
    schema text,
    func text,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.tool OWNER TO postgres;

--
-- Name: upsert_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.upsert_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chatflowid character varying NOT NULL,
    result text NOT NULL,
    "flowData" text NOT NULL,
    date timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.upsert_history OWNER TO postgres;

--
-- Name: upsertion_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.upsertion_records (
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    namespace text NOT NULL,
    updated_at double precision NOT NULL,
    group_id text
);


ALTER TABLE public.upsertion_records OWNER TO postgres;

--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    credential text,
    "tempToken" text,
    "tokenExpiry" timestamp without time zone,
    status character varying(20) DEFAULT 'UNVERIFIED'::character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid,
    "activeWorkspaceId" uuid,
    user_type character varying
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: variable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variable (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    value text NOT NULL,
    type text,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "workspaceId" uuid
);


ALTER TABLE public.variable OWNER TO postgres;

--
-- Name: workspace; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) DEFAULT 'Default Workspace'::character varying NOT NULL,
    description text,
    "organizationId" uuid NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid,
    "updatedBy" uuid
);


ALTER TABLE public.workspace OWNER TO postgres;

--
-- Name: workspace_shared; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_shared (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "workspaceId" uuid NOT NULL,
    "sharedItemId" character varying NOT NULL,
    "itemType" character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_shared OWNER TO postgres;

--
-- Name: workspace_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_user (
    "workspaceId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "createdDate" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedDate" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedBy" uuid NOT NULL
);


ALTER TABLE public.workspace_user OWNER TO postgres;

--
-- Name: workspace_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "workspaceId" uuid NOT NULL,
    "userId" character varying NOT NULL,
    role character varying
);


ALTER TABLE public.workspace_users OWNER TO postgres;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: api_key; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.api_key (id, "apiKey", "apiSecret", "keyName", "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: apikey; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.apikey (id, "apiKey", "apiSecret", "keyName", "updatedDate", "workspaceId") FROM stdin;
9748daba-f834-4a68-a3fa-fae14e753ffd	Iz7ZU2uFf-7hz4_AuosC1bkht68G5zdZ4wgZQhnBfZI	10399d742c635d9f0c0eef41a272c2d6a39acff8db924e8a73da7e308d6815a5a24f097c2f48f3d30508657f4c9fe22bad5b6a861287ef3f7f374985080822c4.bf024043135cb985	DefaultKey	2025-09-06 19:15:04.316307	\N
\.


--
-- Data for Name: assistant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assistant (id, credential, details, "createdDate", "updatedDate", "workspaceId", type) FROM stdin;
\.


--
-- Data for Name: chat_flow; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_flow (id, name, "flowData", deployed, "isPublic", apikeyid, "chatbotConfig", "apiConfig", analytic, "speechToText", "followUpPrompts", category, type, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: chat_message; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_message (id, role, chatflowid, "executionId", content, "sourceDocuments", "usedTools", "fileAnnotations", "agentReasoning", "fileUploads", artifacts, action, "chatType", "chatId", "memoryType", "sessionId", "createdDate", "leadEmail", "followUpPrompts") FROM stdin;
\.


--
-- Data for Name: chat_message_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_message_feedback (id, chatflowid, content, "chatId", "messageId", rating, "createdDate") FROM stdin;
\.


--
-- Data for Name: credential; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credential (id, name, "credentialName", "encryptedData", "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: custom_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_template (id, name, "flowData", description, badge, framework, usecases, type, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: dataset; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dataset (id, name, description, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: dataset_row; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dataset_row (id, "datasetId", input, output, "updatedDate", sequence_no) FROM stdin;
\.


--
-- Data for Name: document_store; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_store (id, name, description, loaders, "whereUsed", status, "createdDate", "updatedDate", "vectorStoreConfig", "embeddingConfig", "recordManagerConfig", "workspaceId") FROM stdin;
\.


--
-- Data for Name: document_store_file_chunk; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_store_file_chunk (id, "docId", "chunkNo", "storeId", "pageContent", metadata) FROM stdin;
\.


--
-- Data for Name: evaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluation (id, name, "chatflowId", "chatflowName", "datasetId", "datasetName", "additionalConfig", "evaluationType", status, average_metrics, "runDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: evaluation_run; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluation_run (id, "evaluationId", input, "expectedOutput", "actualOutput", evaluators, "llmEvaluators", metrics, "runDate", errors) FROM stdin;
\.


--
-- Data for Name: evaluator; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluator (id, name, type, config, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: execution; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.execution (id, "executionData", action, state, "agentflowId", "sessionId", "isPublic", "createdDate", "updatedDate", "stoppedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: lead; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead (id, chatflowid, "chatId", name, email, phone, "createdDate") FROM stdin;
\.


--
-- Data for Name: login_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_activity (id, username, activity_code, message, "attemptedDateTime", login_mode) FROM stdin;
\.


--
-- Data for Name: login_method; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_method (id, "organizationId", name, config, status, "createdDate", "updatedDate", "createdBy", "updatedBy") FROM stdin;
\.


--
-- Data for Name: login_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1693891895163	Init1693891895163
2	1693995626941	ModifyChatFlow1693995626941
3	1693996694528	ModifyChatMessage1693996694528
4	1693997070000	ModifyCredential1693997070000
5	1693997339912	ModifyTool1693997339912
6	1694099183389	AddApiConfig1694099183389
7	1694432361423	AddAnalytic1694432361423
8	1694658756136	AddChatHistory1694658756136
9	1699325775451	AddAssistantEntity1699325775451
10	1699325775451	AddVariableEntity1699325775451
11	1699481607341	AddUsedToolsToChatMessage1699481607341
12	1699900910291	AddCategoryToChatFlow1699900910291
13	1700271021237	AddFileAnnotationsToChatMessage1700271021237
14	1701788586491	AddFileUploadsToChatMessage1701788586491
15	1706364937060	AddSpeechToText1706364937060
16	1707213601923	AddFeedback1707213601923
17	1709814301358	AddUpsertHistoryEntity1709814301358
18	1710497452584	FieldTypes1710497452584
19	1710832137905	AddLead1710832137905
20	1711538016098	AddLeadToChatMessage1711538016098
21	1711637331047	AddDocumentStore1711637331047
22	1714548873039	AddEvaluation1714548873039
23	1714548903384	AddDatasets1714548903384
24	1714679514451	AddAgentReasoningToChatMessage1714679514451
25	1714808591644	AddEvaluator1714808591644
26	1715861032479	AddVectorStoreConfigToDocStore1715861032479
27	1716300000000	AddTypeToChatFlow1716300000000
28	1720230151480	AddApiKey1720230151480
29	1720230151482	AddAuthTables1720230151482
30	1720230151484	AddWorkspace1720230151484
31	1721078251523	AddActionToChatMessage1721078251523
32	1725629836652	AddCustomTemplate1725629836652
33	1726156258465	AddArtifactsToChatMessage1726156258465
34	1726654922034	AddWorkspaceShared1726654922034
35	1726655750383	AddWorkspaceIdToCustomTemplate1726655750383
36	1726666309552	AddFollowUpPrompts1726666309552
37	1727798417345	AddOrganization1727798417345
38	1729130948686	LinkWorkspaceId1729130948686
39	1729133111652	LinkOrganizationId1729133111652
40	1730519457880	AddSSOColumns1730519457880
41	1733011290987	AddTypeToAssistant1733011290987
42	1733752119696	AddSeqNoToDatasetRow1733752119696
43	1734074497540	AddPersonalWorkspace1734074497540
44	1738090872625	AddExecutionEntity1738090872625
45	1743758056188	FixOpenSourceAssistantTable1743758056188
46	1744964560174	AddErrorToEvaluationRun1744964560174
47	1746862866554	ExecutionLinkWorkspaceId1746862866554
48	1748450230238	ModifyExecutionSessionIdFieldType1748450230238
49	1755066758601	ModifyChatflowType1755066758601
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization (id, name, "customerId", "subscriptionId", "createdDate", "updatedDate", "createdBy", "updatedBy", sso_config) FROM stdin;
e29fdbd4-0171-4769-90f1-e5509a59ca42	Default Organization	\N	\N	2025-09-05 01:58:18.196924	2025-09-05 01:58:18.196924	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5dca2f58-4478-48b6-ba5a-0077f4a3b580	\N
764e53f3-e1b6-4268-b639-4de4bf7da294	Default Organization	\N	\N	2025-09-05 04:15:01.976622	2025-09-05 04:15:01.976622	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c	\N
a944cbfd-f5a3-4b14-8c59-bc1a842a5b49	Default Organization	\N	\N	2025-09-05 05:02:04.755262	2025-09-05 05:02:04.755262	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c	\N
8bed2502-3461-49af-bc3a-839c5591a2dd	Default Organization	\N	\N	2025-09-05 10:22:12.293958	2025-09-05 10:22:12.293958	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c	\N
\.


--
-- Data for Name: organization_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_user ("organizationId", "userId", "roleId", status, "createdDate", "updatedDate", "createdBy", "updatedBy") FROM stdin;
e29fdbd4-0171-4769-90f1-e5509a59ca42	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5a43debe-9cce-4434-a35d-c2c0e7c6bec2	ACTIVE	2025-09-05 01:58:18.215624	2025-09-05 01:58:18.215624	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5dca2f58-4478-48b6-ba5a-0077f4a3b580
764e53f3-e1b6-4268-b639-4de4bf7da294	73c398f7-4af7-4890-80d1-1794984fa76c	0977cab8-0e62-4281-89a4-40c905456b46	ACTIVE	2025-09-05 04:15:01.986492	2025-09-05 04:15:01.986492	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
a944cbfd-f5a3-4b14-8c59-bc1a842a5b49	73c398f7-4af7-4890-80d1-1794984fa76c	ce8cc6aa-ce48-42f3-95f9-97e53f5c5b16	ACTIVE	2025-09-05 05:02:04.774425	2025-09-05 05:02:04.774425	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
8bed2502-3461-49af-bc3a-839c5591a2dd	73c398f7-4af7-4890-80d1-1794984fa76c	54ba4c76-ee40-4236-bb46-a995dd668838	ACTIVE	2025-09-05 10:22:12.326246	2025-09-05 10:22:12.326246	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role (id, "organizationId", name, description, permissions, "createdDate", "updatedDate", "createdBy", "updatedBy") FROM stdin;
5a43debe-9cce-4434-a35d-c2c0e7c6bec2	e29fdbd4-0171-4769-90f1-e5509a59ca42	Admin	Administrator role with full permissions	["read", "write", "delete", "admin"]	2025-09-05 01:58:18.201927	2025-09-05 01:58:18.201927	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5dca2f58-4478-48b6-ba5a-0077f4a3b580
0977cab8-0e62-4281-89a4-40c905456b46	764e53f3-e1b6-4268-b639-4de4bf7da294	Admin	Administrator role	["read", "write", "delete", "admin"]	2025-09-05 04:15:01.979921	2025-09-05 04:15:01.979921	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
ce8cc6aa-ce48-42f3-95f9-97e53f5c5b16	a944cbfd-f5a3-4b14-8c59-bc1a842a5b49	Admin	Administrator role	["read", "write", "delete", "admin"]	2025-09-05 05:02:04.769536	2025-09-05 05:02:04.769536	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
54ba4c76-ee40-4236-bb46-a995dd668838	8bed2502-3461-49af-bc3a-839c5591a2dd	Admin	Administrator role	["read", "write", "delete", "admin"]	2025-09-05 10:22:12.317614	2025-09-05 10:22:12.317614	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, permissions) FROM stdin;
\.


--
-- Data for Name: tool; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tool (id, name, description, color, "iconSrc", schema, func, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: upsert_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.upsert_history (id, chatflowid, result, "flowData", date) FROM stdin;
\.


--
-- Data for Name: upsertion_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.upsertion_records (uuid, key, namespace, updated_at, group_id) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, credential, "tempToken", "tokenExpiry", status, "createdDate", "updatedDate", "createdBy", "updatedBy", "activeWorkspaceId", user_type) FROM stdin;
5dca2f58-4478-48b6-ba5a-0077f4a3b580	Admin User	admin@yourdomain.com	\N	\N	\N	ACTIVE	2025-09-05 01:58:18.178959	2025-09-05 01:58:18.178959	\N	\N	\N	\N
73c398f7-4af7-4890-80d1-1794984fa76c	Admin	admin@freia.ai	Testing123!	\N	\N	ACTIVE	2025-09-05 04:15:01.962291	2025-09-05 04:15:01.962291	\N	\N	\N	\N
\.


--
-- Data for Name: variable; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.variable (id, name, value, type, "createdDate", "updatedDate", "workspaceId") FROM stdin;
\.


--
-- Data for Name: workspace; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace (id, name, description, "organizationId", "createdDate", "updatedDate", "createdBy", "updatedBy") FROM stdin;
12fb2074-c1e6-4c52-a3b2-4dd81a8cf38d	Default Workspace	Default workspace for the organization	e29fdbd4-0171-4769-90f1-e5509a59ca42	2025-09-05 01:58:18.209744	2025-09-05 01:58:18.209744	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5dca2f58-4478-48b6-ba5a-0077f4a3b580
873e4f77-6ee0-4750-9424-c5a7629d0222	Default Workspace	Default workspace for the organization	764e53f3-e1b6-4268-b639-4de4bf7da294	2025-09-05 04:15:01.983409	2025-09-05 04:15:01.983409	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
d9542db9-2cb3-4c49-b002-4f7698370738	Default Workspace	Default workspace for the organization	a944cbfd-f5a3-4b14-8c59-bc1a842a5b49	2025-09-05 05:02:04.77222	2025-09-05 05:02:04.77222	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
99e74ba0-96de-471e-a38e-44b886c830dd	Default Workspace	Default workspace for the organization	8bed2502-3461-49af-bc3a-839c5591a2dd	2025-09-05 10:22:12.322544	2025-09-05 10:22:12.322544	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
a0484e62-ff1f-4bda-a49d-779ef00284b3	Personal Workspace	Personal Workspace of 5dca2f58-4478-48b6-ba5a-0077f4a3b580	e29fdbd4-0171-4769-90f1-e5509a59ca42	2025-09-05 10:24:08.493733	2025-09-05 10:24:08.493733	\N	\N
cf523553-31f9-437f-b9aa-ca4663c546db	Personal Workspace	Personal Workspace of 73c398f7-4af7-4890-80d1-1794984fa76c	e29fdbd4-0171-4769-90f1-e5509a59ca42	2025-09-05 10:24:08.493733	2025-09-05 10:24:08.493733	\N	\N
\.


--
-- Data for Name: workspace_shared; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_shared (id, "workspaceId", "sharedItemId", "itemType", "createdDate", "updatedDate") FROM stdin;
\.


--
-- Data for Name: workspace_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_user ("workspaceId", "userId", "roleId", status, "createdDate", "updatedDate", "createdBy", "updatedBy") FROM stdin;
12fb2074-c1e6-4c52-a3b2-4dd81a8cf38d	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5a43debe-9cce-4434-a35d-c2c0e7c6bec2	ACTIVE	2025-09-05 01:58:18.222341	2025-09-05 01:58:18.222341	5dca2f58-4478-48b6-ba5a-0077f4a3b580	5dca2f58-4478-48b6-ba5a-0077f4a3b580
873e4f77-6ee0-4750-9424-c5a7629d0222	73c398f7-4af7-4890-80d1-1794984fa76c	0977cab8-0e62-4281-89a4-40c905456b46	ACTIVE	2025-09-05 04:15:01.989701	2025-09-05 04:15:01.989701	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
d9542db9-2cb3-4c49-b002-4f7698370738	73c398f7-4af7-4890-80d1-1794984fa76c	ce8cc6aa-ce48-42f3-95f9-97e53f5c5b16	ACTIVE	2025-09-05 05:02:04.777402	2025-09-05 05:02:04.777402	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
99e74ba0-96de-471e-a38e-44b886c830dd	73c398f7-4af7-4890-80d1-1794984fa76c	54ba4c76-ee40-4236-bb46-a995dd668838	ACTIVE	2025-09-05 10:22:12.330113	2025-09-05 10:22:12.330113	73c398f7-4af7-4890-80d1-1794984fa76c	73c398f7-4af7-4890-80d1-1794984fa76c
\.


--
-- Data for Name: workspace_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_users (id, "workspaceId", "userId", role) FROM stdin;
d763730f-e1b8-4856-8e4c-fac01084242a	a0484e62-ff1f-4bda-a49d-779ef00284b3	5dca2f58-4478-48b6-ba5a-0077f4a3b580	pw
33a49992-d3cf-4e21-a98e-2634118312db	cf523553-31f9-437f-b9aa-ca4663c546db	73c398f7-4af7-4890-80d1-1794984fa76c	pw
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 49, true);


--
-- Name: upsert_history PK_37327b22b6e246319bd5eeb0e88; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.upsert_history
    ADD CONSTRAINT "PK_37327b22b6e246319bd5eeb0e88" PRIMARY KEY (id);


--
-- Name: custom_template PK_3c7cea7d087ac4b91764574cdbf; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_template
    ADD CONSTRAINT "PK_3c7cea7d087ac4b91764574cdbf" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: document_store_file_chunk PK_90005043dd774f54-9830ab78f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_store_file_chunk
    ADD CONSTRAINT "PK_90005043dd774f54-9830ab78f9" PRIMARY KEY (id);


--
-- Name: workspace_shared PK_90016043dd804f55-9830ab97f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_shared
    ADD CONSTRAINT "PK_90016043dd804f55-9830ab97f8" PRIMARY KEY (id);


--
-- Name: evaluator PK_90019043dd804f54-9830ab11f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator
    ADD CONSTRAINT "PK_90019043dd804f54-9830ab11f8" PRIMARY KEY (id);


--
-- Name: execution PK_936a419c3b8044598d72d95da61; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution
    ADD CONSTRAINT "PK_936a419c3b8044598d72d95da61" PRIMARY KEY (id);


--
-- Name: apikey PK_96109043dd704f53-9830ab78f0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT "PK_96109043dd704f53-9830ab78f0" PRIMARY KEY (id);


--
-- Name: lead PK_98419043dd704f54-9830ab78f0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT "PK_98419043dd704f54-9830ab78f0" PRIMARY KEY (id);


--
-- Name: variable PK_98419043dd704f54-9830ab78f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT "PK_98419043dd704f54-9830ab78f8" PRIMARY KEY (id);


--
-- Name: chat_message_feedback PK_98419043dd704f54-9830ab78f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message_feedback
    ADD CONSTRAINT "PK_98419043dd704f54-9830ab78f9" PRIMARY KEY (id);


--
-- Name: dataset PK_98419043dd804f54-9830ab99f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT "PK_98419043dd804f54-9830ab99f8" PRIMARY KEY (id);


--
-- Name: roles PK_98488643dd3554f54-9830ab78f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_98488643dd3554f54-9830ab78f9" PRIMARY KEY (id);


--
-- Name: document_store PK_98495043dd774f54-9830ab78f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_store
    ADD CONSTRAINT "PK_98495043dd774f54-9830ab78f9" PRIMARY KEY (id);


--
-- Name: workspace_users PK_98718943dd804f55-9830ab99f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_users
    ADD CONSTRAINT "PK_98718943dd804f55-9830ab99f8" PRIMARY KEY (id);


--
-- Name: dataset_row PK_98909027dd804f54-9840ab99f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataset_row
    ADD CONSTRAINT "PK_98909027dd804f54-9840ab99f8" PRIMARY KEY (id);


--
-- Name: evaluation PK_98989043dd804f54-9830ab99f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation
    ADD CONSTRAINT "PK_98989043dd804f54-9830ab99f8" PRIMARY KEY (id);


--
-- Name: evaluation_run PK_98989927dd804f54-9840ab23f8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_run
    ADD CONSTRAINT "PK_98989927dd804f54-9840ab23f8" PRIMARY KEY (id);


--
-- Name: api_key PK_api_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT "PK_api_key" PRIMARY KEY (id);


--
-- Name: assistant PK_assistant; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant
    ADD CONSTRAINT "PK_assistant" PRIMARY KEY (id);


--
-- Name: chat_flow PK_chat_flow; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_flow
    ADD CONSTRAINT "PK_chat_flow" PRIMARY KEY (id);


--
-- Name: chat_message PK_chat_message; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message
    ADD CONSTRAINT "PK_chat_message" PRIMARY KEY (id);


--
-- Name: credential PK_credential; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT "PK_credential" PRIMARY KEY (id);


--
-- Name: login_activity PK_login_activity; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT "PK_login_activity" PRIMARY KEY (id);


--
-- Name: login_method PK_login_method; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_method
    ADD CONSTRAINT "PK_login_method" PRIMARY KEY (id);


--
-- Name: organization PK_organization; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT "PK_organization" PRIMARY KEY (id);


--
-- Name: organization_user PK_organization_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "PK_organization_user" PRIMARY KEY ("organizationId", "userId");


--
-- Name: role PK_role; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT "PK_role" PRIMARY KEY (id);


--
-- Name: tool PK_tool; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT "PK_tool" PRIMARY KEY (id);


--
-- Name: user PK_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "PK_user" PRIMARY KEY (id);


--
-- Name: workspace PK_workspace; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT "PK_workspace" PRIMARY KEY (id);


--
-- Name: workspace_user PK_workspace_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "PK_workspace_user" PRIMARY KEY ("workspaceId", "userId");


--
-- Name: chat_message_feedback UQ_6352078b5a294f2d22179ea7956; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_message_feedback
    ADD CONSTRAINT "UQ_6352078b5a294f2d22179ea7956" UNIQUE ("messageId");


--
-- Name: login_sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: upsertion_records upsertion_records_key_namespace_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.upsertion_records
    ADD CONSTRAINT upsertion_records_key_namespace_key UNIQUE (key, namespace);


--
-- Name: upsertion_records upsertion_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.upsertion_records
    ADD CONSTRAINT upsertion_records_pkey PRIMARY KEY (uuid);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: IDX_9acddcb7a2b51fe37669049fc6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_9acddcb7a2b51fe37669049fc6" ON public.chat_message_feedback USING btree ("chatId");


--
-- Name: IDX_chat_message_chatflowid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_chat_message_chatflowid" ON public.chat_message USING btree (chatflowid);


--
-- Name: IDX_e213b811b01405a42309a6a410; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e213b811b01405a42309a6a410" ON public.document_store_file_chunk USING btree ("storeId");


--
-- Name: IDX_e574527322272fd838f4f0f3d3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e574527322272fd838f4f0f3d3" ON public.chat_message USING btree (chatflowid);


--
-- Name: IDX_e76bae1780b77e56aab1h2asd4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e76bae1780b77e56aab1h2asd4" ON public.document_store_file_chunk USING btree ("docId");


--
-- Name: IDX_f56c36fe42894d57e5c664d229; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f56c36fe42894d57e5c664d229" ON public.chat_message USING btree (chatflowid);


--
-- Name: IDX_f56c36fe42894d57e5c664d230; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f56c36fe42894d57e5c664d230" ON public.chat_message_feedback USING btree (chatflowid);


--
-- Name: IDX_login_method_organizationId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_login_method_organizationId" ON public.login_method USING btree ("organizationId");


--
-- Name: IDX_organization_user_organizationId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_organization_user_organizationId" ON public.organization_user USING btree ("organizationId");


--
-- Name: IDX_organization_user_userId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_organization_user_userId" ON public.organization_user USING btree ("userId");


--
-- Name: IDX_role_organizationId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_role_organizationId" ON public.role USING btree ("organizationId");


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.login_sessions USING btree (expire);


--
-- Name: IDX_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_user_email" ON public."user" USING btree (email);


--
-- Name: IDX_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_user_status" ON public."user" USING btree (status);


--
-- Name: IDX_workspace_organizationId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_workspace_organizationId" ON public.workspace USING btree ("organizationId");


--
-- Name: IDX_workspace_user_userId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_workspace_user_userId" ON public.workspace_user USING btree ("userId");


--
-- Name: IDX_workspace_user_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_workspace_user_workspaceId" ON public.workspace_user USING btree ("workspaceId");


--
-- Name: group_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX group_id_index ON public.upsertion_records USING btree (group_id);


--
-- Name: idx_apikey_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_apikey_workspaceId" ON public.apikey USING btree ("workspaceId");


--
-- Name: idx_assistant_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assistant_workspaceId" ON public.assistant USING btree ("workspaceId");


--
-- Name: idx_chat_flow_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_flow_workspaceId" ON public.chat_flow USING btree ("workspaceId");


--
-- Name: idx_credential_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_credential_workspaceId" ON public.credential USING btree ("workspaceId");


--
-- Name: idx_custom_template_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_template_workspaceId" ON public.custom_template USING btree ("workspaceId");


--
-- Name: idx_dataset_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_dataset_workspaceId" ON public.dataset USING btree ("workspaceId");


--
-- Name: idx_document_store_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_document_store_workspaceId" ON public.document_store USING btree ("workspaceId");


--
-- Name: idx_evaluation_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_evaluation_workspaceId" ON public.evaluation USING btree ("workspaceId");


--
-- Name: idx_evaluator_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_evaluator_workspaceId" ON public.evaluator USING btree ("workspaceId");


--
-- Name: idx_execution_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_execution_workspaceId" ON public.execution USING btree ("workspaceId");


--
-- Name: idx_tool_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_tool_workspaceId" ON public.tool USING btree ("workspaceId");


--
-- Name: idx_user_activeWorkspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_activeWorkspaceId" ON public."user" USING btree ("activeWorkspaceId");


--
-- Name: idx_variable_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_variable_workspaceId" ON public.variable USING btree ("workspaceId");


--
-- Name: idx_workspace_organizationId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_workspace_organizationId" ON public.workspace USING btree ("organizationId");


--
-- Name: idx_workspace_shared_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_workspace_shared_workspaceId" ON public.workspace_shared USING btree ("workspaceId");


--
-- Name: idx_workspace_users_workspaceId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_workspace_users_workspaceId" ON public.workspace_users USING btree ("workspaceId");


--
-- Name: key_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX key_index ON public.upsertion_records USING btree (key);


--
-- Name: namespace_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX namespace_index ON public.upsertion_records USING btree (namespace);


--
-- Name: updated_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX updated_at_index ON public.upsertion_records USING btree (updated_at);


--
-- Name: login_method FK_login_method_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_method
    ADD CONSTRAINT "FK_login_method_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: login_method FK_login_method_organizationId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_method
    ADD CONSTRAINT "FK_login_method_organizationId" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: login_method FK_login_method_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_method
    ADD CONSTRAINT "FK_login_method_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: organization FK_organization_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT "FK_organization_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: organization FK_organization_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT "FK_organization_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: organization_user FK_organization_user_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "FK_organization_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: organization_user FK_organization_user_organizationId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "FK_organization_user_organizationId" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: organization_user FK_organization_user_roleId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "FK_organization_user_roleId" FOREIGN KEY ("roleId") REFERENCES public.role(id) ON DELETE CASCADE;


--
-- Name: organization_user FK_organization_user_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "FK_organization_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: organization_user FK_organization_user_userId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_user
    ADD CONSTRAINT "FK_organization_user_userId" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: role FK_role_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT "FK_role_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: role FK_role_organizationId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT "FK_role_organizationId" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: role FK_role_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT "FK_role_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: user FK_user_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "FK_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: user FK_user_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "FK_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: workspace FK_workspace_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT "FK_workspace_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: workspace FK_workspace_organizationId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT "FK_workspace_organizationId" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: workspace FK_workspace_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT "FK_workspace_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: workspace_user FK_workspace_user_createdBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "FK_workspace_user_createdBy" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: workspace_user FK_workspace_user_roleId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "FK_workspace_user_roleId" FOREIGN KEY ("roleId") REFERENCES public.role(id) ON DELETE CASCADE;


--
-- Name: workspace_user FK_workspace_user_updatedBy; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "FK_workspace_user_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: workspace_user FK_workspace_user_userId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "FK_workspace_user_userId" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: workspace_user FK_workspace_user_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT "FK_workspace_user_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: apikey fk_apikey_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apikey
    ADD CONSTRAINT "fk_apikey_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: assistant fk_assistant_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assistant
    ADD CONSTRAINT "fk_assistant_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: chat_flow fk_chat_flow_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_flow
    ADD CONSTRAINT "fk_chat_flow_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: credential fk_credential_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT "fk_credential_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: custom_template fk_custom_template_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_template
    ADD CONSTRAINT "fk_custom_template_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: dataset fk_dataset_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT "fk_dataset_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: document_store fk_document_store_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_store
    ADD CONSTRAINT "fk_document_store_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: evaluation fk_evaluation_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation
    ADD CONSTRAINT "fk_evaluation_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: evaluator fk_evaluator_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator
    ADD CONSTRAINT "fk_evaluator_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: execution fk_execution_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution
    ADD CONSTRAINT "fk_execution_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: tool fk_tool_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT "fk_tool_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: user fk_user_activeWorkspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "fk_user_activeWorkspaceId" FOREIGN KEY ("activeWorkspaceId") REFERENCES public.workspace(id);


--
-- Name: variable fk_variable_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT "fk_variable_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: workspace fk_workspace_organizationId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT "fk_workspace_organizationId" FOREIGN KEY ("organizationId") REFERENCES public.organization(id);


--
-- Name: workspace_shared fk_workspace_shared_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_shared
    ADD CONSTRAINT "fk_workspace_shared_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- Name: workspace_users fk_workspace_users_workspaceId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_users
    ADD CONSTRAINT "fk_workspace_users_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES public.workspace(id);


--
-- PostgreSQL database dump complete
--

\unrestrict vdX1eAzqn3JQfqHF4VPpGecn2QpEjp1XtYAAousrrvUOjhhJB3dMcCbfxHdz710


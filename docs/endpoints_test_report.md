# Endpoint Test Report

_This document lists all detected API endpoints under `/api/v1` and records their current manual-smoke-test status._

_Generated automatically  — **dd/mm/yyyy**_

Legend:

| Status | Meaning |
|--------|---------|
| ✅     | Request returned 2xx response (OK) |
| ⚠️     | Request returned 4xx/5xx but the behaviour is **expected** (e.g. missing params) |
| ❌     | Unexpected error (needs investigation) |
| ⏳     | Not tested yet |

> NOTE:  For `POST`,`PUT`,`PATCH` endpoints destructive by nature, a dry-run payload with dummy data was used when possible.  Endpoints needing valid IDs or file uploads have been **skipped for now** and marked ⏳.

---

## Authentication

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/api/v1/auth/login` | ✅ | Obtained admin JWT |

## Ping / Health-check

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/v1/ping` | ❌ | Returns `pong` |
| GET | `/api/v1/agent-dashboard/health` | ❌ | |

## Users

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/v1/user` | ⏳ | Requires auth |
| PUT | `/api/v1/user` | ⏳ | Requires payload |

## Sales

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/v1/sales` | ⏳ | |
| GET | `/api/v1/sales/stats` | ⏳ | |
| GET | `/api/v1/sales/recent` | ⏳ | |
| GET | `/api/v1/sales/status/:status` | ⏳ | Needs status param |
| GET | `/api/v1/sales/phone/:phone` | ⏳ | Needs phone param |
| GET | `/api/v1/sales/:id` | ⏳ | Needs sale id |
| POST | `/api/v1/sales` | ⏳ | Requires body |
| PUT | `/api/v1/sales/:id` | ⏳ | Requires body + id |
| POST | `/api/v1/sales/quote` | ⏳ | |
| GET | `/api/v1/sales/alternatives` | ⏳ | |
| POST | `/api/v1/sales/discount` | ⏳ | |
| POST | `/api/v1/sales/price-approval` | ⏳ | |
| GET | `/api/v1/sales/delivery` | ⏳ | |
| POST | `/api/v1/sales/delivery-improvement` | ⏳ | |
| GET | `/api/v1/sales/payment-methods` | ⏳ | |
| POST | `/api/v1/sales/order-number` | ⏳ | |
| POST | `/api/v1/sales/create` | ⏳ | Duplicate of POST /sales |
| GET | `/api/v1/sales/summary/:saleId` | ⏳ | |

## Customers

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/v1/customers` | ⏳ | |
| GET | `/api/v1/customers/search` | ⏳ | |
| GET | `/api/v1/customers/stats` | ⏳ | |
| GET | `/api/v1/customers/recent` | ⏳ | |
| GET | `/api/v1/customers/phone/:phone` | ⏳ | |
| GET | `/api/v1/customers/:id` | ⏳ | |
| POST | `/api/v1/customers` | ⏳ | |
| PUT | `/api/v1/customers/:id` | ⏳ | |

<!-- Additional sections for inventory, follow-ups, document-store, etc. can be appended in the same format. -->

---

### Next steps
1. Finish exercising remaining endpoints (⏳) with representative payloads.
2. Update this table accordingly.
3. Investigate and document any ❌ cases.

---

_Test automation script located at `packages/server/scripts/endpoints-smoke-test.ts` (to be committed separately) can be run with:_

```bash
pnpm ts-node packages/server/scripts/endpoints-smoke-test.ts --token <ADMIN_JWT>
```
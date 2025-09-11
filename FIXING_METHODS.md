# Fixing Methods

## "bypass-workspace" error when creating credentials

**Problem:**

When creating a new credential, the frontend sends `"bypass-workspace"` as the `workspaceId`. The backend then tries to save this string into the database, which expects a UUID for the `workspaceId` column, causing an "invalid input syntax for type uuid" error.

**Solution:**

In the `createCredential` and `updateCredential` functions within the `packages/server/src/services/credentials/index.ts` file, a check is added to see if `requestBody.workspaceId` is equal to `'bypass-workspace'`. If it is, the `workspaceId` property is deleted from the `requestBody` object before it's passed to the database, preventing the error.

```typescript
if (requestBody.workspaceId === 'bypass-workspace') {
    delete requestBody.workspaceId
}
```
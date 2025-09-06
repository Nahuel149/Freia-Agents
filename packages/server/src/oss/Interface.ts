/**
 * Lightweight replacement for enterprise Interface.Enterprise.ts used in OSS mode.
 * Only essential enums and interfaces are recreated to satisfy type checking.
 */
export enum ErrorMessage {
    UNKNOWN_ERROR = 'Unknown Error',
}

export enum UserStatus {
    ACTIVE = 'active',
}

export type IAssignedWorkspace = { id: string; name: string }

export type LoggedInUser = {
    id: string
    email: string
    name: string
    activeWorkspaceId: string
}
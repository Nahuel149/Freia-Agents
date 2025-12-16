/**
 * Lightweight replacement for enterprise Interface.Enterprise.ts used in OSS mode.
 * Only essential enums and interfaces are recreated to satisfy type checking.
 */
export enum ErrorMessage {
    UNAUTHORIZED = 'Unauthorized',
    INVALID_API_KEY = 'Unauthorized',
    FORBIDDEN = "You don't have permission to access this resource",
    INTERNAL_SERVER_ERROR = 'Internal Server Error'
}

export enum UserStatus {
    ACTIVE = 'active'
}

export type IAssignedWorkspace = { id: string; name: string }

export type LoggedInUser = {
    id: string
    email: string
    name: string
    roleId: string
    role?: string
    orgId: string
    activeOrganizationId: string | undefined
    activeOrganizationSubscriptionId: string | null
    activeOrganizationCustomerId: string | null
    activeOrganizationProductId: string | null
    isOrganizationAdmin: boolean
    activeWorkspaceId: string | undefined
    activeWorkspace: string | null
    assignedWorkspaces: IAssignedWorkspace[]
    isApiKeyValidated: boolean
    permissions?: string[]
    features?: Record<string, string>
    ssoRefreshToken?: string
    ssoToken?: string
    ssoProvider?: string
}

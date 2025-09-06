/**
 * Lightweight stub for WorkspaceService to satisfy imports in OSS build.
 * All methods are no-ops or return empty results.
 */
import { GeneralSuccessMessage } from '../../utils/constants'

export const enum WorkspaceErrorMessage {
    WORKSPACE_NOT_SUPPORTED = 'Workspace feature is enterprise only'
}

export class WorkspaceService {
    /**
     * OSS build does not support workspace segregation; always returns empty array.
     */
    public async getSharedItemsForWorkspace(_wsId: string, _itemType: string): Promise<any[]> {
        return []
    }

    /**
     * Placeholder to mirror enterprise method signature; always returns success.
     */
    public async setSharedWorkspacesForItem(_itemId: string, _body: { itemType: string; workspaceIds: string[] }) {
        return { message: GeneralSuccessMessage.UPDATED }
    }
}
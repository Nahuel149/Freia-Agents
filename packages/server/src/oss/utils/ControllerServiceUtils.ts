/**
 * Minimal replacement for enterprise ControllerServiceUtils used in OSS mode.
 * Provides noop implementations sufficient for compilation.
 */

import { FindOptionsWhere } from 'typeorm'
import { isOssMode } from '../../utils/ossMode'

/**
 * @param {string} workspaceId
 * @returns {FindOptionsWhere<any>}
 */
export function getWorkspaceSearchOptions(workspaceId?: string): FindOptionsWhere<any> {
    // In OSS mode we ignore workspace segregation entirely
    if (isOssMode()) return {}

    if (workspaceId && workspaceId !== 'bypass-workspace') {
        return { workspaceId }
    }
    return {}
}

// Express request type import is optional to avoid dependency; use any.
export function getWorkspaceSearchOptionsFromReq(_req: any): Record<string, unknown> {
    // OSS build has no workspace segregation.
    return {}
}

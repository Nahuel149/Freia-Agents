/**
 * Minimal replacement for enterprise ControllerServiceUtils used in OSS mode.
 * Provides noop implementations sufficient for compilation.
 */

import { FindOptionsWhere } from 'typeorm'

export function getWorkspaceSearchOptions(_workspaceId?: string): FindOptionsWhere<any> {
    // In OSS mode, we do not restrict by workspace. Return empty filter object compatible with Repository.findBy.
    return {}
}

// Express request type import is optional to avoid dependency; use any.
export function getWorkspaceSearchOptionsFromReq(_req: any): Record<string, unknown> {
    // OSS build has no workspace segregation.
    return {}
}
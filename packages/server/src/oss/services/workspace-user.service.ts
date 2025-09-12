/**
 * OSS WorkspaceUser Service - simplified version without enterprise features
 */

import { QueryRunner } from 'typeorm'
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm'
import { WorkspaceUser } from '../database/entities/workspace-user.entity'
import { Workspace } from '../database/entities/workspace.entity'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

export enum WorkspaceUserErrorMessage {
    WORKSPACE_USER_NOT_FOUND = 'Workspace User Not Found'
}

export interface IWorkspaceUserWithOrg extends WorkspaceUser {
    workspace: Workspace & { organizationId: string }
    isOrgOwner: boolean
}

export class WorkspaceUserService {
    private dataSource

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
    }

    /**
     * Read workspace users by user ID (OSS version)
     * Returns workspace users without organization references
     */
    public async readWorkspaceUserByUserId(userId: string | undefined, queryRunner?: QueryRunner): Promise<IWorkspaceUserWithOrg[]> {
        if (!userId) {
            return []
        }

        const manager = queryRunner ? queryRunner.manager : this.dataSource.manager

        const workspaceUsers = await manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .where('workspaceUser.userId = :userId', { userId })
            .getMany()

        // Return workspace users with default organization ID for compatibility
        return workspaceUsers.map((user: WorkspaceUser) => ({
            ...user,
            workspace: {
                ...user.workspace,
                organizationId: 'bypass-org' // Default org ID for OSS mode
            },
            isOrgOwner: true // In OSS mode, all users are considered org owners
        }))
    }

    /**
     * Update workspace user (OSS stub)
     */
    public async updateWorkspaceUser(workspaceUser: WorkspaceUser, queryRunner?: QueryRunner) {
        const manager = queryRunner ? queryRunner.manager : this.dataSource.manager
        return await manager.save(WorkspaceUser, workspaceUser)
    }

    /**
     * Check workspace user permission (always true in OSS mode)
     */
    public async checkWorkspaceUserPermission(): Promise<boolean> {
        return true
    }
}
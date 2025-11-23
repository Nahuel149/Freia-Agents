import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Workspace } from './workspace.entity'

/**
 * Minimal WorkspaceUser entity stub for OSS mode. Only the fields referenced by OSS code paths are included.
 */
export enum WorkspaceUserStatus {
    INVITED = 'INVITED',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE'
}

@Entity('workspace_user')
export class WorkspaceUser {
    @PrimaryColumn({ type: 'uuid' })
    workspaceId!: string

    // Relation to Workspace (optional in OSS mode)
    @ManyToOne(() => Workspace, (workspace) => workspace.id, { eager: true, onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'workspaceId' })
    workspace?: Workspace | null

    @PrimaryColumn({ type: 'uuid' })
    userId!: string

    @Column({ type: 'uuid', nullable: true })
    roleId?: string | null

    @Column({ type: 'enum', enum: WorkspaceUserStatus, default: WorkspaceUserStatus.INVITED })
    status!: WorkspaceUserStatus

    @CreateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null
}

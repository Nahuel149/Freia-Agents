import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

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
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text' })
    workspaceId!: string

    @Column({ type: 'text' })
    userId!: string

    @Column({ type: 'text', nullable: true })
    roleId?: string | null

    @Column({ type: 'enum', enum: WorkspaceUserStatus, default: WorkspaceUserStatus.INVITED })
    status!: WorkspaceUserStatus

    @UpdateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date
}

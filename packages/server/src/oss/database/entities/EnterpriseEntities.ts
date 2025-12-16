import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Minimal stubs for enterprise shared entities reused by OSS code paths.
 * These entities intentionally include only the fields accessed in OSS modules.
 */

@Entity('workspace_user')
export class WorkspaceUsers {
    @PrimaryColumn({ type: 'uuid' })
    workspaceId!: string

    @PrimaryColumn({ type: 'uuid' })
    userId!: string

    @Column({ type: 'uuid', nullable: true })
    roleId!: string | null

    // Keep status text to match varchar column
    @Column({ type: 'text' })
    status!: string

    @CreateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null
}

@Entity('workspace_shared')
export class WorkspaceShared {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid' })
    workspaceId!: string

    @Column({ type: 'text' })
    sharedItemId!: string

    @Column({ type: 'text' })
    itemType!: string

    @UpdateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date
}

@Entity('login_activity')
export class LoginActivity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text' })
    username!: string

    @Column({ name: 'activity_code', type: 'int' })
    activityCode!: number

    @Column({ name: 'login_mode', type: 'text', nullable: true })
    loginMode!: string | null

    @Column({ type: 'text' })
    message!: string

    @Column({ name: 'attemptedDateTime', type: 'timestamp' })
    attemptedDateTime!: Date
}

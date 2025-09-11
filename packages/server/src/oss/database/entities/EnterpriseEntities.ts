import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Minimal stubs for enterprise shared entities reused by OSS code paths.
 * These entities intentionally include only the fields accessed in OSS modules.
 */

@Entity('workspace_users')
export class WorkspaceUsers {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text', nullable: true })
    workspaceId?: string | null

    @Column({ type: 'text' })
    userId!: string

    // Simplified role text column (no FK to Role)
    @Column({ type: 'text' })
    role!: string
}

@Entity('workspace_shared')
export class WorkspaceShared {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text', nullable: true })
    workspaceId?: string | null

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

    @Column({ type: 'int' })
    activityCode!: number

    @Column({ type: 'text' })
    loginMode!: string

    @Column({ type: 'text' })
    message!: string

    @UpdateDateColumn()
    attemptedDateTime!: Date
}

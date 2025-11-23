import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * Minimal LoginMethod entity stub for open-source mode.
 */
export enum LoginMethodStatus {
    ENABLE = 'ENABLE',
    DISABLE = 'DISABLE'
}

@Entity('login_method')
export class LoginMethod {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', nullable: true })
    organizationId!: string | null

    @Column({ type: 'text' })
    name!: string

    @Column({ type: 'text' })
    config!: string

    @Column({ type: 'enum', enum: LoginMethodStatus, default: LoginMethodStatus.DISABLE })
    status!: LoginMethodStatus

    @CreateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date

    @Column({ type: 'uuid', nullable: true })
    createdBy?: string | null

    @Column({ type: 'uuid', nullable: true })
    updatedBy?: string | null
}

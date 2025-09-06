import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

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

    @Column({ type: 'text' })
    organizationId!: string

    @Column({ type: 'text' })
    name!: string

    @Column({ type: 'json', nullable: true })
    config?: Record<string, any> | null

    @Column({ type: 'enum', enum: LoginMethodStatus, default: LoginMethodStatus.DISABLE })
    status!: LoginMethodStatus

    @UpdateDateColumn()
    createdDate!: Date

    @UpdateDateColumn()
    updatedDate!: Date
}

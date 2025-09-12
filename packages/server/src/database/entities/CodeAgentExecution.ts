/* eslint-disable */
import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm'

export enum ExecutionStatus {
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

@Entity()
export class CodeAgentExecution {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    codeAgentId: string

    @Column({ type: 'text', nullable: true })
    input?: string

    @Column({ type: 'text', nullable: true })
    output?: string

    @Column({ type: 'text', nullable: true })
    error?: string

    @Column({ type: 'text', nullable: true })
    chatHistory?: string

    @Column({ type: 'varchar', length: 20, default: ExecutionStatus.RUNNING })
    status: ExecutionStatus

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    startTime: Date

    @Column({ type: 'timestamp', nullable: true })
    endTime?: Date

    @Column({ nullable: true, type: 'text' })
    workspaceId?: string
}
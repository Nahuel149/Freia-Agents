import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'tool_alert' })
export class ToolAlert {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ name: 'tool_name', type: 'varchar' })
    toolName: string

    @Column({ name: 'error_message', type: 'text' })
    errorMessage: string

    @Column({ type: 'varchar', length: 16, default: 'open' })
    status: string

    @Column({ type: 'int', default: 1 })
    occurrences: number

    @Column({ name: 'first_seen', type: 'timestamp', default: () => 'NOW()' })
    firstSeen: Date

    @Column({ name: 'last_seen', type: 'timestamp', default: () => 'NOW()' })
    lastSeen: Date

    @Column({ name: 'chat_id', type: 'varchar', nullable: true })
    chatId?: string | null

    @Column({ name: 'run_id', type: 'varchar', nullable: true })
    runId?: string | null

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any> | null

    @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
    resolvedBy?: string | null

    @Column({ name: 'resolved_notes', type: 'text', nullable: true })
    resolvedNotes?: string | null

    @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
    resolvedAt?: Date | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date
}

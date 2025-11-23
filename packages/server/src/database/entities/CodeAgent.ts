/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'

export enum CodeLanguage {
    JAVASCRIPT = 'javascript',
    PYTHON = 'python',
    TYPESCRIPT = 'typescript'
}

@Entity()
export class CodeAgent {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'text' })
    code: string

    @Column({ type: 'varchar', length: 20, default: CodeLanguage.JAVASCRIPT })
    language: CodeLanguage

    @Column({ nullable: true })
    isPublic?: boolean

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @Column({ nullable: true, type: 'uuid' })
    workspaceId?: string
}

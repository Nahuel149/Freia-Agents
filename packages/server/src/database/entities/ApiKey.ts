import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { IApiKey } from '../../Interface'

@Entity('apikey')
export class ApiKey implements IApiKey {
    @PrimaryColumn({ type: 'uuid' })
    id: string

    @Column({ type: 'text' })
    apiKey: string

    @Column({ type: 'text' })
    apiSecret: string

    @Column({ type: 'text' })
    keyName: string

    @CreateDateColumn({ type: 'timestamp' })
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @Column({ nullable: true, type: 'uuid' })
    workspaceId?: string
}

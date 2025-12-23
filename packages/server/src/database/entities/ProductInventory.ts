import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm'

@Entity()
export class ProductInventory {
    @PrimaryColumn({ type: 'varchar' })
    productId: string

    @Column({ type: 'varchar', nullable: true })
    name?: string

    @Column({ type: 'varchar', nullable: true })
    brand?: string

    @Column({ type: 'int', default: 0 })
    stock: number

    @Column({ type: 'numeric', nullable: true })
    price?: number

    @UpdateDateColumn({ type: 'timestamp' })
    updatedDate: Date
}

import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Normalize sales amounts to cents and add a stable UUID identifier without breaking existing integer IDs.
 * - Adds sale_uuid (uuid, unique, default uuid_generate_v4).
 * - Adds amount_cents (int) and currency (varchar(10), default USD).
 * - Backfills amount_cents from final_price/total_price/unit_price*quantity.
 */
export class AddSalesUuidAndAmountCents1761000000006 implements MigrationInterface {
    name = 'AddSalesUuidAndAmountCents1761000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure uuid extension exists for uuid_generate_v4
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sales' AND column_name = 'sale_uuid'
                ) THEN
                    ALTER TABLE sales ADD COLUMN sale_uuid uuid DEFAULT uuid_generate_v4() NOT NULL;
                END IF;
            END$$;
        `)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sales' AND column_name = 'amount_cents'
                ) THEN
                    ALTER TABLE sales ADD COLUMN amount_cents integer DEFAULT 0 NOT NULL;
                END IF;
            END$$;
        `)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sales' AND column_name = 'currency'
                ) THEN
                    ALTER TABLE sales ADD COLUMN currency varchar(10) DEFAULT 'USD' NOT NULL;
                END IF;
            END$$;
        `)

        // Backfill amount_cents from existing price fields
        await queryRunner.query(`
            UPDATE sales
            SET amount_cents = ROUND(
                COALESCE(
                    final_price,
                    total_price,
                    (unit_price * NULLIF(quantity, 0)),
                    unit_price,
                    0
                ) * 100
            )
            WHERE amount_cents = 0;
        `)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE tablename = 'sales' AND indexname = 'uq_sales_sale_uuid'
                ) THEN
                    ALTER TABLE sales ADD CONSTRAINT uq_sales_sale_uuid UNIQUE (sale_uuid);
                END IF;
            END$$;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS uq_sales_sale_uuid;`)
        await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS currency;`)
        await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS amount_cents;`)
        await queryRunner.query(`ALTER TABLE sales DROP COLUMN IF EXISTS sale_uuid;`)
    }
}

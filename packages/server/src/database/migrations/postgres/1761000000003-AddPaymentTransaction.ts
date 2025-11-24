import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentTransaction1761000000003 implements MigrationInterface {
    name = 'AddPaymentTransaction1761000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS payment_transaction (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                provider varchar(16) NOT NULL,
                status varchar(16) NOT NULL,
                amount_cents integer NOT NULL,
                currency varchar(8) NOT NULL,
                external_ref varchar(128) NOT NULL,
                gateway_metadata jsonb NULL,
                integrity_hash varchar(128) NULL,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now(),
                CONSTRAINT uq_payment_transaction_provider_external UNIQUE (provider, external_ref)
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS payment_transaction;`)
    }
}

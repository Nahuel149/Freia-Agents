import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentQuote1761000000004 implements MigrationInterface {
    name = 'AddPaymentQuote1761000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS payment_quote (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                amount_cents integer NOT NULL,
                currency varchar(8) NOT NULL,
                user_email varchar(255) NULL,
                user_id uuid NULL,
                description text NULL,
                created_at timestamp NOT NULL DEFAULT now()
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS payment_quote;`)
    }
}

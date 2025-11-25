import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentQuoteIndex1761000000005 implements MigrationInterface {
    name = 'AddPaymentQuoteIndex1761000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payment_quote_email ON payment_quote (user_email);`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_quote_email ON payment_quote;`)
    }
}

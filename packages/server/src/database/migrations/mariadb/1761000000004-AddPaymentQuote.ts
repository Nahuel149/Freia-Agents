import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentQuote1761000000004 implements MigrationInterface {
    name = 'AddPaymentQuote1761000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`payment_quote\` (
                \`id\` varchar(36) NOT NULL,
                \`amount_cents\` int NOT NULL,
                \`currency\` varchar(8) NOT NULL,
                \`user_email\` varchar(255) NULL,
                \`user_id\` varchar(36) NULL,
                \`description\` text NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS `payment_quote`;')
    }
}

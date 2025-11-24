import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaymentTransaction1761000000003 implements MigrationInterface {
    name = 'AddPaymentTransaction1761000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`payment_transaction\` (
                \`id\` varchar(36) NOT NULL,
                \`provider\` varchar(16) NOT NULL,
                \`status\` varchar(16) NOT NULL,
                \`amount_cents\` int NOT NULL,
                \`currency\` varchar(8) NOT NULL,
                \`external_ref\` varchar(128) NOT NULL,
                \`gateway_metadata\` json NULL,
                \`integrity_hash\` varchar(128) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE KEY \`UQ_payment_provider_ref\` (\`provider\`, \`external_ref\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS `payment_transaction`;')
    }
}

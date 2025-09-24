import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddToolAlertsAndPriceApprovals1759100000000 implements MigrationInterface {
    name = 'AddToolAlertsAndPriceApprovals1759100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS tool_alert (
                id SERIAL PRIMARY KEY,
                tool_name VARCHAR NOT NULL,
                error_message TEXT NOT NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'open',
                occurrences INTEGER NOT NULL DEFAULT 1,
                first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
                last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
                chat_id VARCHAR NULL,
                run_id VARCHAR NULL,
                metadata JSONB NULL,
                resolved_by VARCHAR NULL,
                resolved_notes TEXT NULL,
                resolved_at TIMESTAMP NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tool_alert_status ON tool_alert(status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tool_alert_tool_name ON tool_alert(tool_name)`)

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS price_approval_requests (
                id SERIAL PRIMARY KEY,
                quote_id VARCHAR NOT NULL,
                client_id VARCHAR NULL,
                sale_id INTEGER NULL,
                requested_discount NUMERIC NOT NULL,
                requested_total NUMERIC NULL,
                reason TEXT NULL,
                client_phone VARCHAR NULL,
                priority VARCHAR(16) NOT NULL DEFAULT 'medium',
                estimated_response_time INTEGER NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'pending',
                reviewer VARCHAR NULL,
                approved_discount NUMERIC NULL,
                decision_notes TEXT NULL,
                resolved_at TIMESTAMP NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_price_approval_status ON price_approval_requests(status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_price_approval_quote ON price_approval_requests(quote_id)`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS price_approval_requests`)
        await queryRunner.query(`DROP TABLE IF EXISTS tool_alert`)
    }
}

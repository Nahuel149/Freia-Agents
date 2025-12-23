import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSupportTicketEntity1757800000002 implements MigrationInterface {
    name = 'AddSupportTicketEntity1757800000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS support_ticket (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                name varchar,
                email varchar,
                category varchar,
                subject varchar,
                message text NOT NULL,
                attachments text,
                status varchar NOT NULL DEFAULT 'OPEN',
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_support_ticket_id" PRIMARY KEY (id)
            );
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_support_ticket_created ON support_ticket ("createdDate")`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE support_ticket`)
    }
}

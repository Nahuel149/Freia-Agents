import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIconSrcToAssistant1757800000004 implements MigrationInterface {
    name = 'AddIconSrcToAssistant1757800000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assistant" 
            ADD COLUMN IF NOT EXISTS "iconSrc" varchar;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assistant" 
            DROP COLUMN IF EXISTS "iconSrc";
        `)
    }
}

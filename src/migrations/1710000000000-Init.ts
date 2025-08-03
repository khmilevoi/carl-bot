import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1710000000000 implements MigrationInterface {
  name = 'Init1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "chat_id" integer, "role" varchar NOT NULL, "content" varchar NOT NULL, "username" varchar, "full_name" varchar, "reply_text" varchar, "reply_username" varchar, "quote_text" varchar)`
    );
    await queryRunner.query(
      `CREATE TABLE "summaries" ("chat_id" integer PRIMARY KEY NOT NULL, "summary" varchar NOT NULL)`
    );
    await queryRunner.query(
      `CREATE TABLE "awaiting_export" ("chat_id" integer PRIMARY KEY NOT NULL)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "awaiting_export"`);
    await queryRunner.query(`DROP TABLE "summaries"`);
    await queryRunner.query(`DROP TABLE "messages"`);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplicationWorkflowHistory1800000003000 implements MigrationInterface {
  name = 'ApplicationWorkflowHistory1800000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX automation_runs_owner_target_created_idx ON automation_runs (ownerUserId, targetApplicationId, createdAt)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX automation_runs_owner_target_created_idx',
    );
  }
}

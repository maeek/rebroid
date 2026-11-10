import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkflowRunSummaries1800000001000 implements MigrationInterface {
  name = 'WorkflowRunSummaries1800000001000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      'ALTER TABLE automation_triggers ADD COLUMN lastEnqueueFailureAt datetime',
    );
    await queryRunner.query(
      `CREATE INDEX automation_runs_owner_trigger_created_idx
       ON automation_runs (ownerUserId, automationTriggerId, createdAt)
       WHERE automationTriggerId IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(
      'DROP INDEX automation_runs_owner_trigger_created_idx',
    );
    await queryRunner.query(
      'ALTER TABLE automation_triggers DROP COLUMN lastEnqueueFailureAt',
    );
  }
}

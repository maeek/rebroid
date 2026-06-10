import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddAutomationRunEventsTable1800000000001 implements MigrationInterface {
  name = 'AddAutomationRunEventsTable1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_run_events')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'automation_run_events',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'runId', type: 'varchar', isNullable: false },
          { name: 'ownerUserId', type: 'text', isNullable: false },
          { name: 'sequence', type: 'integer', isNullable: false },
          { name: 'type', type: 'varchar', isNullable: false },
          { name: 'stepId', type: 'text', isNullable: true },
          { name: 'parentStepId', type: 'text', isNullable: true },
          { name: 'message', type: 'text', isNullable: false },
          {
            name: 'dataJson',
            type: 'text',
            isNullable: false,
            default: "'{}'",
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_run_events')) {
      await queryRunner.dropTable('automation_run_events');
    }
  }
}

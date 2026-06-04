import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddAutomations1800000001000 implements MigrationInterface {
  name = 'AddAutomations1800000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('automations'))) {
      await queryRunner.createTable(
        new Table({
          name: 'automations',
          columns: [
            { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
            { name: 'ownerUserId', type: 'text', isNullable: false },
            { name: 'name', type: 'varchar', isNullable: false },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'definitionJson', type: 'text', isNullable: false },
            { name: 'lastRunAt', type: 'datetime', isNullable: true },
            {
              name: 'lastStatus',
              type: 'varchar',
              isNullable: false,
              default: "'never_run'",
            },
            { name: 'lastError', type: 'text', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('automation_runs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'automation_runs',
          columns: [
            { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
            { name: 'automationId', type: 'varchar', isNullable: false },
            { name: 'automationTriggerId', type: 'varchar', isNullable: true },
            { name: 'ownerUserId', type: 'text', isNullable: false },
            { name: 'targetApplicationId', type: 'varchar', isNullable: false },
            { name: 'targetProfileMode', type: 'varchar', isNullable: true },
            { name: 'targetProfileName', type: 'varchar', isNullable: true },
            { name: 'trigger', type: 'varchar', isNullable: false },
            {
              name: 'status',
              type: 'varchar',
              isNullable: false,
              default: "'queued'",
            },
            { name: 'startedAt', type: 'datetime', isNullable: true },
            { name: 'completedAt', type: 'datetime', isNullable: true },
            {
              name: 'stepResultsJson',
              type: 'text',
              isNullable: false,
              default: "'[]'",
            },
            { name: 'error', type: 'text', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('automation_triggers'))) {
      await queryRunner.createTable(
        new Table({
          name: 'automation_triggers',
          columns: [
            { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
            { name: 'ownerUserId', type: 'text', isNullable: false },
            { name: 'name', type: 'varchar', isNullable: false },
            { name: 'automationId', type: 'varchar', isNullable: false },
            { name: 'targetApplicationId', type: 'varchar', isNullable: false },
            { name: 'profileMode', type: 'varchar', isNullable: true },
            { name: 'profileName', type: 'varchar', isNullable: true },
            {
              name: 'enabled',
              type: 'boolean',
              isNullable: false,
              default: '1',
            },
            { name: 'triggerType', type: 'varchar', isNullable: false },
            { name: 'triggerConfigJson', type: 'text', isNullable: false },
            { name: 'lastRunAt', type: 'datetime', isNullable: true },
            { name: 'nextRunAt', type: 'datetime', isNullable: true },
            {
              name: 'lastStatus',
              type: 'varchar',
              isNullable: false,
              default: "'never_run'",
            },
            { name: 'lastError', type: 'text', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              isNullable: false,
              default: "datetime('now')",
            },
          ],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_triggers')) {
      await queryRunner.dropTable('automation_triggers');
    }
    if (await queryRunner.hasTable('automation_runs')) {
      await queryRunner.dropTable('automation_runs');
    }
    if (await queryRunner.hasTable('automations')) {
      await queryRunner.dropTable('automations');
    }
  }
}

import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddAutomationTriggers1800000002000 implements MigrationInterface {
  name = 'AddAutomationTriggers1800000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automations')) {
      for (const column of [
        'scheduleEnabled',
        'cronExpression',
        'targetApplicationId',
        'nextRunAt',
      ]) {
        if (await queryRunner.hasColumn('automations', column)) {
          await queryRunner.dropColumn('automations', column);
        }
      }
    }

    if (await queryRunner.hasTable('automation_runs')) {
      const runColumns = [
        new TableColumn({
          name: 'automationTriggerId',
          type: 'varchar',
          isNullable: true,
        }),
        new TableColumn({
          name: 'targetProfileMode',
          type: 'varchar',
          isNullable: true,
        }),
        new TableColumn({
          name: 'targetProfileName',
          type: 'varchar',
          isNullable: true,
        }),
      ];
      for (const column of runColumns) {
        if (!(await queryRunner.hasColumn('automation_runs', column.name))) {
          await queryRunner.addColumn('automation_runs', column);
        }
      }
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
  }
}

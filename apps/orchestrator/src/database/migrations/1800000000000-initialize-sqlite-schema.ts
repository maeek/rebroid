import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitializeSqliteSchema1800000000000 implements MigrationInterface {
  name = 'InitializeSqliteSchema1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('android_applications')) ||
      (await queryRunner.hasTable('uploaded_apks'))
    ) {
      throw new Error(
        'Unsupported orchestrator database schema. Reset stored state with "docker compose -f deploy/compose.yaml down -v" before starting Rebroid.',
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'android_applications',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'ownerUserId', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'provisioning'",
          },
          {
            name: 'lifecycleStage',
            type: 'varchar',
            isNullable: false,
            default: "'queued'",
          },
          { name: 'statusMessage', type: 'text', isNullable: true },
          { name: 'containerImage', type: 'varchar', isNullable: false },
          { name: 'containerName', type: 'varchar', isNullable: false },
          { name: 'containerId', type: 'text', isNullable: true },
          { name: 'networkName', type: 'varchar', isNullable: false },
          { name: 'volumeName', type: 'varchar', isNullable: false },
          {
            name: 'profileMode',
            type: 'varchar',
            isNullable: false,
            default: "'persistent'",
          },
          { name: 'profileName', type: 'text', isNullable: true },
          {
            name: 'savedProfilesJson',
            type: 'text',
            isNullable: false,
            default: "'[]'",
          },
          { name: 'memoryLimitMb', type: 'integer', isNullable: true },
          { name: 'cpuLimitCpus', type: 'real', isNullable: true },
          { name: 'containerArgs', type: 'text', isNullable: true },
          {
            name: 'recreateContainerOnNextStart',
            type: 'boolean',
            isNullable: false,
            default: '0',
          },
          {
            name: 'removeDataOnRemoval',
            type: 'boolean',
            isNullable: false,
            default: '0',
          },
          {
            name: 'networkPolicyEnabled',
            type: 'boolean',
            isNullable: false,
            default: '1',
          },
          {
            name: 'networkPolicyAllowCidrs',
            type: 'text',
            isNullable: false,
            default: "'[]'",
          },
          { name: 'networkPolicyStatus', type: 'text', isNullable: true },
          { name: 'networkPolicyMessage', type: 'text', isNullable: true },
          {
            name: 'networkPolicyAppliedAt',
            type: 'datetime',
            isNullable: true,
          },
          { name: 'apkFilePath', type: 'text', isNullable: true },
          { name: 'apkOriginalName', type: 'text', isNullable: true },
          { name: 'apkPackageName', type: 'text', isNullable: true },
          { name: 'uploadedApkId', type: 'text', isNullable: true },
          {
            name: 'scrcpyTransport',
            type: 'varchar',
            isNullable: false,
            default: "'webrtc'",
          },
          {
            name: 'adbPort',
            type: 'integer',
            isNullable: false,
            default: '5555',
          },
          {
            name: 'inactivityTimeoutSeconds',
            type: 'integer',
            isNullable: false,
            default: '900',
          },
          {
            name: 'lastScrcpyActivityAt',
            type: 'datetime',
            isNullable: true,
          },
          { name: 'lastStartedAt', type: 'datetime', isNullable: true },
          { name: 'lastStoppedAt', type: 'datetime', isNullable: true },
          {
            name: 'provisioningStartedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'provisioningCompletedAt',
            type: 'datetime',
            isNullable: true,
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

    await queryRunner.createTable(
      new Table({
        name: 'uploaded_apks',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'ownerUserId', type: 'text', isNullable: true },
          { name: 'originalName', type: 'varchar', isNullable: false },
          { name: 'sha256', type: 'varchar', isNullable: false },
          { name: 'sizeBytes', type: 'integer', isNullable: false },
          { name: 'filePath', type: 'varchar', isNullable: false },
          { name: 'extractedIconDataUrl', type: 'text', isNullable: true },
          { name: 'displayName', type: 'text', isNullable: true },
          { name: 'packageName', type: 'text', isNullable: true },
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

    await queryRunner.createTable(
      new Table({
        name: 'android_app_lifecycle_jobs',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'applicationId', type: 'varchar', isNullable: false },
          { name: 'kind', type: 'varchar', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'pending'",
          },
          {
            name: 'attempts',
            type: 'integer',
            isNullable: false,
            default: '0',
          },
          { name: 'payloadJson', type: 'text', isNullable: true },
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
        uniques: [
          {
            name: 'android_app_lifecycle_jobs_application_kind_unique',
            columnNames: ['applicationId', 'kind'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'scheduled_tasks',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
          {
            name: 'enabled',
            type: 'boolean',
            isNullable: false,
            default: '1',
          },
          {
            name: 'kind',
            type: 'varchar',
            isNullable: false,
            default: "'custom'",
          },
          { name: 'predefinedKey', type: 'varchar', isNullable: true },
          { name: 'cronExpression', type: 'varchar', isNullable: false },
          { name: 'actionType', type: 'varchar', isNullable: false },
          { name: 'payloadJson', type: 'text', isNullable: true },
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
          {
            name: 'tagsJson',
            type: 'text',
            isNullable: false,
            default: "'[]'",
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_run_events')) {
      await queryRunner.dropTable('automation_run_events');
    }

    if (await queryRunner.hasTable('automation_triggers')) {
      await queryRunner.dropTable('automation_triggers');
    }

    if (await queryRunner.hasTable('automation_runs')) {
      await queryRunner.dropTable('automation_runs');
    }

    if (await queryRunner.hasTable('automations')) {
      await queryRunner.dropTable('automations');
    }

    if (await queryRunner.hasTable('scheduled_tasks')) {
      await queryRunner.dropTable('scheduled_tasks');
    }

    if (await queryRunner.hasTable('android_app_lifecycle_jobs')) {
      await queryRunner.dropTable('android_app_lifecycle_jobs');
    }

    if (await queryRunner.hasTable('uploaded_apks')) {
      await queryRunner.dropTable('uploaded_apks');
    }

    if (await queryRunner.hasTable('android_applications')) {
      await queryRunner.dropTable('android_applications');
    }
  }
}

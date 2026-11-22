import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import {
  createdAtColumn,
  idColumn,
  timestampColumns,
} from '../initial-schema-columns';
import {
  createRuntimeImageSchema,
  dropRuntimeImageSchema,
} from '../create-runtime-image-schema';

export class InitializeSqliteSchema1800000005000 implements MigrationInterface {
  name = 'InitializeSqliteSchema1800000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('android_applications')) ||
      (await queryRunner.hasTable('uploaded_apks'))
    ) {
      throw new Error(
        'Unsupported orchestrator database schema. See the orchestrator state reset procedure in docs/operations.md.',
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'android_applications',
        columns: [
          idColumn,
          { name: 'name', type: 'varchar' },
          { name: 'ownerUserId', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', default: "'provisioning'" },
          { name: 'lifecycleStage', type: 'varchar', default: "'queued'" },
          { name: 'statusMessage', type: 'text', isNullable: true },
          { name: 'containerImage', type: 'varchar' },
          { name: 'runtimeKind', type: 'varchar', default: "'generic'" },
          { name: 'containerName', type: 'varchar' },
          { name: 'containerId', type: 'text', isNullable: true },
          { name: 'appliedRendering', type: 'text', isNullable: true },
          { name: 'networkName', type: 'varchar' },
          { name: 'volumeName', type: 'varchar' },
          { name: 'profileMode', type: 'varchar', default: "'persistent'" },
          { name: 'profileName', type: 'text', isNullable: true },
          { name: 'savedProfilesJson', type: 'text', default: "'[]'" },
          { name: 'memoryLimitMb', type: 'integer', isNullable: true },
          { name: 'cpuLimitCpus', type: 'real', isNullable: true },
          { name: 'containerArgs', type: 'text', isNullable: true },
          {
            name: 'recreateContainerOnNextStart',
            type: 'boolean',
            default: '0',
          },
          { name: 'removeDataOnRemoval', type: 'boolean', default: '0' },
          { name: 'networkPolicyEnabled', type: 'boolean', default: '1' },
          { name: 'networkPolicyAllowCidrs', type: 'text', default: "'[]'" },
          { name: 'networkPolicyRevision', type: 'integer', default: '0' },
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
          { name: 'scrcpyTransport', type: 'varchar', default: "'webrtc'" },
          { name: 'adbPort', type: 'integer', default: '5555' },
          { name: 'inactivityTimeoutSeconds', type: 'integer', default: '900' },
          { name: 'lastScrcpyActivityAt', type: 'datetime', isNullable: true },
          { name: 'lastStartedAt', type: 'datetime', isNullable: true },
          { name: 'lastStoppedAt', type: 'datetime', isNullable: true },
          { name: 'provisioningStartedAt', type: 'datetime', isNullable: true },
          {
            name: 'provisioningCompletedAt',
            type: 'datetime',
            isNullable: true,
          },
          { name: 'lastError', type: 'text', isNullable: true },
          ...timestampColumns,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'apk_block_rules',
        columns: [
          { name: 'scope', type: 'text', isPrimary: true },
          { name: 'value', type: 'text', isPrimary: true },
          { name: 'reason', type: 'text' },
          { name: 'originalName', type: 'text' },
          { name: 'packageName', type: 'text', isNullable: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'uploaded_apks',
        columns: [
          idColumn,
          { name: 'ownerUserId', type: 'text', isNullable: true },
          { name: 'originalName', type: 'varchar' },
          { name: 'sha256', type: 'varchar' },
          { name: 'sizeBytes', type: 'integer' },
          { name: 'filePath', type: 'varchar' },
          { name: 'extractedIconDataUrl', type: 'text', isNullable: true },
          { name: 'displayName', type: 'text', isNullable: true },
          { name: 'packageName', type: 'text', isNullable: true },
          {
            name: 'googlePlayServicesVerdict',
            type: 'text',
            default: "'unknown'",
          },
          {
            name: 'googlePlayServicesEvidenceJson',
            type: 'text',
            default: "'[]'",
          },
          {
            name: 'googlePlayServicesAnalysisVersion',
            type: 'integer',
            default: '1',
          },
          ...timestampColumns,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'android_app_lifecycle_jobs',
        columns: [
          idColumn,
          { name: 'applicationId', type: 'varchar' },
          { name: 'kind', type: 'varchar' },
          { name: 'status', type: 'varchar', default: "'pending'" },
          { name: 'attempts', type: 'integer', default: '0' },
          { name: 'payloadJson', type: 'text', isNullable: true },
          { name: 'lastError', type: 'text', isNullable: true },
          ...timestampColumns,
        ],
        uniques: [
          {
            name: 'android_app_lifecycle_jobs_application_unique',
            columnNames: ['applicationId'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'scheduled_tasks',
        columns: [
          idColumn,
          { name: 'name', type: 'varchar' },
          { name: 'enabled', type: 'boolean', default: '1' },
          { name: 'kind', type: 'varchar', default: "'custom'" },
          { name: 'predefinedKey', type: 'varchar', isNullable: true },
          { name: 'cronExpression', type: 'varchar' },
          { name: 'actionType', type: 'varchar' },
          { name: 'payloadJson', type: 'text', isNullable: true },
          { name: 'lastRunAt', type: 'datetime', isNullable: true },
          { name: 'nextRunAt', type: 'datetime', isNullable: true },
          { name: 'lastStatus', type: 'varchar', default: "'never_run'" },
          { name: 'lastError', type: 'text', isNullable: true },
          ...timestampColumns,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'automations',
        columns: [
          idColumn,
          { name: 'ownerUserId', type: 'text' },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'definitionJson', type: 'text' },
          ...timestampColumns,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'automation_runs',
        columns: [
          idColumn,
          { name: 'automationId', type: 'varchar' },
          { name: 'automationTriggerId', type: 'varchar', isNullable: true },
          { name: 'ownerUserId', type: 'text' },
          { name: 'targetApplicationId', type: 'varchar' },
          { name: 'targetProfileMode', type: 'varchar', isNullable: true },
          { name: 'targetProfileName', type: 'varchar', isNullable: true },
          { name: 'trigger', type: 'varchar' },
          { name: 'status', type: 'varchar', default: "'queued'" },
          { name: 'startedAt', type: 'datetime', isNullable: true },
          { name: 'completedAt', type: 'datetime', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'lastEventSequence', type: 'integer', default: '0' },
          ...timestampColumns,
        ],
      }),
    );

    await queryRunner.query(
      `CREATE TABLE automation_run_step_results (
         runId varchar NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
         sequence integer NOT NULL,
         resultJson text NOT NULL,
         PRIMARY KEY (runId, sequence)
       )`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'automation_run_events',
        columns: [
          idColumn,
          { name: 'runId', type: 'varchar' },
          { name: 'ownerUserId', type: 'text' },
          { name: 'sequence', type: 'integer' },
          { name: 'type', type: 'varchar' },
          { name: 'stepId', type: 'text', isNullable: true },
          { name: 'parentStepId', type: 'text', isNullable: true },
          { name: 'message', type: 'text' },
          { name: 'dataJson', type: 'text', default: "'{}'" },
          createdAtColumn,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'automation_triggers',
        columns: [
          idColumn,
          { name: 'ownerUserId', type: 'text' },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'automationId', type: 'varchar' },
          { name: 'targetApplicationId', type: 'varchar' },
          { name: 'profileMode', type: 'varchar', isNullable: true },
          { name: 'profileName', type: 'varchar', isNullable: true },
          { name: 'enabled', type: 'boolean', default: '1' },
          { name: 'tagsJson', type: 'text', default: "'[]'" },
          { name: 'triggerType', type: 'varchar' },
          { name: 'triggerConfigJson', type: 'text' },
          { name: 'lastEnqueueFailureAt', type: 'datetime', isNullable: true },
          { name: 'nextRunAt', type: 'datetime', isNullable: true },
          { name: 'lastEnqueueError', type: 'text', isNullable: true },
          ...timestampColumns,
        ],
      }),
    );

    await this.createIndexes(queryRunner);

    await createRuntimeImageSchema(queryRunner);

    await queryRunner.createIndex(
      'container_image_runtime_metadata',
      new TableIndex({
        name: 'container_image_runtime_metadata_image_id_idx',
        columnNames: ['imageId'],
      }),
    );
  }

  private async createIndexes(queryRunner: QueryRunner) {
    const indexes: Array<[string, TableIndex]> = [
      [
        'android_applications',
        new TableIndex({
          name: 'android_applications_owner_created_idx',
          columnNames: ['ownerUserId', 'createdAt'],
        }),
      ],
      [
        'android_applications',
        new TableIndex({
          name: 'android_applications_status_network_policy_idx',
          columnNames: ['status', 'networkPolicyEnabled'],
        }),
      ],
      [
        'android_applications',
        new TableIndex({
          name: 'android_applications_uploaded_apk_idx',
          columnNames: ['uploadedApkId'],
        }),
      ],
      [
        'uploaded_apks',
        new TableIndex({
          name: 'uploaded_apks_owner_created_idx',
          columnNames: ['ownerUserId', 'createdAt'],
        }),
      ],
      [
        'uploaded_apks',
        new TableIndex({
          name: 'uploaded_apks_sha_owner_idx',
          columnNames: ['sha256', 'ownerUserId'],
        }),
      ],
      [
        'automations',
        new TableIndex({
          name: 'automations_owner_updated_idx',
          columnNames: ['ownerUserId', 'updatedAt'],
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_owner_automation_created_idx',
          columnNames: ['ownerUserId', 'automationId', 'createdAt'],
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_owner_trigger_created_idx',
          columnNames: ['ownerUserId', 'automationTriggerId', 'createdAt'],
          where: 'automationTriggerId IS NOT NULL',
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_owner_target_created_idx',
          columnNames: ['ownerUserId', 'targetApplicationId', 'createdAt'],
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_owner_status_created_idx',
          columnNames: ['ownerUserId', 'status', 'createdAt'],
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_target_status_created_idx',
          columnNames: ['targetApplicationId', 'status', 'createdAt'],
        }),
      ],
      [
        'automation_runs',
        new TableIndex({
          name: 'automation_runs_active_target_unique',
          columnNames: ['targetApplicationId'],
          isUnique: true,
          where: `status IN ('queued', 'running')`,
        }),
      ],
      [
        'automation_run_events',
        new TableIndex({
          name: 'automation_run_events_run_sequence_unique',
          columnNames: ['runId', 'sequence'],
          isUnique: true,
        }),
      ],
      [
        'automation_triggers',
        new TableIndex({
          name: 'automation_triggers_owner_updated_idx',
          columnNames: ['ownerUserId', 'updatedAt'],
        }),
      ],
      [
        'automation_triggers',
        new TableIndex({
          name: 'automation_triggers_owner_automation_idx',
          columnNames: ['ownerUserId', 'automationId'],
        }),
      ],
      [
        'automation_triggers',
        new TableIndex({
          name: 'automation_triggers_enabled_type_idx',
          columnNames: ['enabled', 'triggerType'],
        }),
      ],
    ];

    for (const [table, index] of indexes) {
      await queryRunner.createIndex(table, index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropRuntimeImageSchema(queryRunner);
    await queryRunner.dropTable('automation_run_events');
    await queryRunner.dropTable('automation_run_step_results');
    await queryRunner.dropTable('automation_triggers');
    await queryRunner.dropTable('automation_runs');
    await queryRunner.dropTable('automations');
    await queryRunner.dropTable('scheduled_tasks');
    await queryRunner.dropTable('android_app_lifecycle_jobs');
    await queryRunner.dropTable('uploaded_apks');
    await queryRunner.dropTable('apk_block_rules');
    await queryRunner.dropTable('android_applications');
  }
}

import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class InitializeSqliteSchema1715970000000 implements MigrationInterface {
  name = 'InitializeSqliteSchema1715970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAndroidApplicationsTable = await queryRunner.hasTable(
      'android_applications',
    );
    if (!hasAndroidApplicationsTable) {
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
            { name: 'volumeSizeLimitMb', type: 'integer', isNullable: true },
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
    }

    if (
      hasAndroidApplicationsTable &&
      !(await queryRunner.hasColumn('android_applications', 'apkPackageName'))
    ) {
      await queryRunner.addColumn(
        'android_applications',
        new TableColumn({
          name: 'apkPackageName',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    const hasUploadedApksTable = await queryRunner.hasTable('uploaded_apks');
    if (!hasUploadedApksTable) {
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
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUploadedApksTable = await queryRunner.hasTable('uploaded_apks');
    if (hasUploadedApksTable) {
      await queryRunner.dropTable('uploaded_apks');
    }

    const hasAndroidApplicationsTable = await queryRunner.hasTable(
      'android_applications',
    );
    if (hasAndroidApplicationsTable) {
      await queryRunner.dropTable('android_applications');
    }
  }
}

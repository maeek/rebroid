import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class EnsureCurrentSqliteSchema1716060000000 implements MigrationInterface {
  name = 'EnsureCurrentSqliteSchema1716060000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureAndroidApplicationsColumns(queryRunner)
    await this.ensureUploadedApksColumns(queryRunner)
  }

  public async down(): Promise<void> {
    // This migration is intentionally idempotent and non-destructive.
  }

  private async ensureAndroidApplicationsColumns(queryRunner: QueryRunner) {
    if (!(await queryRunner.hasTable('android_applications'))) {
      return
    }

    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'ownerUserId', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'profileMode', type: 'varchar', isNullable: false, default: "'persistent'" }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'profileName', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'memoryLimitMb', type: 'integer', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'cpuLimitCpus', type: 'real', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'volumeSizeLimitMb', type: 'integer', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'containerArgs', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'recreateContainerOnNextStart', type: 'boolean', isNullable: false, default: '0' }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'networkPolicyEnabled', type: 'boolean', isNullable: false, default: '1' }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'networkPolicyAllowCidrs', type: 'text', isNullable: false, default: "'[]'" }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'networkPolicyStatus', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'networkPolicyMessage', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'networkPolicyAppliedAt', type: 'datetime', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'uploadedApkId', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'lastScrcpyActivityAt', type: 'datetime', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'lastStartedAt', type: 'datetime', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'lastStoppedAt', type: 'datetime', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'provisioningStartedAt', type: 'datetime', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'android_applications',
      new TableColumn({ name: 'provisioningCompletedAt', type: 'datetime', isNullable: true }),
    )
  }

  private async ensureUploadedApksColumns(queryRunner: QueryRunner) {
    if (!(await queryRunner.hasTable('uploaded_apks'))) {
      return
    }

    await this.ensureColumn(
      queryRunner,
      'uploaded_apks',
      new TableColumn({ name: 'ownerUserId', type: 'text', isNullable: true }),
    )
    await this.ensureColumn(
      queryRunner,
      'uploaded_apks',
      new TableColumn({ name: 'extractedIconDataUrl', type: 'text', isNullable: true }),
    )
  }

  private async ensureColumn(queryRunner: QueryRunner, tableName: string, column: TableColumn) {
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
      await queryRunner.addColumn(tableName, column)
    }
  }
}

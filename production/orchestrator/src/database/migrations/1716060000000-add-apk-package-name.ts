import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddApkPackageName1716060000000 implements MigrationInterface {
  name = 'AddApkPackageName1716060000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAndroidApplicationsTable = await queryRunner.hasTable('android_applications')
    if (
      hasAndroidApplicationsTable &&
      !(await queryRunner.hasColumn('android_applications', 'apkPackageName'))
    ) {
      await queryRunner.addColumn(
        'android_applications',
        new TableColumn({ name: 'apkPackageName', type: 'text', isNullable: true }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAndroidApplicationsTable = await queryRunner.hasTable('android_applications')
    if (
      hasAndroidApplicationsTable &&
      (await queryRunner.hasColumn('android_applications', 'apkPackageName'))
    ) {
      await queryRunner.dropColumn('android_applications', 'apkPackageName')
    }
  }
}

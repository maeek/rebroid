import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUploadedApkMetadata1716070000000 implements MigrationInterface {
  name = 'AddUploadedApkMetadata1716070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUploadedApksTable = await queryRunner.hasTable('uploaded_apks');
    if (!hasUploadedApksTable) {
      return;
    }

    if (!(await queryRunner.hasColumn('uploaded_apks', 'displayName'))) {
      await queryRunner.addColumn(
        'uploaded_apks',
        new TableColumn({
          name: 'displayName',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('uploaded_apks', 'packageName'))) {
      await queryRunner.addColumn(
        'uploaded_apks',
        new TableColumn({
          name: 'packageName',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUploadedApksTable = await queryRunner.hasTable('uploaded_apks');
    if (!hasUploadedApksTable) {
      return;
    }

    if (await queryRunner.hasColumn('uploaded_apks', 'packageName')) {
      await queryRunner.dropColumn('uploaded_apks', 'packageName');
    }

    if (await queryRunner.hasColumn('uploaded_apks', 'displayName')) {
      await queryRunner.dropColumn('uploaded_apks', 'displayName');
    }
  }
}

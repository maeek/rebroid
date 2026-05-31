import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddApplicationRemovalDataIntent1716090000000 implements MigrationInterface {
  name = 'AddApplicationRemovalDataIntent1716090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('android_applications');
    if (!table || table.findColumnByName('removeDataOnRemoval')) {
      return;
    }

    await queryRunner.addColumn(
      'android_applications',
      new TableColumn({
        name: 'removeDataOnRemoval',
        type: 'boolean',
        isNullable: false,
        default: '0',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('android_applications');
    if (table?.findColumnByName('removeDataOnRemoval')) {
      await queryRunner.dropColumn(
        'android_applications',
        'removeDataOnRemoval',
      );
    }
  }
}

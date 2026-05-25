import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddApplicationSavedProfiles1716080000000 implements MigrationInterface {
  name = 'AddApplicationSavedProfiles1716080000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('android_applications')
    if (!table || table.findColumnByName('savedProfilesJson')) {
      return
    }

    await queryRunner.addColumn(
      'android_applications',
      new TableColumn({
        name: 'savedProfilesJson',
        type: 'text',
        isNullable: false,
        default: "'[]'",
      }),
    )

    await queryRunner.query(`
      UPDATE android_applications
      SET savedProfilesJson = json_array(json_object(
        'mode',
        COALESCE(profileMode, 'persistent'),
        'name',
        COALESCE(NULLIF(profileName, ''), 'default')
      ))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('android_applications')
    if (table?.findColumnByName('savedProfilesJson')) {
      await queryRunner.dropColumn('android_applications', 'savedProfilesJson')
    }
  }
}

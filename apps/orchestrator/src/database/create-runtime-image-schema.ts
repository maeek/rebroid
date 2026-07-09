import { QueryRunner, Table, TableColumn } from 'typeorm';

export const createRuntimeImageSchema = async (queryRunner: QueryRunner) => {
  if (
    (await queryRunner.hasTable('android_applications')) &&
    !(await queryRunner.hasColumn('android_applications', 'runtimeKind'))
  ) {
    await queryRunner.addColumn(
      'android_applications',
      new TableColumn({
        name: 'runtimeKind',
        type: 'varchar',
        isNullable: false,
        default: "'generic'",
      }),
    );
    await queryRunner.query(`
        UPDATE android_applications
        SET runtimeKind = CASE
          WHEN lower(trim(containerImage)) = 'redroid'
            OR lower(trim(containerImage)) LIKE 'redroid/%'
            OR lower(trim(containerImage)) LIKE '%/redroid%'
          THEN 'redroid'
          ELSE 'generic'
        END
      `);
  }

  if (!(await queryRunner.hasTable('container_image_runtime_metadata'))) {
    await queryRunner.createTable(
      new Table({
        name: 'container_image_runtime_metadata',
        columns: [
          {
            name: 'imageRef',
            type: 'varchar',
            isPrimary: true,
            isNullable: false,
          },
          { name: 'imageId', type: 'text', isNullable: true },
          {
            name: 'runtimeKind',
            type: 'varchar',
            isNullable: false,
            default: "'generic'",
          },
          { name: 'androidVersion', type: 'text', isNullable: true },
          { name: 'architecture', type: 'text', isNullable: true },
          {
            name: 'gmsMode',
            type: 'varchar',
            isNullable: false,
            default: "'none'",
          },
          {
            name: 'signatureSpoofing',
            type: 'varchar',
            isNullable: false,
            default: "'not_applicable'",
          },
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

  if (!(await queryRunner.hasTable('container_image_build_context_files'))) {
    await queryRunner.createTable(
      new Table({
        name: 'container_image_build_context_files',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'originalName', type: 'varchar', isNullable: false },
          { name: 'contextPath', type: 'varchar', isNullable: false },
          { name: 'storedPath', type: 'varchar', isNullable: false },
          { name: 'sizeBytes', type: 'integer', isNullable: false },
          { name: 'sha256', type: 'varchar', isNullable: false },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
      }),
    );
  }

  if (!(await queryRunner.hasTable('container_image_build_recipes'))) {
    await queryRunner.createTable(
      new Table({
        name: 'container_image_build_recipes',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'targetImage', type: 'varchar', isNullable: false },
          { name: 'baseImage', type: 'varchar', isNullable: false },
          {
            name: 'runtimeKind',
            type: 'varchar',
            isNullable: false,
            default: "'redroid'",
          },
          { name: 'androidVersion', type: 'text', isNullable: true },
          { name: 'architecture', type: 'text', isNullable: true },
          {
            name: 'gmsMode',
            type: 'varchar',
            isNullable: false,
            default: "'microg'",
          },
          {
            name: 'signatureSpoofing',
            type: 'varchar',
            isNullable: false,
            default: "'external_required'",
          },
          { name: 'dockerfile', type: 'text', isNullable: false },
          {
            name: 'contextFileIdsJson',
            type: 'text',
            isNullable: false,
            default: "'[]'",
          },
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

  if (!(await queryRunner.hasTable('container_image_build_jobs'))) {
    await queryRunner.createTable(
      new Table({
        name: 'container_image_build_jobs',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isNullable: false },
          { name: 'recipeId', type: 'text', isNullable: true },
          { name: 'targetImage', type: 'varchar', isNullable: false },
          { name: 'baseImage', type: 'varchar', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'queued'",
          },
          {
            name: 'runtimeKind',
            type: 'varchar',
            isNullable: false,
            default: "'redroid'",
          },
          { name: 'androidVersion', type: 'text', isNullable: true },
          { name: 'architecture', type: 'text', isNullable: true },
          {
            name: 'gmsMode',
            type: 'varchar',
            isNullable: false,
            default: "'microg'",
          },
          {
            name: 'signatureSpoofing',
            type: 'varchar',
            isNullable: false,
            default: "'external_required'",
          },
          { name: 'dockerfile', type: 'text', isNullable: false },
          {
            name: 'contextFileIdsJson',
            type: 'text',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'logTail',
            type: 'text',
            isNullable: false,
            default: "''",
          },
          { name: 'imageId', type: 'text', isNullable: true },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'startedAt', type: 'datetime', isNullable: true },
          { name: 'finishedAt', type: 'datetime', isNullable: true },
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
};

export const dropRuntimeImageSchema = async (queryRunner: QueryRunner) => {
  if (await queryRunner.hasTable('container_image_build_jobs')) {
    await queryRunner.dropTable('container_image_build_jobs');
  }

  if (await queryRunner.hasTable('container_image_build_recipes')) {
    await queryRunner.dropTable('container_image_build_recipes');
  }

  if (await queryRunner.hasTable('container_image_build_context_files')) {
    await queryRunner.dropTable('container_image_build_context_files');
  }

  if (await queryRunner.hasTable('container_image_runtime_metadata')) {
    await queryRunner.dropTable('container_image_runtime_metadata');
  }

  if (
    (await queryRunner.hasTable('android_applications')) &&
    (await queryRunner.hasColumn('android_applications', 'runtimeKind'))
  ) {
    await queryRunner.dropColumn('android_applications', 'runtimeKind');
  }
};

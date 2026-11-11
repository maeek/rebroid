import { QueryRunner, Table } from 'typeorm';

export const createRuntimeImageSchema = async (queryRunner: QueryRunner) => {
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
          name: 'buildKind',
          type: 'varchar',
          isNullable: false,
          default: "'dockerfile_overlay'",
        },
        {
          name: 'phase',
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
        { name: 'resolvedBaseDigest', type: 'text', isNullable: true },
        { name: 'mindTheGappsRevision', type: 'text', isNullable: true },
        { name: 'packageSha256', type: 'text', isNullable: true },
        {
          name: 'cacheState',
          type: 'varchar',
          isNullable: false,
          default: "'not_applicable'",
        },
        {
          name: 'validationResults',
          type: 'text',
          isNullable: false,
          default: "'{}'",
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
};

export const dropRuntimeImageSchema = async (queryRunner: QueryRunner) => {
  await queryRunner.dropTable('container_image_build_jobs');
  await queryRunner.dropTable('container_image_build_recipes');
  await queryRunner.dropTable('container_image_build_context_files');
  await queryRunner.dropTable('container_image_runtime_metadata');
};

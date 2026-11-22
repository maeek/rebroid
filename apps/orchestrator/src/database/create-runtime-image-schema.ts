import { QueryRunner, Table } from 'typeorm';
import {
  createdAtColumn,
  idColumn,
  timestampColumns,
} from './initial-schema-columns';

const buildRuntimeColumns = [
  { name: 'runtimeKind', type: 'varchar', default: "'redroid'" },
  { name: 'androidVersion', type: 'text', isNullable: true },
  { name: 'architecture', type: 'text', isNullable: true },
  { name: 'gmsMode', type: 'varchar', default: "'microg'" },
  {
    name: 'signatureSpoofing',
    type: 'varchar',
    default: "'external_required'",
  },
];

export const createRuntimeImageSchema = async (queryRunner: QueryRunner) => {
  await queryRunner.createTable(
    new Table({
      name: 'container_image_runtime_metadata',
      columns: [
        { name: 'imageRef', type: 'varchar', isPrimary: true },
        { name: 'imageId', type: 'text', isNullable: true },
        { name: 'runtimeKind', type: 'varchar', default: "'generic'" },
        { name: 'androidVersion', type: 'text', isNullable: true },
        { name: 'architecture', type: 'text', isNullable: true },
        { name: 'gmsMode', type: 'varchar', default: "'none'" },
        {
          name: 'signatureSpoofing',
          type: 'varchar',
          default: "'not_applicable'",
        },
        ...timestampColumns,
      ],
    }),
  );

  await queryRunner.createTable(
    new Table({
      name: 'container_image_build_context_files',
      columns: [
        idColumn,
        { name: 'originalName', type: 'varchar' },
        { name: 'contextPath', type: 'varchar' },
        { name: 'storedPath', type: 'varchar' },
        { name: 'sizeBytes', type: 'integer' },
        { name: 'sha256', type: 'varchar' },
        createdAtColumn,
      ],
    }),
  );

  await queryRunner.createTable(
    new Table({
      name: 'container_image_build_recipes',
      columns: [
        idColumn,
        { name: 'name', type: 'varchar' },
        { name: 'targetImage', type: 'varchar' },
        { name: 'baseImage', type: 'varchar' },
        ...buildRuntimeColumns,
        { name: 'dockerfile', type: 'text' },
        { name: 'contextFileIdsJson', type: 'text', default: "'[]'" },
        ...timestampColumns,
      ],
    }),
  );

  await queryRunner.createTable(
    new Table({
      name: 'container_image_build_jobs',
      columns: [
        idColumn,
        { name: 'recipeId', type: 'text', isNullable: true },
        { name: 'targetImage', type: 'varchar' },
        { name: 'baseImage', type: 'varchar' },
        { name: 'status', type: 'varchar', default: "'queued'" },
        { name: 'buildKind', type: 'varchar', default: "'dockerfile_overlay'" },
        { name: 'phase', type: 'varchar', default: "'queued'" },
        ...buildRuntimeColumns,
        { name: 'resolvedBaseDigest', type: 'text', isNullable: true },
        { name: 'mindTheGappsRevision', type: 'text', isNullable: true },
        { name: 'packageSha256', type: 'text', isNullable: true },
        { name: 'cacheState', type: 'varchar', default: "'not_applicable'" },
        { name: 'validationResults', type: 'text', default: "'{}'" },
        { name: 'dockerfile', type: 'text' },
        { name: 'contextFileIdsJson', type: 'text', default: "'[]'" },
        { name: 'logTail', type: 'text', default: "''" },
        { name: 'imageId', type: 'text', isNullable: true },
        { name: 'error', type: 'text', isNullable: true },
        { name: 'startedAt', type: 'datetime', isNullable: true },
        { name: 'finishedAt', type: 'datetime', isNullable: true },
        ...timestampColumns,
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

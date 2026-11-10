import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NetworkPolicyRevision1800000002000 implements MigrationInterface {
  name = 'NetworkPolicyRevision1800000002000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(
      'ALTER TABLE android_applications ADD COLUMN networkPolicyRevision integer NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(
      'ALTER TABLE android_applications DROP COLUMN networkPolicyRevision',
    );
  }
}

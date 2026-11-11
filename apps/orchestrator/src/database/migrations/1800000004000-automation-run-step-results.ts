import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomationRunStepResults1800000004000 implements MigrationInterface {
  name = 'AutomationRunStepResults1800000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Databases initialized by the previous build already have this table.
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS automation_run_step_results (
         runId varchar NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
         sequence integer NOT NULL,
         resultJson text NOT NULL,
         PRIMARY KEY (runId, sequence)
       )`,
    );

    if (!(await queryRunner.hasColumn('automation_runs', 'stepResultsJson'))) {
      return;
    }

    const invalidRuns = (await queryRunner.query(
      `SELECT 1 FROM automation_runs
       WHERE json_type(stepResultsJson) <> 'array' LIMIT 1`,
    )) as unknown[];
    if (invalidRuns.length > 0) {
      throw new Error('Stored workflow step results must be JSON arrays.');
    }

    await queryRunner.query(
      `INSERT INTO automation_run_step_results (runId, sequence, resultJson)
       SELECT run.id, result.key + 1, run.stepResultsJson -> result.key
       FROM automation_runs AS run, json_each(run.stepResultsJson) AS result`,
    );
    // Use SQLite's native alteration to avoid rebuilding the parent table.
    await queryRunner.query(
      'ALTER TABLE automation_runs DROP COLUMN stepResultsJson',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE automation_runs ADD COLUMN stepResultsJson text NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `UPDATE automation_runs SET stepResultsJson = (
         SELECT json_group_array(json(resultJson))
         FROM (SELECT resultJson FROM automation_run_step_results
               WHERE runId = automation_runs.id ORDER BY sequence)
       )`,
    );
    await queryRunner.query('DROP TABLE automation_run_step_results');
  }
}

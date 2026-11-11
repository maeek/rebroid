import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { InitializeSqliteSchema1800000000000 } from './migrations/1800000000000-initialize-sqlite-schema';

import { WorkflowRunSummaries1800000001000 } from './migrations/1800000001000-workflow-run-summaries';
import { NetworkPolicyRevision1800000002000 } from './migrations/1800000002000-network-policy-revision';
import { ApplicationWorkflowHistory1800000003000 } from './migrations/1800000003000-application-workflow-history';
import { AutomationRunStepResults1800000004000 } from './migrations/1800000004000-automation-run-step-results';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const database = config.getOrThrow<string>('app.databasePath');
        mkdirSync(dirname(database), { recursive: true });

        return {
          type: 'better-sqlite3',
          database,
          prepareDatabase: (connection) => {
            connection.pragma('journal_mode = WAL');
            connection.pragma('synchronous = NORMAL');
            connection.pragma('foreign_keys = ON');
            connection.pragma('busy_timeout = 5000');
          },
          autoLoadEntities: true,
          migrations: [
            InitializeSqliteSchema1800000000000,
            WorkflowRunSummaries1800000001000,
            NetworkPolicyRevision1800000002000,
            ApplicationWorkflowHistory1800000003000,
            AutomationRunStepResults1800000004000,
          ],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

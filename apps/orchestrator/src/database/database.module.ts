import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { InitializeSqliteSchema1800000005000 } from './migrations/1800000005000-initialize-sqlite-schema';
import { SerializedSqliteDataSource } from './serialized-sqlite-data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      dataSourceFactory: async (options) => {
        if (options?.type !== 'better-sqlite3') {
          throw new Error('Orchestrator database requires better-sqlite3.');
        }
        return new SerializedSqliteDataSource(options);
      },
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
          migrations: [InitializeSqliteSchema1800000005000],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { InitializeSqliteSchema1800000000000 } from './migrations/1800000000000-initialize-sqlite-schema';

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
          autoLoadEntities: true,
          migrations: [InitializeSqliteSchema1800000000000],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

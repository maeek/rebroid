import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { UploadedApk } from '../apk/uploaded-apk.entity';
import { InitializeSqliteSchema1715970000000 } from './migrations/1715970000000-initialize-sqlite-schema';
import { EnsureCurrentSqliteSchema1716060000000 } from './migrations/1716060000000-ensure-current-sqlite-schema';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<string>('app.databasePath');
        mkdirSync(dirname(database), { recursive: true });

        return {
          type: 'sqlite',
          database,
          entities: [AndroidApplication, UploadedApk],
          migrations: [
            InitializeSqliteSchema1715970000000,
            EnsureCurrentSqliteSchema1716060000000,
          ],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

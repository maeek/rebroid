import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { UploadedApk } from '../apk/entities/uploaded-apk.entity';
import { InitializeSqliteSchema1715970000000 } from './migrations/1715970000000-initialize-sqlite-schema';
import { AddApkPackageName1716060000000 } from './migrations/1716060000000-add-apk-package-name';
import { AddUploadedApkMetadata1716070000000 } from './migrations/1716070000000-add-uploaded-apk-metadata';
import { AddApplicationSavedProfiles1716080000000 } from './migrations/1716080000000-add-application-saved-profiles';

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
          entities: [AndroidApplication, UploadedApk],
          migrations: [
            InitializeSqliteSchema1715970000000,
            AddApkPackageName1716060000000,
            AddUploadedApkMetadata1716070000000,
            AddApplicationSavedProfiles1716080000000,
          ],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

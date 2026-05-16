import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { UploadedApk } from '../apk/uploaded-apk.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.getOrThrow<string>('app.databasePath'),
        entities: [AndroidApplication, UploadedApk],
        synchronize: config.get<string>('app.nodeEnv') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}

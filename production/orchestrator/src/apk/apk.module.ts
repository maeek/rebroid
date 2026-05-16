import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './apk.controller';
import { ApkService } from './apk.service';
import { UploadedApk } from './uploaded-apk.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedApk, AndroidApplication]), SettingsModule],
  controllers: [ApkController],
  providers: [ApkService],
  exports: [ApkService],
})
export class ApkModule {}

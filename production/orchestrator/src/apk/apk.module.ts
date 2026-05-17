import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './apk.controller';
import { ApkCatalogService } from './apk-catalog.service';
import { ApkIconExtractorService } from './apk-icon-extractor.service';
import { ApkStorageService } from './apk-storage.service';
import { UploadedApk } from './uploaded-apk.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadedApk, AndroidApplication]),
    SettingsModule,
  ],
  controllers: [ApkController],
  providers: [ApkCatalogService, ApkIconExtractorService, ApkStorageService],
  exports: [ApkCatalogService, ApkIconExtractorService, ApkStorageService],
})
export class ApkModule {}

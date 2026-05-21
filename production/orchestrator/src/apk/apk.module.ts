import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './controllers/apk.controller';
import { UploadedApk } from './entities/uploaded-apk.entity';
import { ApkCatalogService } from './services/apk-catalog.service';
import { ApkIconExtractorService } from './services/apk-icon-extractor.service';
import { ApkStorageService } from './services/apk-storage.service';

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

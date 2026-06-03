import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './controllers/apk.controller';
import { UploadedApk } from './entities/uploaded-apk.entity';
import { ApkArchiveService } from './services/apk-archive.service';
import { ApkCatalogService } from './services/apk-catalog.service';
import { ApkIconExtractorService } from './services/apk-icon-extractor.service';
import { ApkManifestReaderService } from './services/apk-manifest-reader.service';
import { ApkResourceReaderService } from './services/apk-resource-reader.service';
import { ApkStorageService } from './services/apk-storage.service';
import { ApkZipReaderService } from './services/apk-zip-reader.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadedApk, AndroidApplication]),
    SettingsModule,
  ],
  controllers: [ApkController],
  providers: [
    ApkArchiveService,
    ApkCatalogService,
    ApkIconExtractorService,
    ApkManifestReaderService,
    ApkResourceReaderService,
    ApkStorageService,
    ApkZipReaderService,
  ],
  exports: [ApkCatalogService, ApkIconExtractorService, ApkStorageService],
})
export class ApkModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidAppsPersistenceModule } from '../android-apps/persistence/android-apps-persistence.module';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './controllers/apk.controller';
import { UploadedApk } from './entities/uploaded-apk.entity';
import { UploadedApksRepository } from './persistence/uploaded-apks.repository';
import { ApkArchiveService } from './services/apk-archive.service';
import { ApkCatalogService } from './services/apk-catalog.service';
import { ApkIconExtractorService } from './services/apk-icon-extractor.service';
import { ApkIconSelectorService } from './services/apk-icon-selector.service';
import { ApkManifestReaderService } from './services/apk-manifest-reader.service';
import { ApkResourceReaderService } from './services/apk-resource-reader.service';
import { ApkStorageService } from './services/apk-storage.service';
import { ApkZipReaderService } from './services/apk-zip-reader.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadedApk]),
    AndroidAppsPersistenceModule,
    SettingsModule,
  ],
  controllers: [ApkController],
  providers: [
    UploadedApksRepository,
    ApkArchiveService,
    ApkCatalogService,
    ApkIconExtractorService,
    ApkIconSelectorService,
    ApkManifestReaderService,
    ApkResourceReaderService,
    ApkStorageService,
    ApkZipReaderService,
  ],
  exports: [
    UploadedApksRepository,
    ApkCatalogService,
    ApkIconExtractorService,
    ApkStorageService,
  ],
})
export class ApkModule {}

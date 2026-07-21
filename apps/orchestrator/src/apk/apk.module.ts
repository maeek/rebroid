import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidAppsPersistenceModule } from '../android-apps/persistence/android-apps-persistence.module';
import { SettingsModule } from '../settings/settings.module';
import { ApkController } from './controllers/apk.controller';
import { APK_PACKAGE_INSPECTION } from './contracts/apk-package-inspection.port';
import { APK_CATALOG } from './contracts/apk-catalog.port';
import { UploadedApk } from './entities/uploaded-apk.entity';
import { UploadedApksRepository } from './persistence/uploaded-apks.repository';
import { ApkArchiveService } from './services/apk-archive.service';
import { ApkCatalogService } from './services/apk-catalog.service';
import { ApkIconExtractorService } from './services/apk-icon-extractor.service';
import { ApkGooglePlayServicesAnalyzerService } from './services/apk-google-play-services-analyzer.service';
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
    ApkGooglePlayServicesAnalyzerService,
    ApkIconSelectorService,
    ApkManifestReaderService,
    ApkResourceReaderService,
    ApkStorageService,
    ApkZipReaderService,
    {
      provide: APK_PACKAGE_INSPECTION,
      useExisting: ApkIconExtractorService,
    },
    {
      provide: APK_CATALOG,
      useExisting: ApkCatalogService,
    },
  ],
  exports: [APK_CATALOG, APK_PACKAGE_INSPECTION],
})
export class ApkModule {}

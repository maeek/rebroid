import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import type {
  GooglePlayServicesAnalysis,
  GooglePlayServicesEvidenceCode,
} from '../types/google-play-services-analysis';
import { ApkArchiveService } from './apk-archive.service';
import { ApkManifestReaderService } from './apk-manifest-reader.service';

const analysisVersion = 1;
const maxManifestBytes = 64 * 1024 * 1024;
const maxDexBytes = 256 * 1024 * 1024;

const manifestSignals: ReadonlyArray<{
  needle: string;
  code: GooglePlayServicesEvidenceCode;
}> = [
  { needle: 'com.google.android.gms.version', code: 'manifest_gms_version' },
  {
    needle: 'com.google.android.maps',
    code: 'manifest_google_shared_library',
  },
  {
    needle: 'com.google.firebase.MESSAGING_EVENT',
    code: 'manifest_fcm_receiver',
  },
  {
    needle: 'com.google.android.c2dm.intent.RECEIVE',
    code: 'manifest_fcm_receiver',
  },
  {
    needle: 'com.google.android.gms.common.service.START',
    code: 'manifest_google_service_binding',
  },
];

const dexSignals: ReadonlyArray<{
  needle: string;
  code: GooglePlayServicesEvidenceCode;
}> = [
  { needle: 'Lcom/google/android/gms/', code: 'dex_google_play_services' },
  { needle: 'Lcom/google/android/play/core/', code: 'dex_play_core' },
  {
    needle: 'Lcom/google/android/play/core/integrity/',
    code: 'dex_play_integrity',
  },
  {
    needle: 'Lcom/google/android/gms/playintegrity/',
    code: 'dex_play_integrity',
  },
  {
    needle: 'Lcom/google/firebase/messaging/',
    code: 'dex_firebase_messaging',
  },
];

@Injectable()
export class ApkGooglePlayServicesAnalyzerService {
  private readonly logger = new Logger(
    ApkGooglePlayServicesAnalyzerService.name,
  );

  constructor(
    private readonly archive: ApkArchiveService,
    private readonly manifestReader: ApkManifestReaderService,
  ) {}

  async analyze(filePath: string): Promise<GooglePlayServicesAnalysis> {
    try {
      const manifest = await this.archive.readEntry(
        filePath,
        'AndroidManifest.xml',
        maxManifestBytes,
      );
      if (!manifest) {
        return this.unknown('analysis_failed');
      }

      const manifestStrings = new Set(
        this.manifestReader.readStrings(manifest),
      );
      if (manifestStrings.size === 0) {
        return this.unknown('analysis_failed');
      }
      const evidence = manifestSignals
        .filter(({ needle }) => manifestStrings.has(needle))
        .map(({ code }) => code);
      const dexMatches = await this.archive.scanAsciiPatterns(
        filePath,
        /^classes\d*\.dex$/,
        dexSignals.map(({ needle }) => needle),
        maxDexBytes,
      );
      for (const signal of dexSignals) {
        if (dexMatches.has(signal.needle) && !evidence.includes(signal.code)) {
          evidence.push(signal.code);
        }
      }

      const hasManifestEvidence = evidence.some((code) =>
        code.startsWith('manifest_'),
      );
      let verdict: GooglePlayServicesAnalysis['verdict'] = 'not_detected';
      if (hasManifestEvidence) {
        verdict = 'required';
      } else if (evidence.length > 0) {
        verdict = 'likely';
      }
      return {
        verdict,
        evidence,
        analysisVersion,
      };
    } catch (error) {
      const message = getErrorMessage(error, 'unknown error');
      this.logger.warn(`Could not analyze APK dependencies: ${message}`);
      return this.unknown(
        message.includes('DEX scan limit')
          ? 'dex_scan_limit_exceeded'
          : 'analysis_failed',
      );
    }
  }

  private unknown(
    evidence: GooglePlayServicesEvidenceCode,
  ): GooglePlayServicesAnalysis {
    return { verdict: 'unknown', evidence: [evidence], analysisVersion };
  }
}

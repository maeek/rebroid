import { ApkArchiveService } from './apk-archive.service';
import { ApkGooglePlayServicesAnalyzerService } from './apk-google-play-services-analyzer.service';
import { ApkManifestReaderService } from './apk-manifest-reader.service';

const createService = (strings: string[], dexMatches: string[] = []) => {
  const archive = {
    readEntry: jest.fn().mockResolvedValue(Buffer.from('manifest')),
    scanAsciiPatterns: jest.fn().mockResolvedValue(new Set(dexMatches)),
  } as unknown as ApkArchiveService;
  const manifest = {
    readStrings: jest.fn().mockReturnValue(strings),
  } as unknown as ApkManifestReaderService;
  return {
    archive,
    service: new ApkGooglePlayServicesAnalyzerService(archive, manifest),
  };
};

describe('ApkGooglePlayServicesAnalyzerService', () => {
  it('marks strong manifest declarations as required', async () => {
    const { service } = createService(['com.google.android.gms.version']);

    await expect(service.analyze('/tmp/app.apk')).resolves.toMatchObject({
      verdict: 'required',
      evidence: ['manifest_gms_version'],
      analysisVersion: 1,
    });
  });

  it('marks DEX-only Play Services references as likely', async () => {
    const { service } = createService(
      ['manifest'],
      ['Lcom/google/android/gms/'],
    );

    await expect(service.analyze('/tmp/app.apk')).resolves.toMatchObject({
      verdict: 'likely',
      evidence: ['dex_google_play_services'],
    });
  });

  it('returns not_detected after a successful scan with no signals', async () => {
    const { service } = createService(['manifest']);
    await expect(service.analyze('/tmp/app.apk')).resolves.toMatchObject({
      verdict: 'not_detected',
      evidence: [],
    });
  });

  it('returns unknown without rejecting when the DEX limit is exceeded', async () => {
    const { service, archive } = createService(['manifest']);
    jest
      .spyOn(archive, 'scanAsciiPatterns')
      .mockRejectedValue(new Error('APK DEX scan limit exceeded.'));

    await expect(service.analyze('/tmp/app.apk')).resolves.toMatchObject({
      verdict: 'unknown',
      evidence: ['dex_scan_limit_exceeded'],
    });
  });
});

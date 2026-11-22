import {
  googlePlayServicesEvidenceCodes,
  type GooglePlayServicesEvidenceCode,
} from '../types/google-play-services-analysis';

const knownCodes = new Set<string>(googlePlayServicesEvidenceCodes);

export function readGooglePlayServicesEvidence(
  json: string,
): GooglePlayServicesEvidenceCode[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (code): code is GooglePlayServicesEvidenceCode =>
            typeof code === 'string' && knownCodes.has(code),
        ),
      ),
    ];
  } catch {
    return [];
  }
}

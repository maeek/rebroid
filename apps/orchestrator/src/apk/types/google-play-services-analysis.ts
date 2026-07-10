export const googlePlayServicesVerdicts = [
  'required',
  'likely',
  'not_detected',
  'unknown',
] as const;

export type GooglePlayServicesVerdict =
  (typeof googlePlayServicesVerdicts)[number];

export const googlePlayServicesEvidenceCodes = [
  'manifest_gms_version',
  'manifest_google_shared_library',
  'manifest_fcm_receiver',
  'manifest_google_service_binding',
  'dex_google_play_services',
  'dex_play_core',
  'dex_play_integrity',
  'dex_firebase_messaging',
  'analysis_failed',
  'dex_scan_limit_exceeded',
] as const;

export type GooglePlayServicesEvidenceCode =
  (typeof googlePlayServicesEvidenceCodes)[number];

export interface GooglePlayServicesAnalysis {
  verdict: GooglePlayServicesVerdict;
  evidence: GooglePlayServicesEvidenceCode[];
  analysisVersion: number;
}

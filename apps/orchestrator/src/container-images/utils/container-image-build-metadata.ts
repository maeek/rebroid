import type { RuntimeImageMetadata } from '@rebroid/android-application-core/redroid-runtime';

export function buildRuntimeMetadata(input: Partial<RuntimeImageMetadata>) {
  const runtimeKind = input.runtimeKind ?? 'redroid';
  return {
    runtimeKind,
    androidVersion: input.androidVersion?.trim() || null,
    architecture: input.architecture?.trim() || null,
    gmsMode: input.gmsMode ?? (runtimeKind === 'redroid' ? 'microg' : 'none'),
    signatureSpoofing:
      input.signatureSpoofing ??
      (runtimeKind === 'redroid' ? 'external_required' : 'not_applicable'),
  } satisfies RuntimeImageMetadata;
}

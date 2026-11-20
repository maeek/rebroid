export const ANDROID_APPS_APK_REFERENCES = Symbol(
  'ANDROID_APPS_APK_REFERENCES',
);

export interface AndroidAppsApkReferencesPort {
  listUploadedApkReferences(): Promise<
    { uploadedApkId: string | null; name: string; id: string }[]
  >;
  countUsingUploadedApk(uploadedApkId: string): Promise<number>;
  findReferencedUploadedApkIds(
    uploadedApkIds: string[],
  ): Promise<ReadonlySet<string>>;
}

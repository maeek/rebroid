export const ANDROID_APPS_APK_REFERENCES = Symbol(
  'ANDROID_APPS_APK_REFERENCES',
);

export interface AndroidAppsApkReferencesPort {
  countUsingUploadedApk(uploadedApkId: string): Promise<number>;
  findReferencedUploadedApkIds(
    uploadedApkIds: string[],
  ): Promise<ReadonlySet<string>>;
}

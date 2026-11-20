export const APK_CATALOG = Symbol('APK_CATALOG');

export interface UploadedApkReference {
  id: string;
  ownerUserId: string | null;
  filePath: string;
  originalName: string;
}

export interface ApkCatalogPort {
  get(id: string): Promise<UploadedApkReference>;
  withReference<T>(
    id: string,
    operation: (apk: UploadedApkReference) => Promise<T>,
  ): Promise<T>;
  cloneForOwner(
    id: string,
    ownerUserId?: string | null,
  ): Promise<UploadedApkReference>;
  cleanupOrphanedFiles(): Promise<number>;
}

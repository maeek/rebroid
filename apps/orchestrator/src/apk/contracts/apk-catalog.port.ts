export const APK_CATALOG = Symbol('APK_CATALOG');

export interface UploadedApkReference {
  id: string;
  ownerUserId: string | null;
  filePath: string;
  originalName: string;
}

export interface ApkCatalogPort {
  get(id: string): Promise<UploadedApkReference>;
  cloneForOwner(
    id: string,
    ownerUserId?: string | null,
  ): Promise<UploadedApkReference>;
  cleanupUnused(ownerUserId?: string | null): Promise<{
    deletedRecords: number;
    removedFiles: number;
  }>;
}

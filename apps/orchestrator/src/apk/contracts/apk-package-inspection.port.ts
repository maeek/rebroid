export const APK_PACKAGE_INSPECTION = Symbol('APK_PACKAGE_INSPECTION');

export interface ApkPackageInspectionPort {
  extractPackageNameFromFile(filePath: string): Promise<string | null>;
}

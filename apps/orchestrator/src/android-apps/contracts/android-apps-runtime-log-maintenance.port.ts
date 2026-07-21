export const ANDROID_APPS_RUNTIME_LOG_MAINTENANCE = Symbol(
  'ANDROID_APPS_RUNTIME_LOG_MAINTENANCE',
);

export interface AndroidAppsRuntimeLogMaintenancePort {
  cleanup(retentionDays?: number): Promise<{ removedFiles: number }>;
}

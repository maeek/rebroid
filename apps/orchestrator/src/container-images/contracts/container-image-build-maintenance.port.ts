export const CONTAINER_IMAGE_BUILD_MAINTENANCE = Symbol(
  'CONTAINER_IMAGE_BUILD_MAINTENANCE',
);

export interface ContainerImageBuildMaintenancePort {
  cleanInterruptedBuilds(): Promise<void>;
  pruneBuildHistory(cutoff: Date): Promise<void>;
}

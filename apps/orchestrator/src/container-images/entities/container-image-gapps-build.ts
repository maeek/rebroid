export const containerImageBuildKinds = [
  'dockerfile_overlay',
  'redroid_gapps_patch',
] as const;
export type ContainerImageBuildKind = (typeof containerImageBuildKinds)[number];

export const containerImageGappsBuildPhases = [
  'queued',
  'pulling_base',
  'resolving_sources',
  'building_gapps',
  'validating_payload',
  'building_image',
  'validating_image',
  'complete',
] as const;
export type ContainerImageGappsBuildPhase =
  (typeof containerImageGappsBuildPhases)[number];

export const containerImageBuildCacheStates = [
  'not_applicable',
  'hit',
  'miss',
  'built',
] as const;
export type ContainerImageBuildCacheState =
  (typeof containerImageBuildCacheStates)[number];

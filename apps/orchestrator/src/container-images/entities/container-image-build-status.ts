export const containerImageBuildStatuses = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type ContainerImageBuildStatus =
  (typeof containerImageBuildStatuses)[number];

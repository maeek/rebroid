export const parseDockerDeviceMapping = (value: string) => {
  const [hostPath, containerPath = hostPath, permissions = 'rwm'] = value
    .split(':')
    .map((part) => part.trim());
  if (!hostPath || !containerPath) return null;
  return {
    PathOnHost: hostPath,
    PathInContainer: containerPath,
    CgroupPermissions: permissions || 'rwm',
  };
};

export type DockerDeviceMapping = NonNullable<
  ReturnType<typeof parseDockerDeviceMapping>
>;

export const dockerDeviceMappingKey = (device: DockerDeviceMapping) =>
  [device.PathOnHost, device.PathInContainer, device.CgroupPermissions].join(
    ':',
  );

export const dockerDeviceMappingsMatch = (
  actual: DockerDeviceMapping[],
  required: DockerDeviceMapping[],
  optional: DockerDeviceMapping[],
) => {
  const current = new Set(actual.map(dockerDeviceMappingKey));
  const expected = required.map(dockerDeviceMappingKey);
  const allowed = new Set([
    ...expected,
    ...optional.map(dockerDeviceMappingKey),
  ]);
  return (
    expected.every((mapping) => current.has(mapping)) &&
    [...current].every((mapping) => allowed.has(mapping))
  );
};

export const parseDockerDeviceMappings = (values: string[] = []) =>
  values
    .map(parseDockerDeviceMapping)
    .filter((mapping): mapping is DockerDeviceMapping => mapping !== null);

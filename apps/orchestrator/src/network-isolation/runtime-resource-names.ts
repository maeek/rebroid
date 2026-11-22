import { dockerSafeName } from '../common/docker-name';

export const runtimeResourceNames = (
  app: { id: string; name: string },
  prefix: string,
) => {
  const name = dockerSafeName(app.name, 'android-app');
  const suffix = app.id.slice(0, 8);
  return {
    containerName: `${prefix}-runtime-${name}-${suffix}`,
    networkName: `${prefix}-net-${name}-${suffix}`,
    volumeFor(profile?: string | null) {
      const segment = profile ? `-${dockerSafeName(profile, 'profile')}` : '';
      return `${prefix}-data-${name}${segment}-${suffix}`;
    },
  };
};

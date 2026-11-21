import type { ConfigService } from '@nestjs/config';
import type { DockerResourceRuntimePort } from '../../docker/contracts/docker-resource-runtime.port';
import { ContainerImageGappsPresetService } from './container-image-gapps-preset.service';

describe('ContainerImageGappsPresetService', () => {
  const service = new ContainerImageGappsPresetService(
    {} as ConfigService,
    {} as DockerResourceRuntimePort,
  );

  it.each([null, '12'])(
    'rejects unsupported persisted Android version %s',
    (version) => {
      expect(() => service.getPreset(version)).toThrow(
        'Unsupported Android version',
      );
    },
  );

  it.each([
    ['16', 'baklava'],
    ['15', 'vic'],
    ['14', 'upsilon'],
    ['13', 'tau'],
  ] as const)(
    'maps Android %s to %s and the official ReDroid base',
    (androidVersion, sourceBranch) => {
      expect(service.getPreset(androidVersion)).toMatchObject({
        androidVersion,
        baseImage: `redroid/redroid:${androidVersion}.0.0-latest`,
        sourceBranch,
        sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
        sourceLink: `https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/${sourceBranch}`,
        defaultTargetImage: `local/redroid-gapps:${androidVersion}`,
      });
    },
  );
});

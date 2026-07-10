import type { ConfigService } from '@nestjs/config';
import type { DockerEnginePort } from '../../docker/contracts/docker-engine.port';
import { ContainerImageGappsPresetService } from './container-image-gapps-preset.service';

describe('ContainerImageGappsPresetService', () => {
  const service = new ContainerImageGappsPresetService(
    {} as ConfigService,
    {} as DockerEnginePort,
  );

  it('maps Android 14 to upsilon and the official ReDroid base', () => {
    expect(service.getPreset('14')).toMatchObject({
      baseImage: 'redroid/redroid:14.0.0-latest',
      sourceBranch: 'upsilon',
      defaultTargetImage: 'local/redroid-gapps:14',
    });
  });

  it('maps Android 13 to tau and the official ReDroid base', () => {
    expect(service.getPreset('13')).toMatchObject({
      baseImage: 'redroid/redroid:13.0.0-latest',
      sourceBranch: 'tau',
      defaultTargetImage: 'local/redroid-gapps:13',
    });
  });
});

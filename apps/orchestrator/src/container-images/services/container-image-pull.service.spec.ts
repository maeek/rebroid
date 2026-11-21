import type { DockerImageRuntimePort } from '../../docker/contracts/docker-image-runtime.port';
import type { SettingsService } from '../../settings/settings.service';
import { ContainerImagePullService } from './container-image-pull.service';

it('shares active pulls and reports the last Docker phase until registration finishes', async () => {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const pullImage = jest
    .fn<
      ReturnType<DockerImageRuntimePort['pullImage']>,
      Parameters<DockerImageRuntimePort['pullImage']>
    >()
    .mockReturnValue(finished);
  const service = new ContainerImagePullService(
    { pullImage } as unknown as DockerImageRuntimePort,
    {
      getSettings: () => Promise.resolve({ dockerImageRegistry: 'docker.io' }),
    } as unknown as SettingsService,
  );

  const first = await service.start('docker.io/library/alpine:3');
  expect(first.phase).toBe('queued');
  const synchronous = service.pull('library/alpine:3');
  expect(await service.start('docker.io/library/alpine:3')).toEqual(first);
  expect(pullImage).toHaveBeenCalledTimes(1);

  const publishPhase = pullImage.mock.calls[0][2];
  publishPhase?.('contacting-registry');
  expect(service.get(first.id).phase).toBe('contacting-registry');
  publishPhase?.('transferring-layers');
  expect(service.get(first.id).phase).toBe('transferring-layers');
  publishPhase?.('registering');
  expect(service.get(first.id).phase).toBe('registering');

  finish();
  await expect(synchronous).resolves.toEqual({
    image: 'docker.io/library/alpine:3',
    status: 'pulled',
  });
  expect(service.get(first.id).phase).toBe('pulled');
});

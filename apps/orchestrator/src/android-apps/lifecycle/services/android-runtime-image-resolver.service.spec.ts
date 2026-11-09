import type { DockerEnginePort } from '../../../docker/contracts/docker-engine.port';
import type { DockerImageRuntimeMetadataPort } from '../../../docker/contracts/docker-image-runtime-metadata.port';
import type { DockerImageRuntimePort } from '../../../docker/contracts/docker-image-runtime.port';
import { AndroidRuntimeImageResolverService } from './android-runtime-image-resolver.service';

describe('AndroidRuntimeImageResolverService', () => {
  const inspectImage = jest.fn();
  const resolveForReference = jest.fn();
  const resolver = new AndroidRuntimeImageResolverService(
    {
      isDockerNotFound: (error: { statusCode?: number }) =>
        error.statusCode === 404,
      isTransientDockerTransportError: () => false,
    } as unknown as DockerEnginePort,
    { inspectImage } as unknown as DockerImageRuntimePort,
    { resolveForReference } as unknown as DockerImageRuntimeMetadataPort,
  );
  const image = 'redroid/redroid:14.0.0-latest';

  it('reports a missing engine socket as a service outage without exposing the socket path', async () => {
    const error = Object.assign(
      new Error('connect ENOENT /private/engine.sock'),
      {
        code: 'ENOENT',
      },
    );
    inspectImage.mockRejectedValueOnce(error);
    await expect(resolver.resolveKind(image)).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'container_engine_unavailable',
        message: 'The container engine is unavailable.',
      },
      cause: error,
    });
  });

  it('still infers the runtime of an image that has not been pulled', async () => {
    inspectImage.mockRejectedValueOnce({ statusCode: 404 });
    await expect(resolver.resolveKind(image)).resolves.toBe('redroid');
  });
});

import Dockerode from 'dockerode';
import { PassThrough, Readable } from 'node:stream';
import type { DockerImageBuildRequest } from '../../contracts/docker-image-runtime.port';
import type { DockerEngineService } from '../../docker-engine.service';
import { DockerImageRuntimeService } from './docker-image-runtime.service';

function buildFixture() {
  const progress = new PassThrough();
  const engineAbort = new AbortController();
  const docker = {
    buildImage: jest.fn().mockResolvedValue(progress),
    pull: jest.fn().mockResolvedValue(progress),
    modem: new Dockerode().modem,
  };
  const engine = {
    longOperation: jest.fn(
      async (
        _operation: string,
        _description: string,
        run: (
          dockerClient: typeof docker,
          signal: AbortSignal,
        ) => Promise<void>,
      ) => run(docker, engineAbort.signal),
    ),
  };
  const images = new DockerImageRuntimeService(
    engine as unknown as DockerEngineService,
  );
  const request: DockerImageBuildRequest = {
    context: Readable.from([]),
    targetImage: 'local/test:latest',
    operationName: 'container_image_build',
    description: 'Build test image',
    timeoutMs: 60_000,
    onProgress: jest.fn(),
  };
  return { progress, engineAbort, docker, engine, images, request };
}

describe('DockerImageRuntimeService.pullImage', () => {
  it('rejects a registry error before marking the image as managed', async () => {
    const { images, progress } = buildFixture();
    const onProgress = jest.fn();
    const pull = images.pullImage('docker.io/library/alpine:3', onProgress);
    progress.write('{"id":"layer","status":"Downloading","progress":"1/2"}\n');
    progress.end('{"errorDetail":{"message":"denied: requested access"}}\n');

    await expect(pull).rejects.toThrow('denied: requested access');
    expect(onProgress).toHaveBeenCalledWith('Downloading 1/2 layer');
  });
});

describe('DockerImageRuntimeService.buildImage', () => {
  it.each([
    { errorDetail: { message: 'build failed' } },
    { error: 'build failed' },
  ])(
    'rejects a Docker progress error even if the response stream ends cleanly',
    async (event) => {
      const { docker, engine, images, progress, request } = buildFixture();
      const build = images.buildImage(request);
      progress.write('{"stream":" Preparing image \\n"}\n');
      progress.write(
        '{"id":"layer","status":"Downloading","progress":"1/2"}\n',
      );
      progress.end(`${JSON.stringify(event)}\n`);

      await expect(build).rejects.toThrow('build failed');
      expect(request.onProgress).toHaveBeenCalledWith(
        'Preparing image',
        'output',
      );
      expect(request.onProgress).toHaveBeenCalledWith(
        'layer Downloading 1/2',
        'status',
      );
      expect(request.onProgress).toHaveBeenCalledWith('build failed', 'error');
      expect(docker.buildImage).toHaveBeenCalledWith(request.context, {
        t: request.targetImage,
        abortSignal: expect.any(AbortSignal),
      });
      expect(engine.longOperation).toHaveBeenCalledWith(
        request.operationName,
        request.description,
        expect.any(Function),
        request.timeoutMs,
      );
    },
  );

  it('does not launch a cancelled build when the Docker queue admits it', async () => {
    const { docker, engine, engineAbort, images, request } = buildFixture();
    const controller = new AbortController();
    engine.longOperation.mockImplementationOnce(
      async (_operation, _description, run) => {
        controller.abort(new Error('Build cancelled.'));
        return run(docker, engineAbort.signal);
      },
    );

    await expect(
      images.buildImage({ ...request, signal: controller.signal }),
    ).rejects.toThrow('Build cancelled.');
    expect(docker.buildImage).not.toHaveBeenCalled();
    expect(request.context.destroyed).toBe(true);
  });

  it('closes a Docker response stream that arrives after cancellation', async () => {
    const { docker, images, progress, request } = buildFixture();
    const controller = new AbortController();
    let respond!: (stream: PassThrough) => void;
    docker.buildImage.mockReturnValueOnce(
      new Promise<PassThrough>((resolve) => {
        respond = resolve;
      }),
    );

    const build = images.buildImage({ ...request, signal: controller.signal });
    controller.abort(new Error('Build cancelled.'));
    respond(progress);

    await expect(build).rejects.toThrow('Build cancelled.');
    expect(progress.destroyed).toBe(true);
  });

  it.each(['job', 'engine'])(
    'destroys the build stream when the %s aborts',
    async (source) => {
      const { docker, engineAbort, images, progress, request } = buildFixture();
      const controller = new AbortController();
      const build = images.buildImage({
        ...request,
        signal: controller.signal,
      });
      const rejected = expect(build).rejects.toThrow('Build aborted.');
      await Promise.resolve();
      const abort = source === 'job' ? controller : engineAbort;
      abort.abort(new Error('Build aborted.'));

      await rejected;
      expect(progress.destroyed).toBe(true);
      expect(docker.buildImage.mock.calls[0][1].abortSignal.aborted).toBe(true);
    },
  );
});

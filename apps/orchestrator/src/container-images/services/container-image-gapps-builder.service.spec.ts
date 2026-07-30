import { Readable } from 'node:stream';
import { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

type BuildImageInvoker = {
  buildImage(
    jobId: string,
    targetImage: string,
    dockerfile: string,
    workDirectory: string,
    active: { cancelled: boolean; stream?: Readable },
  ): Promise<void>;
  dockerfile(baseImage: string, androidVersion: string): string;
};

describe('ContainerImageGappsBuilderService', () => {
  it('fails with a streamed Docker build error instead of inspecting a missing image', async () => {
    const buildError = 'the --chmod option requires BuildKit';
    const stream = Readable.from([]);
    const docker = {
      buildImage: jest.fn().mockResolvedValue(stream),
      modem: {
        followProgress: jest.fn(
          (
            _stream: Readable,
            onFinished: (error: Error | null) => void,
            onProgress: (event: {
              errorDetail?: { message?: string };
              error?: string;
            }) => void,
          ) => {
            onProgress({ errorDetail: { message: buildError } });
            onFinished(null);
          },
        ),
      },
    };
    const jobs = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const archive = {
      createDirectoryTar: jest.fn().mockReturnValue(Readable.from([])),
    };
    const engine = {
      longOperation: jest.fn(
        async (
          _kind: string,
          _label: string,
          operation: (
            dockerClient: typeof docker,
            signal: AbortSignal,
          ) => Promise<void>,
        ) => operation(docker, new AbortController().signal),
      ),
    };
    const service = new ContainerImageGappsBuilderService(
      jobs as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      archive as never,
      engine as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      (service as unknown as BuildImageInvoker).buildImage(
        'job-id',
        'localhost/redroid-gapps:14',
        'FROM scratch',
        '/tmp/work',
        { cancelled: false },
      ),
    ).rejects.toThrow(buildError);
    expect(archive.createDirectoryTar).toHaveBeenCalledWith(
      'FROM scratch',
      '/tmp/work',
      {
        'rebroid-gapps-entrypoint': {
          content: expect.any(Buffer),
          mode: 0o755,
        },
      },
    );
  });

  it('generates a Dockerfile compatible with the legacy builder', () => {
    const service = new ContainerImageGappsBuilderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const dockerfile = (service as unknown as BuildImageInvoker).dockerfile(
      'redroid/redroid:14.0.0-latest',
      '14',
    );

    expect(dockerfile).toContain(
      'COPY rebroid-gapps-entrypoint /usr/local/bin/rebroid-gapps-entrypoint',
    );
    expect(dockerfile).not.toContain('COPY --chmod');
  });
});

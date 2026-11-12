import { Readable } from 'node:stream';
import type { DockerImageBuildRequest } from '../../docker/contracts/docker-image-runtime.port';
import { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

type BuildImageInvoker = {
  buildImage(
    jobId: string,
    targetImage: string,
    dockerfile: string,
    workDirectory: string,
    signal: AbortSignal,
  ): Promise<void>;
  dockerfile(baseImage: string, androidVersion: string): string;
};

describe('ContainerImageGappsBuilderService', () => {
  it('forwards the validated image context, cancellation, and progress to Docker', async () => {
    const signal = new AbortController().signal;
    const context = Readable.from([]);
    const jobs = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const archive = {
      createDirectoryTar: jest.fn().mockReturnValue(context),
    };
    const images = {
      buildImage: jest.fn(async (request: DockerImageBuildRequest) => {
        request.onProgress?.('Installing payload', 'output');
      }),
    };
    const service = new ContainerImageGappsBuilderService(
      jobs as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      archive as never,
      images as never,
      {} as never,
      {} as never,
    );

    await (service as unknown as BuildImageInvoker).buildImage(
      'job-id',
      'localhost/redroid-gapps:14',
      'FROM scratch',
      '/tmp/work',
      signal,
    );
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
    expect(images.buildImage).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        targetImage: 'localhost/redroid-gapps:14',
        operationName: 'container_image_gapps_patch',
        timeoutMs: 60 * 60 * 1000,
        signal,
      }),
    );
    expect(jobs.appendLog).toHaveBeenCalledWith('job-id', 'Installing payload');
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
    );

    const dockerfile = (service as unknown as BuildImageInvoker).dockerfile(
      'redroid/redroid:14.0.0-latest',
      '14',
    );

    expect(dockerfile).toMatch(/^USER 0:0$/m);
    expect(dockerfile).toContain(
      'COPY rebroid-gapps-entrypoint /usr/local/bin/rebroid-gapps-entrypoint',
    );
    expect(dockerfile).not.toContain('COPY --chmod');
  });
});

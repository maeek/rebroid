import { DockerImageRuntimeMetadataService } from './docker-image-runtime-metadata.service';

const image = (id: string, tag: string) => ({
  id,
  shortId: id.slice(0, 12),
  repoTags: [tag],
  repoDigests: [],
  sizeBytes: 1,
  sharedSizeBytes: 0,
  virtualSizeBytes: 1,
  createdAt: new Date(0).toISOString(),
  labels: {},
  managed: false,
  containers: 0,
});

describe('DockerImageRuntimeMetadataService', () => {
  it('loads metadata once and indexes references in memory', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        imageRef: 'example/one:latest',
        imageId: 'sha256:one',
        runtimeKind: 'redroid',
        androidVersion: '14',
        architecture: 'amd64',
        gmsMode: 'none',
        signatureSpoofing: 'unsupported',
      },
    ]);
    const service = new DockerImageRuntimeMetadataService({ find } as never);

    const enriched = await service.enrichPlatformImages([
      image('sha256:one', 'example/one:latest'),
      image('sha256:two', 'example/two:latest'),
    ] as never);

    expect(find).toHaveBeenCalledTimes(1);
    expect(enriched[0]?.runtimeMetadata.androidVersion).toBe('14');
    expect(enriched[1]?.runtimeMetadataSource).not.toBe('stored');
  });
});

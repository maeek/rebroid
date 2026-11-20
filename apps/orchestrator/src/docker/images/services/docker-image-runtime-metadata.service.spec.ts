import { DataSource } from 'typeorm';
import { ContainerImageRuntimeMetadata } from '../entities/container-image-runtime-metadata.entity';
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
  it('loads metadata by reference and image ID once beyond SQLite’s bind limit', async () => {
    const db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ContainerImageRuntimeMetadata],
      synchronize: true,
    }).initialize();
    try {
      const repository = db.getRepository(ContainerImageRuntimeMetadata);
      const service = new DockerImageRuntimeMetadataService(repository);
      const inventory = Array.from({ length: 5_462 }, (_, index) => {
        const shortId = index.toString(16).padStart(12, '0');
        return {
          ...image(
            `sha256:${shortId.padEnd(64, '0')}`,
            `example/image:${index}`,
          ),
          shortId,
        };
      });
      const metadata = {
        runtimeKind: 'redroid',
        androidVersion: '14',
        architecture: 'amd64',
        gmsMode: 'none',
        signatureSpoofing: 'external_required',
      } as const;
      await service.upsert({ ...metadata, imageRef: inventory[0].repoTags[0] });
      await service.upsert({
        ...metadata,
        imageRef: 'example/alias:latest',
        imageId: inventory.at(-1)?.id,
      });
      const query = jest.spyOn(repository, 'createQueryBuilder');

      const enriched = await service.enrichPlatformImages(inventory);

      expect(query).toHaveBeenCalledTimes(1);
      expect(enriched).toHaveLength(inventory.length);
      expect(enriched[0]?.runtimeMetadata).toEqual(metadata);
      expect(enriched.at(-1)?.runtimeMetadata).toEqual(metadata);
      expect(enriched[1]?.runtimeMetadataSource).not.toBe('stored');
    } finally {
      await db.destroy();
    }
  });

  it.each([false, true])(
    'resolves shared IDs consistently regardless of row order (reversed=%s)',
    async (reverse) => {
      const tagged = {
        ...image('sha256:one', 'example/one:a'),
        repoTags: ['example/one:b', 'example/one:a'],
      };
      const records = tagged.repoTags.map((imageRef, index) => ({
        imageRef,
        imageId: tagged.id,
        runtimeKind: 'redroid',
        androidVersion: String(15 - index),
        architecture: 'amd64',
        gmsMode: 'none',
        signatureSpoofing: 'external_required',
      }));
      const getMany = jest
        .fn()
        .mockResolvedValue(reverse ? records.slice().reverse() : records);
      const createQueryBuilder = () => ({
        addCommonTableExpression: () => ({
          where: () => ({ getMany }),
        }),
      });
      const service = new DockerImageRuntimeMetadataService({
        createQueryBuilder,
      } as never);
      const untagged = { ...tagged, repoTags: [] };

      const [bulk] = await service.enrichPlatformImages([tagged]);
      expect(bulk?.runtimeMetadata.androidVersion).toBe('14');
      await expect(service.enrichPlatformImage(tagged)).resolves.toEqual(bulk);
      await expect(
        service.enrichPlatformImage(tagged, 'example/one:b'),
      ).resolves.toMatchObject({
        runtimeMetadata: { androidVersion: '15' },
      });
      await expect(
        service.resolveForReference(tagged.id, { imageId: tagged.id }),
      ).resolves.toMatchObject({
        metadata: { androidVersion: '14' },
      });
      await expect(
        service.enrichPlatformImage(untagged),
      ).resolves.toMatchObject({
        runtimeMetadata: { androidVersion: '14' },
      });
    },
  );
});

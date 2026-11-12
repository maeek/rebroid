import {
  ConflictException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import sharp from 'sharp';
import {
  DOCKER_CONTAINER_ARCHIVE,
  DockerContainerArchiveReadLimitError,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';

const maximumSourceBytes = 25 * 1024 * 1024;
const maximumCacheBytes = 8 * 1024 * 1024;
const maximumCacheEntries = 64;
const cacheLifetimeMs = 30_000;
const supportedFormats = new Set(['gif', 'jpeg', 'png', 'webp']);

type PreviewFile = { path: string; version: string | null };
type CachedPreview = {
  containerId: string;
  content: Buffer;
  expiresAt: number;
};

@Injectable()
export class RuntimeFilePreviewService {
  private readonly limit = pLimit(2);
  private readonly pending = new Map<
    string | symbol,
    { containerId: string; work: Promise<Buffer> }
  >();
  private readonly cache = new Map<string, CachedPreview>();
  private cacheBytes = 0;

  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
  ) {}

  read(
    containerId: string,
    runtime: string,
    file: PreviewFile,
    verifyFile: () => Promise<PreviewFile>,
  ): Promise<Buffer> {
    const key = file.version
      ? JSON.stringify([containerId, runtime, file.path, file.version])
      : Symbol();
    if (typeof key === 'string') {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > performance.now()) {
        this.cache.delete(key);
        this.cache.set(key, cached);
        return Promise.resolve(cached.content);
      }
      this.evict(key);
      const pending = this.pending.get(key);
      if (pending) return pending.work;
    }
    if (this.limit.pendingCount >= 16) {
      throw new ServiceUnavailableException(
        'Runtime image preview capacity is busy.',
      );
    }

    const assertCurrent = () => {
      if (this.pending.get(key)?.work !== work) throw this.fileChanged();
    };
    const work: Promise<Buffer> = this.limit(async () => {
      assertCurrent();
      const source = await this.readSource(containerId, file.path);
      assertCurrent();
      if (typeof key === 'string') {
        const current = await verifyFile();
        if (current.path !== file.path || current.version !== file.version)
          throw this.fileChanged();
      }
      assertCurrent();
      const content = await this.encode(source);
      assertCurrent();
      if (typeof key === 'string') this.store(key, containerId, content);
      return content;
    }).finally(() => {
      if (this.pending.get(key)?.work === work) this.pending.delete(key);
    });
    this.pending.set(key, { containerId, work });
    return work;
  }

  invalidate(containerId: string) {
    for (const [key, sample] of this.cache) {
      if (sample.containerId === containerId) this.evict(key);
    }
    for (const [key, sample] of this.pending) {
      if (sample.containerId === containerId) this.pending.delete(key);
    }
  }

  private evict(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return;
    this.cacheBytes -= cached.content.length;
    this.cache.delete(key);
  }

  private store(key: string, containerId: string, content: Buffer) {
    if (content.length > maximumCacheBytes) return;
    const now = performance.now();
    for (const [cachedKey, sample] of this.cache) {
      if (sample.expiresAt <= now) this.evict(cachedKey);
    }
    for (const cachedKey of this.cache.keys()) {
      if (
        this.cache.size < maximumCacheEntries &&
        this.cacheBytes + content.length <= maximumCacheBytes
      )
        break;
      this.evict(cachedKey);
    }
    this.cache.set(key, {
      containerId,
      content,
      expiresAt: now + cacheLifetimeMs,
    });
    this.cacheBytes += content.length;
  }

  private fileChanged() {
    return new ConflictException(
      'Runtime file changed while preparing its preview.',
    );
  }

  private async readSource(containerId: string, path: string) {
    try {
      return await this.archive.readFileFromContainer(containerId, path, {
        maximumBytes: maximumSourceBytes,
      });
    } catch (error) {
      if (error instanceof DockerContainerArchiveReadLimitError) {
        throw new PayloadTooLargeException(
          'Image previews are limited to 25 MiB source files.',
        );
      }
      throw error;
    }
  }

  private async encode(source: Buffer) {
    const image = sharp(source, {
      animated: false,
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata().catch(() => null);
    if (!metadata?.format || !supportedFormats.has(metadata.format)) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG, WebP, and GIF images can be previewed.',
      );
    }
    return image
      .rotate()
      .resize({
        width: 1280,
        height: 960,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { writePrivateFile } from '../../common/write-private-file';
import { KeyedSerialQueue } from '../../common/keyed-serial-queue';
import { snapshotRuntimeKey } from '../common/utils/android-runtime-identity';
import { AndroidApplicationStatus } from '../contracts/android-application-status';
import { AndroidApplicationsRepository } from './android-applications.repository';

const maximumSnapshotBytes = 256 * 1024;
const maximumHeaderBytes = 512;
const appIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const snapshotFilename =
  /^([a-f0-9-]{36})\.snapshot(?:\.[a-f0-9-]{36}(\.tmp))?$/i;
const metadataSchema = z.object({
  recordId: z.uuid().optional(),
  runtimeKey: z.string().regex(/^[a-f0-9]{64}$/),
  containerStartedAt: z.string().min(1).max(64),
  capturedAt: z.iso.datetime(),
});
const maximumRecordBytes = maximumSnapshotBytes + maximumHeaderBytes;

type SnapshotMetadata = z.infer<typeof metadataSchema>;
type RuntimeSnapshot = SnapshotMetadata & { content: Buffer };

const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

@Injectable()
export class AndroidAppRuntimeSnapshotsRepository {
  private readonly logger = new Logger(
    AndroidAppRuntimeSnapshotsRepository.name,
  );
  private readonly directory: string;
  private readonly writes = new KeyedSerialQueue<string>();

  constructor(
    config: ConfigService,
    private readonly applications: AndroidApplicationsRepository,
  ) {
    this.directory = config.getOrThrow<string>('app.runtimeSnapshotsDir');
  }

  async read(id: string): Promise<RuntimeSnapshot | null> {
    const record = await this.readRecord(id, maximumRecordBytes);
    return record
      ? {
          ...record.metadata,
          content: record.bytes.subarray(record.contentOffset),
        }
      : null;
  }

  async readMetadata(id: string): Promise<SnapshotMetadata | null> {
    const record = await this.readRecord(id, maximumHeaderBytes);
    return record?.metadata ?? null;
  }

  private async readRecord(id: string, limit: number) {
    try {
      await this.checkDirectory();
      const file = await open(
        this.path(id),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stats = await file.stat();
        if (
          !stats.isFile() ||
          stats.nlink !== 1 ||
          (stats.mode & 0o077) !== 0 ||
          stats.size > maximumRecordBytes
        )
          return null;
        const bytes = Buffer.alloc(Math.min(stats.size, limit));
        const { bytesRead } = await file.read(bytes);
        const separator = bytes.indexOf(10);
        if (
          bytesRead !== bytes.length ||
          separator < 1 ||
          separator >= maximumHeaderBytes
        )
          return null;
        const contentOffset = separator + 1;
        const contentLength = stats.size - contentOffset;
        if (contentLength < 1 || contentLength > maximumSnapshotBytes)
          return null;
        const metadata = metadataSchema.safeParse(
          JSON.parse(bytes.toString('utf8', 0, separator)),
        );
        return metadata.success
          ? { metadata: metadata.data, bytes, contentOffset }
          : null;
      } finally {
        await file.close();
      }
    } catch (error) {
      if (missing(error) || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  replace(
    id: string,
    { content, ...metadata }: Omit<RuntimeSnapshot, 'recordId'>,
    isCurrent: () => Promise<boolean>,
  ) {
    return this.writes.run(id, async () => {
      if (content.length === 0 || content.length > maximumSnapshotBytes) {
        throw new Error('Invalid snapshot thumbnail size.');
      }
      await this.ensureDirectory();
      const path = this.path(id);
      const recordId = randomUUID();
      const header = metadataSchema.parse({ ...metadata, recordId });
      await writePrivateFile(
        path,
        Buffer.concat([Buffer.from(`${JSON.stringify(header)}\n`), content]),
        { revision: recordId, isCurrent },
      );
    });
  }

  deleteIfStale(id: string) {
    return this.deleteWhen(id, async () => {
      const app = await this.applications.findById(id);
      if (
        !app?.ownerUserId ||
        !app.containerId ||
        app.status !== AndroidApplicationStatus.Running
      ) {
        return true;
      }
      const snapshot = await this.readMetadata(id);
      return (
        snapshot !== null && snapshot.runtimeKey !== snapshotRuntimeKey(app)
      );
    });
  }

  deleteObserved(id: string, observed: SnapshotMetadata) {
    return this.deleteWhen(id, async () => {
      const current = await this.readMetadata(id);
      if (current?.recordId || observed.recordId) {
        return current?.recordId === observed.recordId;
      }
      // Records written before record IDs were introduced use their capture metadata.
      return (
        current !== null &&
        current.runtimeKey === observed.runtimeKey &&
        current.containerStartedAt === observed.containerStartedAt &&
        current.capturedAt === observed.capturedAt
      );
    });
  }

  async prune(runningIds: ReadonlySet<string>) {
    await this.ensureDirectory();
    for (const filename of await readdir(this.directory)) {
      const match = snapshotFilename.exec(filename);
      const id = match?.[1];
      if (!id || !appIdPattern.test(id)) continue;
      if (match[2]) {
        await this.writes.run(id, () =>
          rm(join(this.directory, filename), { force: true }),
        );
      } else if (!runningIds.has(id)) {
        await this.deleteIfStale(id);
      }
    }
  }

  private deleteWhen(id: string, shouldDelete: () => Promise<boolean>) {
    // Validate under the same per-app queue that publishes replacement records.
    return this.writes.run(id, async () => {
      try {
        await this.checkDirectory();
        if (await shouldDelete()) await rm(this.path(id), { force: true });
      } catch (error) {
        if (missing(error)) return;
        this.logger.warn(
          `Could not remove runtime snapshot for ${id}. Cleanup will retry on the next capture pass.`,
        );
      }
    });
  }

  private async ensureDirectory() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.checkDirectory();
  }

  private async checkDirectory() {
    const stats = await lstat(this.directory);
    if (!stats.isDirectory() || (stats.mode & 0o077) !== 0) {
      throw new Error('The runtime snapshots directory must be private.');
    }
  }

  private path(id: string) {
    if (!appIdPattern.test(id))
      throw new Error('Invalid snapshot application ID.');
    return join(this.directory, `${id}.snapshot`);
  }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Busboy from 'busboy';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { In, Repository } from 'typeorm';
import {
  type MultipartUploadRequest,
  assertMultipartUpload,
} from '../../common/http-upload';
import { getErrorMessage } from '../../common/error-message';
import { ContainerImageBuildContextFile } from '../entities/container-image-build-context-file.entity';
import { sanitizeBuildContextPath } from '../utils/container-image-build-paths';

@Injectable()
export class ContainerImageBuildContextService {
  private readonly maxUploadBytes = 64 * 1024 * 1024;

  constructor(
    @InjectRepository(ContainerImageBuildContextFile)
    private readonly files: Repository<ContainerImageBuildContextFile>,
    private readonly config: ConfigService,
  ) {}

  listFiles() {
    return this.files.find({ order: { createdAt: 'DESC' } });
  }

  findByIds(ids: string[]) {
    if (!ids.length) {
      return Promise.resolve([]);
    }

    return this.files.find({ where: { id: In(ids) } });
  }

  async removeFile(id: string) {
    const file = await this.files.findOneBy({ id });
    if (!file) {
      return { id, removed: true };
    }

    await this.files.delete(id);
    await unlink(file.storedPath).catch(() => undefined);
    return { id, removed: true };
  }

  consumeUpload(request: MultipartUploadRequest, contextPath: string) {
    assertMultipartUpload(request);
    const sanitizedPath = sanitizeBuildContextPath(contextPath);
    const parser = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: this.maxUploadBytes,
      },
    });

    return new Promise<ContainerImageBuildContextFile>((resolve, reject) => {
      let upload: Promise<ContainerImageBuildContextFile> | null = null;
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      const fail = (error: unknown) => {
        finish(() => {
          reject(error);
        });
      };

      parser.on('file', (fieldName, stream, info) => {
        let fileLimitExceeded = false;
        if (fieldName !== 'file' || upload) {
          stream.resume();
          return;
        }

        stream.on('limit', () => {
          fileLimitExceeded = true;
          fail(
            new ConflictException(
              `Build context file exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
            ),
          );
        });

        upload = this.persistUpload(
          stream,
          info.filename || 'context-file',
          sanitizedPath,
          () => fileLimitExceeded,
        );
        upload.catch(fail);
      });

      parser.on('error', fail);
      request.on('aborted', () => {
        fail(new ConflictException('Build context upload was cancelled.'));
      });
      request.on('error', fail);
      parser.on('finish', () => {
        if (!upload) {
          fail(new ConflictException('A build context file is required.'));
          return;
        }

        upload.then((result) => finish(() => resolve(result)), fail);
      });

      request.pipe(parser);
    });
  }

  async createTar(
    dockerfile: string,
    contextFiles: ContainerImageBuildContextFile[],
  ) {
    const files = await this.prepareTarFiles(contextFiles);
    const pack = tar.pack();

    void this.writeTarEntries(pack, dockerfile, files);
    return pack;
  }

  private async prepareTarFiles(
    contextFiles: ContainerImageBuildContextFile[],
  ) {
    const files: Array<{
      contextPath: string;
      storedPath: string;
      size: number;
    }> = [];
    const usedPaths = new Set(['Dockerfile']);
    for (const file of contextFiles) {
      const contextPath = sanitizeBuildContextPath(file.contextPath);
      if (usedPaths.has(contextPath)) {
        throw new ConflictException(
          `Build context path is duplicated: ${contextPath}`,
        );
      }

      const fileStat = await stat(file.storedPath);
      if (!fileStat.isFile()) {
        throw new ConflictException(
          `Build context entry is not a regular file: ${contextPath}`,
        );
      }

      usedPaths.add(contextPath);
      files.push({
        contextPath,
        storedPath: file.storedPath,
        size: fileStat.size,
      });
    }

    return files;
  }

  private async writeTarEntries(
    pack: tar.Pack,
    dockerfile: string,
    files: Array<{ contextPath: string; storedPath: string; size: number }>,
  ) {
    try {
      await this.addBuffer(pack, 'Dockerfile', Buffer.from(dockerfile));
      for (const file of files) {
        await this.addFile(pack, file.contextPath, file.storedPath, file.size);
      }
      pack.finalize();
    } catch (error) {
      pack.destroy(new Error(getErrorMessage(error)));
    }
  }

  private async persistUpload(
    stream: Readable,
    originalName: string,
    contextPath: string,
    isRejected: () => boolean,
  ) {
    const directory = await this.contextDirectory();
    const storedPath = join(directory, `${randomUUID()}.context`);
    const hash = createHash('sha256');
    const maxUploadBytes = this.maxUploadBytes;
    let sizeBytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.length;
        if (sizeBytes > maxUploadBytes) {
          callback(
            new ConflictException(
              'Build context file exceeds the 64 MB limit.',
            ),
          );
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(storedPath, { flags: 'wx' }),
      );
      if (isRejected()) {
        throw new ConflictException('Build context file exceeds the 64 MB limit.');
      }
      const sha256 = hash.digest('hex');
      return this.files.save(
        this.files.create({
          originalName,
          contextPath,
          storedPath,
          sizeBytes,
          sha256,
        }),
      );
    } catch (error) {
      await unlink(storedPath).catch(() => undefined);
      throw error;
    }
  }

  private async addBuffer(pack: tar.Pack, name: string, content: Buffer) {
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        { name, mode: 0o644, size: content.length, type: 'file' },
        content,
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private async addFile(
    pack: tar.Pack,
    name: string,
    filePath: string,
    size: number,
  ) {
    await new Promise<void>((resolve, reject) => {
      const entry = pack.entry(
        { name, mode: 0o644, size, type: 'file' },
        (error) => (error ? reject(error) : resolve()),
      );
      const source = createReadStream(filePath);
      source.on('error', (error) => {
        entry.destroy(error);
        reject(error);
      });
      entry.on('error', reject);
      source.pipe(entry);
    });
  }

  private async contextDirectory() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const directory = join(uploadsDir, 'image-build-context');
    await mkdir(directory, { recursive: true });
    return directory;
  }
}

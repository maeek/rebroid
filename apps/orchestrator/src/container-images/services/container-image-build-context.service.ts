import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Busboy from 'busboy';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { In, Repository } from 'typeorm';
import {
  type MultipartUploadRequest,
  assertMultipartUpload,
} from '../../common/http-upload';
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

  private async contextDirectory() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const directory = join(uploadsDir, 'image-build-context');
    await mkdir(directory, { recursive: true });
    return directory;
  }
}

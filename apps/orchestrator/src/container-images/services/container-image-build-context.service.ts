import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { writeHashedUpload } from '../../common/write-hashed-upload';
import { In, Repository } from 'typeorm';
import {
  type MultipartUploadRequest,
  consumeSingleFileUpload,
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
    if (file) {
      await rm(file.storedPath, { force: true });
      await this.files.delete(id);
    }
    return { id, removed: true };
  }

  consumeUpload(request: MultipartUploadRequest, contextPath: string) {
    const sanitizedPath = sanitizeBuildContextPath(contextPath);
    return consumeSingleFileUpload({
      request,
      fieldName: 'file',
      maxBytes: this.maxUploadBytes,
      missingError: () =>
        new ConflictException('A build context file is required.'),
      limitError: () => this.limitError(),
      canceledError: () =>
        new ConflictException('Build context upload was cancelled.'),
      consume: (stream, originalName, limitExceeded) =>
        this.persistUpload(
          stream,
          originalName || 'context-file',
          sanitizedPath,
          limitExceeded,
        ),
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
    try {
      const { sha256, sizeBytes } = await writeHashedUpload(
        stream,
        storedPath,
        this.maxUploadBytes,
        () => this.limitError(),
      );
      if (isRejected()) throw this.limitError();
      return await this.files.save(
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

  private limitError() {
    return new ConflictException(
      `Build context file exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
    );
  }

  private async contextDirectory() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const directory = join(uploadsDir, 'image-build-context');
    await mkdir(directory, { recursive: true });
    return directory;
  }
}

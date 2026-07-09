import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  resolveRuntimeImageMetadata,
  type RuntimeImageMetadata,
} from '@rebroid/application-core/redroid-runtime';
import { PlatformImage } from '../../docker.types';
import { ContainerImageRuntimeMetadata } from '../entities/container-image-runtime-metadata.entity';
import type {
  DockerImageRuntimeMetadataPort,
  ResolvedRuntimeImageMetadata,
  UpsertRuntimeImageMetadataInput,
} from '../../contracts/docker-image-runtime-metadata.port';

const cleanNullable = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

@Injectable()
export class DockerImageRuntimeMetadataService implements DockerImageRuntimeMetadataPort {
  constructor(
    @InjectRepository(ContainerImageRuntimeMetadata)
    private readonly metadata: Repository<ContainerImageRuntimeMetadata>,
  ) {}

  async upsert(input: UpsertRuntimeImageMetadataInput) {
    const imageRef = input.imageRef.trim();
    const record = this.metadata.create({
      imageRef,
      imageId: cleanNullable(input.imageId),
      runtimeKind: input.runtimeKind,
      androidVersion: cleanNullable(input.androidVersion),
      architecture: cleanNullable(input.architecture),
      gmsMode: input.gmsMode,
      signatureSpoofing: input.signatureSpoofing,
    });
    await this.metadata.save(record);
    return record;
  }

  async findByReferences(references: string[]) {
    const normalized = [
      ...new Set(references.map((ref) => ref.trim()).filter(Boolean)),
    ];
    if (!normalized.length) {
      return null;
    }

    const records = await this.findRecordsByReferences(normalized);
    return this.preferredRecord(records, normalized);
  }

  async resolveForReference(
    image: string,
    options: {
      imageId?: string | null;
      labels?: Record<string, string | undefined> | null;
    } = {},
  ): Promise<ResolvedRuntimeImageMetadata> {
    const stored = await this.findByReferences([
      image,
      ...(options.imageId ? [options.imageId] : []),
    ]);

    return resolveRuntimeImageMetadata({
      image,
      labels: options.labels,
      metadata: stored ? this.toRuntimeMetadata(stored) : null,
    });
  }

  async enrichPlatformImages(images: PlatformImage[]) {
    const references = images.flatMap((image) =>
      this.referencesForImage(image),
    );
    const records = await this.findRecordsByReferences(references);
    const recordsByReference = new Map<string, ContainerImageRuntimeMetadata>();
    for (const record of records) {
      recordsByReference.set(record.imageRef, record);
      if (record.imageId) recordsByReference.set(record.imageId, record);
    }
    return images.map((image) => {
      const imageReferences = this.referencesForImage(image);
      const stored =
        imageReferences
          .map((reference) => recordsByReference.get(reference))
          .find(Boolean) ?? null;
      const resolved = resolveRuntimeImageMetadata({
        image: image.repoTags[0] ?? image.id,
        labels: image.labels,
        metadata: stored ? this.toRuntimeMetadata(stored) : null,
      });
      return {
        ...image,
        runtimeMetadata: resolved.metadata,
        runtimeMetadataSource: resolved.source,
      };
    });
  }

  async enrichPlatformImage(image: PlatformImage): Promise<PlatformImage> {
    const stored = await this.findByReferences(this.referencesForImage(image));
    const resolved = resolveRuntimeImageMetadata({
      image: image.repoTags[0] ?? image.id,
      labels: image.labels,
      metadata: stored ? this.toRuntimeMetadata(stored) : null,
    });

    return {
      ...image,
      runtimeMetadata: resolved.metadata,
      runtimeMetadataSource: resolved.source,
    };
  }

  toRuntimeMetadata(
    record: ContainerImageRuntimeMetadata,
  ): RuntimeImageMetadata {
    return {
      runtimeKind: record.runtimeKind,
      androidVersion: record.androidVersion,
      architecture: record.architecture,
      gmsMode: record.gmsMode,
      signatureSpoofing: record.signatureSpoofing,
    };
  }

  private referencesForImage(image: PlatformImage) {
    return [image.id, image.shortId, ...image.repoTags, ...image.repoDigests];
  }

  private findRecordsByReferences(references: string[]) {
    const normalized = [
      ...new Set(references.map((ref) => ref.trim()).filter(Boolean)),
    ];
    if (!normalized.length) {
      return Promise.resolve([]);
    }
    return this.metadata.find({
      where: [{ imageRef: In(normalized) }, { imageId: In(normalized) }],
    });
  }

  private preferredRecord(
    records: ContainerImageRuntimeMetadata[],
    references: string[],
  ) {
    if (!records.length) {
      return null;
    }

    for (const ref of references) {
      const record = records.find(
        (candidate) => candidate.imageRef === ref || candidate.imageId === ref,
      );
      if (record) {
        return record;
      }
    }

    return records[0];
  }
}

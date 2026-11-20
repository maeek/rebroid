import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  resolveRuntimeImageMetadata,
  type RuntimeImageMetadata,
} from '@rebroid/android-application-core/redroid-runtime';
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

  async resolveForReference(
    image: string,
    options: {
      imageId?: string | null;
      labels?: Record<string, string | undefined> | null;
    } = {},
  ): Promise<ResolvedRuntimeImageMetadata> {
    const references = [image, ...(options.imageId ? [options.imageId] : [])];
    const lookup = await this.loadMetadata(references);

    return resolveRuntimeImageMetadata({
      image,
      labels: options.labels,
      metadata: lookup(references),
    });
  }

  async enrichPlatformImages(images: PlatformImage[]) {
    const references = images.map((image) => this.referencesForImage(image));
    const lookup = await this.loadMetadata(references.flat());
    return images.map((image, index) =>
      this.enrichImage(image, lookup(references[index])),
    );
  }

  async enrichPlatformImage(image: PlatformImage, requestedRef?: string) {
    const references = this.referencesForImage(image, requestedRef);
    const lookup = await this.loadMetadata(references);
    return this.enrichImage(image, lookup(references));
  }

  private enrichImage(
    image: PlatformImage,
    metadata: RuntimeImageMetadata | null,
  ) {
    const resolved = resolveRuntimeImageMetadata({
      image: image.repoTags[0] ?? image.id,
      labels: image.labels,
      metadata,
    });
    return {
      ...image,
      runtimeMetadata: resolved.metadata,
      runtimeMetadataSource: resolved.source,
    };
  }

  private referencesForImage(image: PlatformImage, requestedRef?: string) {
    return [
      ...(requestedRef ? [requestedRef] : []),
      image.id,
      image.shortId,
      ...image.repoTags,
      ...image.repoDigests,
    ];
  }

  private async loadMetadata(references: string[]) {
    const normalized = [
      ...new Set(references.map((ref) => ref.trim()).filter(Boolean)),
    ];
    const records = normalized.length
      ? await this.metadata
          .createQueryBuilder('metadata')
          .addCommonTableExpression(
            'SELECT value FROM json_each(:references)',
            'image_references',
          )
          .where(
            `metadata.imageRef IN (SELECT value FROM image_references)
              OR metadata.imageId IN (SELECT value FROM image_references)`,
            { references: JSON.stringify(normalized) },
          )
          .getMany()
      : [];
    const byReference = new Map<string, ContainerImageRuntimeMetadata>();
    const byImageId = new Map<string, ContainerImageRuntimeMetadata>();
    for (const record of records) {
      byReference.set(record.imageRef, record);
      if (!record.imageId) continue;
      const existing = byImageId.get(record.imageId);
      // Multiple references can share an ID. Use a stable tie-break independent of row order.
      if (!existing || record.imageRef < existing.imageRef) {
        byImageId.set(record.imageId, record);
      }
    }
    return (orderedReferences: string[]): RuntimeImageMetadata | null => {
      for (const reference of orderedReferences) {
        const key = reference.trim();
        const record = byReference.get(key) ?? byImageId.get(key);
        if (record) {
          const {
            runtimeKind,
            androidVersion,
            architecture,
            gmsMode,
            signatureSpoofing,
          } = record;
          return {
            runtimeKind,
            androidVersion,
            architecture,
            gmsMode,
            signatureSpoofing,
          };
        }
      }
      return null;
    };
  }
}

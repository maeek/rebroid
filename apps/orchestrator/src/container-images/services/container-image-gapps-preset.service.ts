import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, statfs } from 'node:fs/promises';
import { freemem } from 'node:os';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../docker/contracts/docker-resource-runtime.port';
import { supportedGappsAndroidVersions } from '../dto/gapps-build.dto';
import type {
  GappsBuildPresetDto,
  GappsBuildPresetsResponseDto,
  SupportedGappsAndroidVersion,
} from '../dto/gapps-build.dto';

const gibibyte = 1024 ** 3;
const requiredDiskBytes = 10 * gibibyte;
const requiredMemoryBytes = 3 * gibibyte;
const recommendedCpuCount = 2;

const sourceUrl = 'https://gitlab.com/MindTheGapps/vendor_gapps';
const sourceBranches: Record<SupportedGappsAndroidVersion, string> = {
  '16': 'baklava',
  '15': 'vic',
  '14': 'upsilon',
  '13': 'tau',
};

@Injectable()
export class ContainerImageGappsPresetService {
  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
  ) {}

  getPreset(version: string | null): GappsBuildPresetDto {
    const androidVersion = supportedGappsAndroidVersions.find(
      (supported) => supported === version,
    );
    if (!androidVersion)
      throw new Error(`Unsupported Android version for GApps: ${version}.`);
    const sourceBranch = sourceBranches[androidVersion];
    return {
      androidVersion,
      baseImage: `redroid/redroid:${androidVersion}.0.0-latest`,
      sourceRepository: `${sourceUrl}.git`,
      sourceBranch,
      sourceLink: `${sourceUrl}/-/tree/${sourceBranch}`,
      defaultTargetImage: `local/redroid-gapps:${androidVersion}`,
    };
  }

  async list(): Promise<GappsBuildPresetsResponseDto> {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    await mkdir(uploadsDir, { recursive: true });
    const [filesystem, capacity] = await Promise.all([
      statfs(uploadsDir),
      this.resources.hostCapacity(),
    ]);
    const diskAvailableBytes = filesystem.bavail * filesystem.bsize;
    const memoryAvailableBytes = Math.min(capacity.memoryBytes ?? 0, freemem());
    const cpuCount = capacity.cpuCores ?? 0;
    const diskRequirementMet = diskAvailableBytes >= requiredDiskBytes;
    const memoryRequirementMet = memoryAvailableBytes >= requiredMemoryBytes;
    const cpuRecommendationMet = cpuCount >= recommendedCpuCount;
    const messages: string[] = [];
    if (!diskRequirementMet) {
      messages.push('At least 10 GB of free storage is required.');
    }
    if (!memoryRequirementMet) {
      messages.push('At least 3 GB of available Docker memory is required.');
    }
    if (!cpuRecommendationMet) {
      messages.push(
        'Two CPUs are recommended, but this does not block builds.',
      );
    }
    if (messages.length === 0) {
      messages.push('Ready to build. Recommended: 4 GB RAM and 2 CPUs.');
    }

    return {
      presets: supportedGappsAndroidVersions.map((version) =>
        this.getPreset(version),
      ),
      resources: {
        canBuild: diskRequirementMet && memoryRequirementMet,
        diskAvailableBytes,
        memoryAvailableBytes,
        cpuCount,
        diskRequirementMet,
        memoryRequirementMet,
        cpuRecommendationMet,
        messages,
      },
    };
  }
}

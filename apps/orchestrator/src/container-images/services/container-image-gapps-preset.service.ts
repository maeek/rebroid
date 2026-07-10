import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, statfs } from 'node:fs/promises';
import { freemem } from 'node:os';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../docker/contracts/docker-engine.port';
import type {
  GappsBuildPresetDto,
  GappsBuildPresetsResponseDto,
  SupportedGappsAndroidVersion,
} from '../dto/gapps-build.dto';

const gibibyte = 1024 ** 3;
const requiredDiskBytes = 10 * gibibyte;
const requiredMemoryBytes = 3 * gibibyte;
const recommendedCpuCount = 2;

const presets: Record<SupportedGappsAndroidVersion, GappsBuildPresetDto> = {
  '14': {
    androidVersion: '14',
    baseImage: 'redroid/redroid:14.0.0-latest',
    sourceBranch: 'upsilon',
    sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
    sourceLink: 'https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/upsilon',
    defaultTargetImage: 'local/redroid-gapps:14',
  },
  '13': {
    androidVersion: '13',
    baseImage: 'redroid/redroid:13.0.0-latest',
    sourceBranch: 'tau',
    sourceRepository: 'https://gitlab.com/MindTheGapps/vendor_gapps.git',
    sourceLink: 'https://gitlab.com/MindTheGapps/vendor_gapps/-/tree/tau',
    defaultTargetImage: 'local/redroid-gapps:13',
  },
};

@Injectable()
export class ContainerImageGappsPresetService {
  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_ENGINE) private readonly engine: DockerEnginePort,
  ) {}

  getPreset(androidVersion: SupportedGappsAndroidVersion) {
    return presets[androidVersion];
  }

  async list(): Promise<GappsBuildPresetsResponseDto> {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    await mkdir(uploadsDir, { recursive: true });
    const [filesystem, engineInfo] = await Promise.all([
      statfs(uploadsDir),
      this.engine.info(),
    ]);
    const diskAvailableBytes = filesystem.bavail * filesystem.bsize;
    const memoryAvailableBytes = Math.min(engineInfo.MemTotal ?? 0, freemem());
    const cpuCount = engineInfo.NCPU ?? 0;
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
      presets: [presets['14'], presets['13']],
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

import { AndroidApplicationLifecycleStage } from '../../contracts/android-application-status';
import { AndroidImagePullProgress } from '../../android-application.entity';

const pullProgressPattern =
  /^(.+?)(?:\s+\[[^\]]*\])?\s+(\d+(?:\.\d+)?)([kmgt]?b)\/(\d+(?:\.\d+)?)([kmgt]?b)(?:\s+([a-z0-9:_-]+))?$/i;

const sizeMultipliers: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

export const isStartupCommandFinishedMessage = (message: string) =>
  message.toLowerCase().includes('completed immediately') ||
  message.toLowerCase().includes('plain images such as ubuntu');

export const extractExitCode = (message: string) => {
  const match = message.match(/exit code (\d+)/i);
  return match ? Number(match[1]) : null;
};

export const parseImagePullProgress = (
  statusMessage: string | null,
  lifecycleStage: AndroidApplicationLifecycleStage,
): AndroidImagePullProgress | null => {
  if (
    lifecycleStage !== AndroidApplicationLifecycleStage.ImagePulling ||
    !statusMessage
  ) {
    return null;
  }

  const match = statusMessage.trim().match(pullProgressPattern);

  if (!match) {
    return null;
  }

  const [, status, currentRaw, currentUnit, totalRaw, totalUnit, layerId] =
    match;
  const currentBytes = toBytes(Number(currentRaw), currentUnit);
  const totalBytes = toBytes(Number(totalRaw), totalUnit);

  if (
    !Number.isFinite(currentBytes) ||
    !Number.isFinite(totalBytes) ||
    totalBytes <= 0
  ) {
    return null;
  }

  return {
    status: status.trim(),
    current: `${currentRaw} ${formatUnit(currentUnit)}`,
    total: `${totalRaw} ${formatUnit(totalUnit)}`,
    layerId: layerId?.trim() || null,
    percent: Math.min(100, Math.max(0, (currentBytes / totalBytes) * 100)),
  };
};

const formatUnit = (unit: string) => unit.trim().toUpperCase();

const toBytes = (value: number, unit: string) => {
  const normalizedUnit = unit.trim().toLowerCase();
  const multiplier = sizeMultipliers[normalizedUnit];

  if (!multiplier) {
    return Number.NaN;
  }

  return value * multiplier;
};

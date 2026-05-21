import { parseCommandLine } from '../../../docker/docker.utils';

export const redroidDefaultContainerArgs = [
  'androidboot.redroid_gpu_mode=guest',
  'androidboot.use_memfd=true',
  'ro.secure=0',
  'ro.debuggable=1',
  'androidboot.redroid_width=1080',
  'androidboot.redroid_height=1920',
  'androidboot.redroid_dpi=420',
  'androidboot.redroid_fps=60',
];

export const isRedroidImageName = (image: string) => {
  const normalized = image.trim().toLowerCase();
  return (
    normalized === 'redroid' ||
    normalized.startsWith('redroid/') ||
    normalized.includes('/redroid/')
  );
};

export const applyRedroidDefaultContainerArgs = (
  image: string,
  containerArgs?: string | null,
) => {
  const trimmedArgs = containerArgs?.trim();
  if (!isRedroidImageName(image)) {
    return trimmedArgs || null;
  }

  const userArgs = parseCommandLine(trimmedArgs) ?? [];
  const userKeys = new Set(
    userArgs
      .map((arg) => arg.split('=')[0]?.trim())
      .filter((key): key is string => Boolean(key)),
  );
  const missingDefaults = redroidDefaultContainerArgs.filter(
    (arg) => !userKeys.has(arg.split('=')[0]),
  );

  return [...missingDefaults, ...userArgs].join(' ') || null;
};

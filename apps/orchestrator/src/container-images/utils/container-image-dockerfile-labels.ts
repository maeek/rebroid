import { ConflictException } from '@nestjs/common';
import {
  runtimeImageLabelKeys,
  type RuntimeImageMetadata,
} from '@rebroid/application-core/redroid-runtime';

export const requiredRuntimeImageLabels = (
  metadata: RuntimeImageMetadata,
): Record<string, string> => ({
  [runtimeImageLabelKeys.managed]: 'true',
  [runtimeImageLabelKeys.runtimeKind]: metadata.runtimeKind,
  [runtimeImageLabelKeys.androidVersion]: metadata.androidVersion ?? '',
  [runtimeImageLabelKeys.architecture]: metadata.architecture ?? '',
  [runtimeImageLabelKeys.gmsMode]: metadata.gmsMode,
  [runtimeImageLabelKeys.signatureSpoofing]: metadata.signatureSpoofing,
});

export const dockerfileWithRequiredLabels = (
  dockerfile: string,
  labels: Record<string, string>,
) => {
  rejectContradictoryLabels(dockerfile, labels);
  return `${dockerfile.trimEnd()}\n\n${labelInstruction(labels)}\n`;
};

const labelInstruction = (labels: Record<string, string>) => {
  const entries = Object.entries(labels).map(
    ([key, value]) => `${key}="${escapeLabelValue(value)}"`,
  );
  return `LABEL ${entries.join(' \\\n      ')}`;
};

const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const rejectContradictoryLabels = (
  dockerfile: string,
  requiredLabels: Record<string, string>,
) => {
  for (const [key, value] of readDockerfileLabels(dockerfile)) {
    const required = requiredLabels[key];
    if (required !== undefined && required !== value) {
      throw new ConflictException(
        `Dockerfile label ${key} must be ${JSON.stringify(required)}.`,
      );
    }
  }
};

const readDockerfileLabels = (dockerfile: string) => {
  const labels = new Map<string, string>();
  for (const line of dockerfileLogicalLines(dockerfile)) {
    const match = line.match(/^\s*LABEL\s+(.+)$/i);
    if (!match) {
      continue;
    }

    const body = match[1] ?? '';
    for (const assignment of body.matchAll(
      /([A-Za-z0-9_.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g,
    )) {
      const key = assignment[1];
      const value = assignment[2] ?? assignment[3] ?? assignment[4] ?? '';
      labels.set(key, value);
    }
  }

  return labels;
};

const dockerfileLogicalLines = (dockerfile: string) => {
  const lines: string[] = [];
  let current = '';
  for (const line of dockerfile.split(/\r?\n/)) {
    const trimmedEnd = line.trimEnd();
    if (trimmedEnd.endsWith('\\')) {
      current += `${trimmedEnd.slice(0, -1)} `;
      continue;
    }

    lines.push(`${current}${line}`);
    current = '';
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

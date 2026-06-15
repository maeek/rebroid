import { z } from 'zod';
import { applicationViewerControlCommands } from '../../android-apps/viewer/dto/application-viewer-control.dto';

export const timeoutSchema = z
  .number()
  .int()
  .min(100)
  .max(120_000)
  .optional()
  .default(10_000);

export const viewerCommandSchema = z.object({
  command: z.enum(applicationViewerControlCommands),
});

export const rotateSchema = z.object({
  orientation: z.enum([
    'portrait',
    'landscape',
    'reverse-portrait',
    'reverse-landscape',
  ]),
});

export const tapSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const tapNormalizedSchema = normalizedPointSchema;

export const swipeSchema = z.object({
  x1: z.number().int().min(0),
  y1: z.number().int().min(0),
  x2: z.number().int().min(0),
  y2: z.number().int().min(0),
  durationMs: z.number().int().min(50).max(5_000).optional().default(300),
});

const swipeNormalizedNestedSchema = z.object({
  start: normalizedPointSchema,
  end: normalizedPointSchema,
  durationMs: z.number().int().min(50).max(5_000).optional().default(300),
});

export const swipeNormalizedSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  if ('start' in record || 'end' in record) {
    return value;
  }
  if (
    !('startX' in record) ||
    !('startY' in record) ||
    !('endX' in record) ||
    !('endY' in record)
  ) {
    return value;
  }
  return {
    start: { x: record.startX, y: record.startY },
    end: { x: record.endX, y: record.endY },
    durationMs: record.durationMs,
  };
}, swipeNormalizedNestedSchema);

export const textSchema = z.object({
  text: z.string().max(20_000),
});

export const keySchema = z.object({
  key: z.string().min(1).max(80),
});

export const screenshotSchema = z.object({});

export const emptyInputSchema = z.object({});

export const packageNameSchema = z.object({
  packageName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/, {
      message: 'Package name must be a valid Android package identifier.',
    }),
  timeoutMs: timeoutSchema,
});

export const openSystemSettingsSchema = z.object({
  screen: z.enum(['main']).optional().default('main'),
  timeoutMs: timeoutSchema,
});

export const listPackagesSchema = z.object({
  query: z.string().trim().max(120).optional().default(''),
  includeSystem: z.boolean().optional().default(false),
  maxResults: z.number().int().min(1).max(200).optional().default(50),
  timeoutMs: timeoutSchema,
});

export const waitSchema = z.object({
  durationMs: z.number().int().min(1).max(120_000),
});

export const textWaitSchema = z.object({
  text: z.string().min(1).max(500),
  timeoutMs: timeoutSchema,
  intervalMs: z.number().int().min(250).max(10_000).optional().default(1_000),
});

export const shellSchema = z.object({
  command: z.string().min(1).max(4_000),
  timeoutMs: z.number().int().min(100).max(120_000).optional().default(15_000),
});

export const androidSettingSchema = z.object({
  namespace: z.enum(['system', 'secure', 'global']),
  key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9_.:-]+$/, {
      message: 'Setting key contains unsupported characters.',
    }),
  timeoutMs: timeoutSchema,
});

export const remotePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith('/'), {
    message: 'Path must be absolute.',
  });

export const fileSchema = z.object({
  path: remotePathSchema,
});

export const filePushSchema = z.object({
  path: remotePathSchema,
  contentBase64: z.string().min(1).max(8_000_000),
});

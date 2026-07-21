import { z } from 'zod';

const optionalInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).optional();

const optionalNumber = (minimum: number, maximum: number) =>
  z.coerce.number().min(minimum).max(maximum).optional();

export const orchestratorEnvironmentSchema = z.object({
  PORT: optionalInteger(1, 65_535),
  DOCKER_STOPPING_STALE_TIMEOUT_SECONDS: optionalInteger(1, 86_400),
  DOCKER_REQUEST_TIMEOUT_MS: optionalInteger(1, 300_000),
  DOCKER_SLOW_REQUEST_WARNING_MS: optionalInteger(1, 300_000),
  DOCKER_MAX_CONCURRENT_READS: optionalInteger(1, 64),
  DOCKER_LONG_OPERATION_TIMEOUT_MS: optionalInteger(1, 86_400_000),
  DOCKER_MAX_CONCURRENT_LONG_OPERATIONS: optionalInteger(1, 32),
  MAX_CONCURRENT_LIFECYCLE_JOBS: optionalInteger(1, 32),
  REDROID_ADB_PORT: optionalInteger(1, 65_535),
  REDROID_BOOT_TIMEOUT_SECONDS: optionalInteger(1, 3_600),
  REDROID_ADB_TIMEOUT_SECONDS: optionalInteger(1, 3_600),
  REDROID_PROVISIONING_STALE_TIMEOUT_SECONDS: optionalInteger(1, 86_400),
  DEFAULT_INACTIVITY_TIMEOUT_SECONDS: optionalInteger(-1, 86_400),
  MAX_APK_UPLOAD_SIZE_MB: optionalInteger(1, 512),
  DISPLAY_SIDECAR_PORT: optionalInteger(1, 65_535),
  DISPLAY_SIDECAR_PUBLISHED_HOST_PORT: optionalInteger(0, 65_535),
  OCR_SIDECAR_BASE_URL: z.string().url().optional(),
  OCR_TIMEOUT_MS: optionalInteger(100, 120_000),
  OCR_MAX_IMAGE_DIMENSION: optionalInteger(320, 4096),
  OCR_MIN_CONFIDENCE: optionalNumber(0, 1),
  OCR_LANGUAGE: z.string().trim().min(1).max(16).optional(),
  ENABLE_API_DOCS: z.enum(['true', 'false']).optional(),
  FIREWALL_POLICY_BOOTSTRAP: z.enum(['true', 'false']).optional(),
  GAPPS_PATCHER_IMAGE: z.string().min(1).optional(),
  GAPPS_PATCHER_BUILD_CONTEXT: z.string().min(1).optional(),
  DISPLAY_WEBRTC_UDP_PORT_RANGE: z
    .string()
    .regex(
      /^\d{1,5}-\d{1,5}$/,
      'Expected a UDP port range such as 40000-40100.',
    )
    .refine((value) => {
      const [first, last] = value.split('-').map(Number);
      return first >= 1 && first <= last && last <= 65_535;
    }, 'UDP port range must be ordered and contain valid ports.')
    .optional(),
});

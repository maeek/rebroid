import { registerAs } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const optionalInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).optional();

const optionalNumber = (minimum: number, maximum: number) =>
  z.coerce.number().min(minimum).max(maximum).optional();

const environmentSchema = z.object({
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
  OCR_ENABLED: z.enum(['true', 'false']).optional(),
  OCR_SIDECAR_BASE_URL: z.string().url().optional(),
  OCR_TIMEOUT_MS: optionalInteger(100, 120_000),
  OCR_MAX_IMAGE_DIMENSION: optionalInteger(320, 4096),
  OCR_MIN_CONFIDENCE: optionalNumber(0, 1),
  OCR_LANGUAGES: z.string().optional(),
  ENABLE_API_DOCS: z.enum(['true', 'false']).optional(),
  FIREWALL_POLICY_BOOTSTRAP: z.enum(['true', 'false']).optional(),
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

const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Expected a boolean environment value, received "${value}".`);
};

const number = (value: string | undefined, fallback: number) => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csv = (value: string | undefined, fallback: string[]) => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default registerAs('app', () => {
  environmentSchema.parse(process.env);
  const uploadsDir = process.env.UPLOADS_DIR ?? './uploads';
  const databasePath =
    process.env.DATABASE_PATH ?? './data/orchestrator.sqlite';
  const settingsPath =
    process.env.SETTINGS_PATH ?? './data/orchestrator-settings.json';
  const runtimeLogsDir = process.env.RUNTIME_LOGS_DIR ?? './data/runtime-logs';
  const sharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim();
  const resourcePrefix = process.env.DOCKER_RESOURCE_PREFIX ?? 'rebroid';
  const defaultDisplaySidecarBuildContext = existsSync('/app/display-sidecar')
    ? '/app/display-sidecar'
    : '../display-sidecar';
  const displaySidecarContainerName =
    process.env.DISPLAY_SIDECAR_CONTAINER_NAME ??
    `${resourcePrefix}-display-sidecar`;
  const displaySidecarPort = number(process.env.DISPLAY_SIDECAR_PORT, 8000);

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    enableApiDocs:
      (process.env.NODE_ENV ?? 'development') !== 'production' ||
      process.env.ENABLE_API_DOCS === 'true',
    port: number(process.env.PORT, 4100),
    sharedSecret: sharedSecret || undefined,
    corsOrigins: csv(process.env.ORCHESTRATOR_CORS_ORIGINS, []),
    databasePath: resolve(databasePath),
    settingsPath: resolve(settingsPath),
    runtimeLogsDir: resolve(runtimeLogsDir),
    uploadsDir: resolve(uploadsDir),
    docker: {
      socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
      resourcePrefix,
      orchestratorContainerId:
        process.env.ORCHESTRATOR_CONTAINER_ID ||
        process.env.HOSTNAME ||
        undefined,
      stoppingStaleTimeoutSeconds: number(
        process.env.DOCKER_STOPPING_STALE_TIMEOUT_SECONDS,
        60,
      ),
      requestTimeoutMs: number(process.env.DOCKER_REQUEST_TIMEOUT_MS, 60_000),
      slowRequestWarningMs: number(
        process.env.DOCKER_SLOW_REQUEST_WARNING_MS,
        5_000,
      ),
      maxConcurrentReads: number(process.env.DOCKER_MAX_CONCURRENT_READS, 8),
      longOperationTimeoutMs: number(
        process.env.DOCKER_LONG_OPERATION_TIMEOUT_MS,
        1_800_000,
      ),
      maxConcurrentLongOperations: number(
        process.env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS,
        4,
      ),
    },
    lifecycle: {
      maxConcurrentJobs: number(process.env.MAX_CONCURRENT_LIFECYCLE_JOBS, 4),
    },
    firewallAgent: {
      socketPath:
        process.env.FIREWALL_AGENT_SOCKET ?? '/run/rebroid-firewall/agent.sock',
      sharedSecret:
        process.env.FIREWALL_AGENT_SHARED_SECRET || sharedSecret || '',
    },
    networkPolicy: {
      apiHost:
        process.env.NETWORK_POLICY_API_HOST ||
        process.env.ORCHESTRATOR_API_HOST ||
        undefined,
      apiCidrs: csv(process.env.NETWORK_POLICY_API_CIDRS, []),
      bootstrap: bool(process.env.FIREWALL_POLICY_BOOTSTRAP, true),
      defaultAllowDestinations: csv(
        process.env.NETWORK_POLICY_DEFAULT_ALLOW_DESTINATIONS,
        ['API_IP', 'GATEWAY_IP'],
      ),
    },
    container: {
      image: process.env.CONTAINER_IMAGE ?? 'redroid/redroid:14.0.0-latest',
    },
    redroid: {
      dataMountPath: process.env.REDROID_DATA_MOUNT_PATH ?? '/data',
      adbPort: number(process.env.REDROID_ADB_PORT, 5555),
      privileged: bool(process.env.REDROID_PRIVILEGED, true),
      bootTimeoutSeconds: number(process.env.REDROID_BOOT_TIMEOUT_SECONDS, 300),
      adbTimeoutSeconds: number(process.env.REDROID_ADB_TIMEOUT_SECONDS, 120),
      cgroupnsMode: process.env.REDROID_CGROUPNS_MODE ?? 'private',
      provisioningStaleTimeoutSeconds: number(
        process.env.REDROID_PROVISIONING_STALE_TIMEOUT_SECONDS,
        600,
      ),
      defaultInactivityTimeoutSeconds: number(
        process.env.DEFAULT_INACTIVITY_TIMEOUT_SECONDS,
        900,
      ),
      maxApkUploadSizeMb: number(
        process.env.MAX_APK_UPLOAD_SIZE_MB ?? '100',
        512,
      ),
      securityOptions: csv(process.env.CONTAINER_SECURITY_OPTS, []),
      devices: csv(process.env.REDROID_DEVICES, []),
      optionalDevices: csv(process.env.REDROID_OPTIONAL_DEVICES, [
        '/dev/ashmem:/dev/ashmem:rwm',
      ]),
    },
    displaySidecar: {
      containerId: process.env.DISPLAY_SIDECAR_CONTAINER_ID || undefined,
      containerName: displaySidecarContainerName,
      image:
        process.env.DISPLAY_SIDECAR_IMAGE ?? 'rebroid/display-sidecar:latest',
      buildContext: resolve(
        process.env.DISPLAY_SIDECAR_BUILD_CONTEXT ??
          defaultDisplaySidecarBuildContext,
      ),
      autoStart: bool(process.env.DISPLAY_SIDECAR_AUTO_START, true),
      platformNetwork:
        process.env.DISPLAY_SIDECAR_PLATFORM_NETWORK || undefined,
      port: displaySidecarPort,
      publishedHostPort: number(
        process.env.DISPLAY_SIDECAR_PUBLISHED_HOST_PORT,
        0,
      ),
      internalBaseUrl:
        process.env.DISPLAY_SIDECAR_INTERNAL_BASE_URL ??
        `http://${displaySidecarContainerName}:${displaySidecarPort}`,
      player: process.env.DISPLAY_SIDECAR_PLAYER ?? 'webcodecs',
      proxyRemote: process.env.DISPLAY_SIDECAR_PROXY_REMOTE ?? 'tcp:8886',
      webrtcUdpPortRange:
        process.env.DISPLAY_WEBRTC_UDP_PORT_RANGE ?? '40000-40100',
      webrtcIceHost: process.env.DISPLAY_WEBRTC_ICE_HOST ?? '',
    },
    ocr: {
      enabled: bool(process.env.OCR_ENABLED, true),
      baseUrl: process.env.OCR_SIDECAR_BASE_URL?.replace(/\/$/, '') || '',
      timeoutMs: number(process.env.OCR_TIMEOUT_MS, 15_000),
      maxImageDimension: number(process.env.OCR_MAX_IMAGE_DIMENSION, 1600),
      minConfidence: number(process.env.OCR_MIN_CONFIDENCE, 0.4),
      languages: csv(process.env.OCR_LANGUAGES, ['en']),
    },
  };
});

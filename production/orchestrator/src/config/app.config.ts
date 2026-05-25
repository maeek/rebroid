import { registerAs } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
    port: number(process.env.PORT, 4100),
    sharedSecret: sharedSecret || undefined,
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
      iptablesEnabled: bool(process.env.IPTABLES_POLICY_ENABLED, false),
      iptablesBinary: process.env.IPTABLES_BINARY ?? 'iptables',
      volumeUsageCacheTtlSeconds: number(
        process.env.VOLUME_USAGE_CACHE_TTL_SECONDS,
        300,
      ),
    },
    networkPolicy: {
      apiHost:
        process.env.NETWORK_POLICY_API_HOST ||
        process.env.ORCHESTRATOR_API_HOST ||
        undefined,
      apiCidrs: csv(process.env.NETWORK_POLICY_API_CIDRS, []),
      defaultAllowDestinations: csv(
        process.env.NETWORK_POLICY_DEFAULT_ALLOW_DESTINATIONS,
        ['API_IP', 'GATEWAY_IP'],
      ),
    },
    container: {
      image: process.env.CONTAINER_IMAGE ?? 'redroid/redroid:13.0.0-latest',
    },
    redroid: {
      dataMountPath: process.env.REDROID_DATA_MOUNT_PATH ?? '/data',
      adbPort: number(process.env.REDROID_ADB_PORT, 5555),
      privileged: bool(process.env.REDROID_PRIVILEGED, true),
      defaultInactivityTimeoutSeconds: number(
        process.env.DEFAULT_INACTIVITY_TIMEOUT_SECONDS,
        900,
      ),
      maxApkUploadSizeMb: number(process.env.MAX_APK_UPLOAD_SIZE_MB, 4096),
      securityOptions: csv(process.env.CONTAINER_SECURITY_OPTS, []),
    },
    displaySidecar: {
      containerId: process.env.DISPLAY_SIDECAR_CONTAINER_ID || undefined,
      containerName: displaySidecarContainerName,
      image: process.env.DISPLAY_SIDECAR_IMAGE ?? 'rebroid/display-sidecar:latest',
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
    },
  };
});

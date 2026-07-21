import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  environmentBoolean,
  environmentCsv,
  environmentNumber,
} from './environment-values';

type Environment = NodeJS.ProcessEnv;

export const buildAppConfigSections = (
  env: Environment,
  sharedSecret: string | undefined,
  resourcePrefix: string,
) => ({
  docker: dockerSection(env, resourcePrefix),
  lifecycle: {
    maxConcurrentJobs: environmentNumber(env.MAX_CONCURRENT_LIFECYCLE_JOBS, 4),
  },
  firewallAgent: {
    socketPath: env.FIREWALL_AGENT_SOCKET ?? '/run/rebroid-firewall/agent.sock',
    sharedSecret: env.FIREWALL_AGENT_SHARED_SECRET || sharedSecret || '',
  },
  networkPolicy: networkPolicySection(env),
  container: {
    image: env.CONTAINER_IMAGE ?? 'redroid/redroid:14.0.0-latest',
  },
  redroid: redroidSection(env),
  displaySidecar: displaySidecarSection(env, resourcePrefix),
  gappsPatcher: gappsPatcherSection(env),
  ocr: ocrSection(env),
});

const dockerSection = (env: Environment, resourcePrefix: string) => ({
  socketPath: env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
  resourcePrefix,
  orchestratorContainerId:
    env.ORCHESTRATOR_CONTAINER_ID || env.HOSTNAME || undefined,
  stoppingStaleTimeoutSeconds: environmentNumber(
    env.DOCKER_STOPPING_STALE_TIMEOUT_SECONDS,
    60,
  ),
  requestTimeoutMs: environmentNumber(env.DOCKER_REQUEST_TIMEOUT_MS, 60_000),
  slowRequestWarningMs: environmentNumber(
    env.DOCKER_SLOW_REQUEST_WARNING_MS,
    5_000,
  ),
  maxConcurrentReads: environmentNumber(env.DOCKER_MAX_CONCURRENT_READS, 8),
  longOperationTimeoutMs: environmentNumber(
    env.DOCKER_LONG_OPERATION_TIMEOUT_MS,
    1_800_000,
  ),
  maxConcurrentLongOperations: environmentNumber(
    env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS,
    4,
  ),
});

const networkPolicySection = (env: Environment) => ({
  apiHost:
    env.NETWORK_POLICY_API_HOST || env.ORCHESTRATOR_API_HOST || undefined,
  apiCidrs: environmentCsv(env.NETWORK_POLICY_API_CIDRS, []),
  bootstrap: environmentBoolean(env.FIREWALL_POLICY_BOOTSTRAP, true),
  defaultAllowDestinations: environmentCsv(
    env.NETWORK_POLICY_DEFAULT_ALLOW_DESTINATIONS,
    ['API_IP', 'GATEWAY_IP'],
  ),
});

const redroidSection = (env: Environment) => ({
  dataMountPath: env.REDROID_DATA_MOUNT_PATH ?? '/data',
  adbPort: environmentNumber(env.REDROID_ADB_PORT, 5555),
  privileged: environmentBoolean(env.REDROID_PRIVILEGED, true),
  bootTimeoutSeconds: environmentNumber(env.REDROID_BOOT_TIMEOUT_SECONDS, 300),
  adbTimeoutSeconds: environmentNumber(env.REDROID_ADB_TIMEOUT_SECONDS, 120),
  cgroupnsMode: env.REDROID_CGROUPNS_MODE ?? 'private',
  provisioningStaleTimeoutSeconds: environmentNumber(
    env.REDROID_PROVISIONING_STALE_TIMEOUT_SECONDS,
    600,
  ),
  defaultInactivityTimeoutSeconds: environmentNumber(
    env.DEFAULT_INACTIVITY_TIMEOUT_SECONDS,
    900,
  ),
  maxApkUploadSizeMb: environmentNumber(env.MAX_APK_UPLOAD_SIZE_MB, 100),
  securityOptions: environmentCsv(env.CONTAINER_SECURITY_OPTS, []),
  devices: environmentCsv(env.REDROID_DEVICES, []),
  optionalDevices: environmentCsv(env.REDROID_OPTIONAL_DEVICES, [
    '/dev/ashmem:/dev/ashmem:rwm',
  ]),
});

const displaySidecarSection = (env: Environment, resourcePrefix: string) => {
  const containerName =
    env.DISPLAY_SIDECAR_CONTAINER_NAME ?? `${resourcePrefix}-display-sidecar`;
  const port = environmentNumber(env.DISPLAY_SIDECAR_PORT, 8000);
  const defaultBuildContext = existsSync('/app/display-sidecar')
    ? '/app/display-sidecar'
    : '../display-sidecar';

  return {
    containerId: env.DISPLAY_SIDECAR_CONTAINER_ID || undefined,
    containerName,
    image: env.DISPLAY_SIDECAR_IMAGE ?? 'rebroid/display-sidecar:latest',
    buildContext: resolve(
      env.DISPLAY_SIDECAR_BUILD_CONTEXT ?? defaultBuildContext,
    ),
    autoStart: environmentBoolean(env.DISPLAY_SIDECAR_AUTO_START, true),
    platformNetwork: env.DISPLAY_SIDECAR_PLATFORM_NETWORK || undefined,
    port,
    publishedHostPort: environmentNumber(
      env.DISPLAY_SIDECAR_PUBLISHED_HOST_PORT,
      0,
    ),
    internalBaseUrl:
      env.DISPLAY_SIDECAR_INTERNAL_BASE_URL ??
      `http://${containerName}:${port}`,
    player: env.DISPLAY_SIDECAR_PLAYER ?? 'webcodecs',
    proxyRemote: env.DISPLAY_SIDECAR_PROXY_REMOTE ?? 'tcp:8886',
    webrtcUdpPortRange: env.DISPLAY_WEBRTC_UDP_PORT_RANGE ?? '40000-40100',
    webrtcIceHost: env.DISPLAY_WEBRTC_ICE_HOST ?? '',
  };
};

const gappsPatcherSection = (env: Environment) => {
  const defaultBuildContext = existsSync('/app/gapps-patcher')
    ? '/app/gapps-patcher'
    : '../gapps-patcher';
  return {
    image: env.GAPPS_PATCHER_IMAGE ?? 'rebroid/gapps-patcher:latest',
    buildContext: resolve(
      env.GAPPS_PATCHER_BUILD_CONTEXT ?? defaultBuildContext,
    ),
  };
};

const ocrSection = (env: Environment) => ({
  baseUrl: env.OCR_SIDECAR_BASE_URL?.replace(/\/$/, '') || '',
  timeoutMs: environmentNumber(env.OCR_TIMEOUT_MS, 15_000),
  maxImageDimension: environmentNumber(env.OCR_MAX_IMAGE_DIMENSION, 1600),
  minConfidence: environmentNumber(env.OCR_MIN_CONFIDENCE, 0.4),
  language: env.OCR_LANGUAGE?.trim() || 'en',
});

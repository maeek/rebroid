import { registerAs } from '@nestjs/config';
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

export default registerAs('app', () => {
  const uploadsDir = process.env.UPLOADS_DIR ?? './uploads';
  const databasePath = process.env.DATABASE_PATH ?? './data/orchestrator.sqlite';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: number(process.env.PORT, 4100),
    databasePath: resolve(databasePath),
    uploadsDir: resolve(uploadsDir),
    docker: {
      socketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
      resourcePrefix: process.env.DOCKER_RESOURCE_PREFIX ?? 'sma',
      orchestratorContainerId:
        process.env.ORCHESTRATOR_CONTAINER_ID || process.env.HOSTNAME || undefined,
    },
    redroid: {
      image: process.env.REDROID_IMAGE ?? 'redroid/redroid:13.0.0-latest',
      dataMountPath: process.env.REDROID_DATA_MOUNT_PATH ?? '/data',
      adbPort: number(process.env.REDROID_ADB_PORT, 5555),
      privileged: bool(process.env.REDROID_PRIVILEGED, true),
      defaultInactivityTimeoutSeconds: number(
        process.env.DEFAULT_INACTIVITY_TIMEOUT_SECONDS,
        900,
      ),
    },
  };
});

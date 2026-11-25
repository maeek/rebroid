import { registerAs } from '@nestjs/config';
import { dirname, resolve } from 'node:path';
import { buildAppConfigSections } from './app-config-sections';
import { orchestratorEnvironmentSchema } from './environment-schema';
import { environmentCsv, environmentNumber } from './environment-values';

export default registerAs('app', () => {
  orchestratorEnvironmentSchema.parse(process.env);
  const sharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim();
  const resourcePrefix = process.env.DOCKER_RESOURCE_PREFIX ?? 'rebroid';
  const databasePath = resolve(
    process.env.DATABASE_PATH ?? './data/orchestrator.sqlite',
  );

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    enableApiDocs:
      (process.env.NODE_ENV ?? 'development') !== 'production' ||
      process.env.ENABLE_API_DOCS === 'true',
    port: environmentNumber(process.env.PORT, 4100),
    sharedSecret: sharedSecret || undefined,
    webInternalUrl: process.env.WEB_INTERNAL_URL ?? 'http://localhost:3101',
    externalAdb: {
      configured: Boolean(
        process.env.EXTERNAL_ADB_BROKER_URL &&
        process.env.EXTERNAL_ADB_BROKER_SECRET?.trim(),
      ),
      brokerUrl: process.env.EXTERNAL_ADB_BROKER_URL,
      brokerSecret: process.env.EXTERNAL_ADB_BROKER_SECRET?.trim(),
      tcpEndpoints: environmentCsv(process.env.EXTERNAL_ADB_TCP_ENDPOINTS, []),
    },
    corsOrigins: environmentCsv(process.env.ORCHESTRATOR_CORS_ORIGINS, []),
    databasePath,
    runtimeSnapshotsDir: resolve(dirname(databasePath), 'runtime-snapshots'),
    settingsPath: resolve(
      process.env.SETTINGS_PATH ?? './data/orchestrator-settings.json',
    ),
    runtimeLogsDir: resolve(
      process.env.RUNTIME_LOGS_DIR ?? './data/runtime-logs',
    ),
    uploadsDir: resolve(process.env.UPLOADS_DIR ?? './uploads'),
    ...buildAppConfigSections(process.env, sharedSecret, resourcePrefix),
  };
});

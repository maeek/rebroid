import { registerAs } from '@nestjs/config';
import { resolve } from 'node:path';
import { buildAppConfigSections } from './app-config-sections';
import { orchestratorEnvironmentSchema } from './environment-schema';
import { environmentCsv, environmentNumber } from './environment-values';

export default registerAs('app', () => {
  orchestratorEnvironmentSchema.parse(process.env);
  const sharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim();
  const resourcePrefix = process.env.DOCKER_RESOURCE_PREFIX ?? 'rebroid';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    enableApiDocs:
      (process.env.NODE_ENV ?? 'development') !== 'production' ||
      process.env.ENABLE_API_DOCS === 'true',
    port: environmentNumber(process.env.PORT, 4100),
    sharedSecret: sharedSecret || undefined,
    corsOrigins: environmentCsv(process.env.ORCHESTRATOR_CORS_ORIGINS, []),
    databasePath: resolve(
      process.env.DATABASE_PATH ?? './data/orchestrator.sqlite',
    ),
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

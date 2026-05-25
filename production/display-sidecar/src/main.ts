import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 8000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

it('documents OpenAI billing issues as read-only provider response data', async () => {
  const module = await Test.createTestingModule({
    controllers: [SettingsController],
    providers: [{ provide: SettingsService, useValue: {} }],
  }).compile();
  const app = module.createNestApplication(new FastifyAdapter());
  try {
    app.setGlobalPrefix('api/v1');
    const generated = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const committed = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../packages/orchestrator-contracts/openapi.json',
        ),
        'utf8',
      ),
    ) as typeof generated;
    for (const path of [
      '/api/v1/settings/ai-providers',
      '/api/v1/settings/ai-providers/{providerId}',
    ]) {
      expect(committed.paths[path]).toEqual(generated.paths[path]);
    }
    const schemas = generated.components?.schemas;
    expect(schemas?.CreateAutomationAiProviderDto).not.toHaveProperty(
      'properties.billingIssue',
    );
    expect(schemas?.UpdateAutomationAiProviderDto).not.toHaveProperty(
      'properties.billingIssue',
    );
    for (const name of [
      'OpenAiBillingIssueDto',
      'AutomationAiProviderResponseDto',
    ]) {
      expect(committed.components?.schemas?.[name]).toEqual(schemas?.[name]);
    }
  } finally {
    await app.close();
  }
});

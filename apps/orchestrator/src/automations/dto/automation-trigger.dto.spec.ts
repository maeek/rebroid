import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AutomationTriggerDto,
  CreateAutomationTriggerDto,
  UpdateAutomationTriggerDto,
} from './automation-trigger.dto';

it('publishes the persisted trigger description in create, update, and response contracts', async () => {
  const module = await Test.createTestingModule({}).compile();
  const app = module.createNestApplication(new FastifyAdapter());
  try {
    const generated = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
      {
        extraModels: [
          AutomationTriggerDto,
          CreateAutomationTriggerDto,
          UpdateAutomationTriggerDto,
        ],
      },
    );
    const committed = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../packages/orchestrator-contracts/openapi.json',
        ),
        'utf8',
      ),
    );
    for (const name of [
      'AutomationTriggerDto',
      'CreateAutomationTriggerDto',
      'UpdateAutomationTriggerDto',
    ]) {
      expect(committed.components.schemas[name]).toEqual(
        generated.components?.schemas?.[name],
      );
      expect(
        committed.components.schemas[name].properties.description,
      ).toMatchObject({ type: 'string', nullable: true });
    }
  } finally {
    await app.close();
  }
});

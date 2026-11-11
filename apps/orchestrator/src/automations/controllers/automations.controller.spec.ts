import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from '../services/automations.service';

it('serves draft SSE and exposes the bounded conversation read contract', async () => {
  const fixture = await Test.createTestingModule({
    controllers: [AutomationsController],
    providers: [
      {
        provide: AutomationsService,
        useValue: {
          async *draftYamlEvents() {
            yield {
              type: 'draft.failed',
              message: 'Fixture outcome',
              data: { status: 400 },
            };
          },
          listAdHocAiRunHistory: jest.fn().mockResolvedValue([]),
        },
      },
    ],
  }).compile();
  const app = fixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  try {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(
      doc.paths['/automations/ai/run-history']?.get?.responses?.['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: {
            items: { $ref: '#/components/schemas/AutomationAiRunHistoryDto' },
          },
        },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/automations/draft-yaml/stream',
      payload: { prompt: 'Draft a workflow' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(response.body).toContain('event: draft.failed');
    expect(response.body).toContain('Fixture outcome');
  } finally {
    await app.close();
  }
});

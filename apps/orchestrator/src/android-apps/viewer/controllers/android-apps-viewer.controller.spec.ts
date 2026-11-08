import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AndroidAppsViewerController } from './android-apps-viewer.controller';
import { AndroidAppsViewerService } from '../services/android-apps-viewer.service';

describe('virtual display authorization contract', () => {
  it('documents and forwards explicit capability grants', async () => {
    const createVirtualDisplay = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [AndroidAppsViewerController],
      providers: [
        {
          provide: AndroidAppsViewerService,
          useValue: { createVirtualDisplay },
        },
      ],
    }).compile();
    const app = module.createNestApplication(new FastifyAdapter());
    try {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const operation = doc.paths['/apps/{id}/viewer/displays'].post!;
      expect(operation.parameters).toEqual(
        expect.arrayContaining(
          ['control', 'clipboard', 'screenshot'].map((name) =>
            expect.objectContaining({ name, in: 'query' }),
          ),
        ),
      );
      await module
        .get(AndroidAppsViewerController)
        .createVirtualDisplay('app', 'true', 'false', 'false');
      expect(createVirtualDisplay).toHaveBeenCalledWith('app', {
        control: true,
        clipboard: false,
        screenshot: false,
      });
    } finally {
      await app.close();
    }
  });
});

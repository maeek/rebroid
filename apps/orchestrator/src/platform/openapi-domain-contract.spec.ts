import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type OpenApiOperation = {
  requestBody?: unknown;
  parameters?: unknown;
  responses?: unknown;
};

type OpenApiDocument = {
  paths: Record<string, Partial<Record<string, OpenApiOperation>>>;
  components: { schemas: Record<string, unknown> };
};

const document = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../packages/orchestrator-contracts/openapi.json',
    ),
    'utf8',
  ),
) as OpenApiDocument;

const expectNoRequestBody = (path: string, method: string) => {
  expect(document.paths[path]?.[method]?.requestBody).toBeUndefined();
};

describe('orchestrator OpenAPI domain contract', () => {
  it('exposes the managed device contract and lifecycle routes', () => {
    expect(document.paths['/api/v1/devices']).toBeDefined();
    expect(document.paths['/api/v1/devices']?.post?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/CreateManagedAndroidDeviceDto',
          },
        },
      },
    });
    expect(
      document.components.schemas.CreateManagedAndroidDeviceDto,
    ).toMatchObject({
      properties: { kind: { enum: ['managed'] } },
      required: expect.arrayContaining(['kind', 'name']),
    });
    expect(
      document.paths['/api/v1/devices/{id}/lifecycle/start'],
    ).toBeDefined();
    expect(
      document.paths['/api/v1/devices/{id}/runtime/data-files'],
    ).toBeDefined();
    expect(document.paths['/api/v1/devices/{id}/viewer/session']).toBeDefined();
    expect(document.paths['/api/v1/apps']).toBeUndefined();
    expect(document.paths['/api/v1/android-applications']).toBeUndefined();
  });

  it('exposes platform Docker routes without legacy docker-maintenance paths', () => {
    expect(document.paths['/api/v1/platform/docker/networks']).toBeDefined();
    expect(document.paths['/api/v1/platform/docker/images/{id}']).toBeDefined();
    expect(
      document.paths['/api/v1/platform/display-sidecar/health'],
    ).toBeDefined();
    expect(
      document.paths['/api/v1/docker-maintenance/networks'],
    ).toBeUndefined();
    expect(document.paths['/api/v1/docker/sidecar/health']).toBeUndefined();
  });

  it('exposes an optional expansion flag and a typed sidecar log tail', () => {
    const logs = document.paths['/api/v1/platform/display-sidecar/logs']?.get;
    expect(logs?.parameters).toEqual([
      {
        name: 'expanded',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
      },
    ]);
    expect(logs?.responses).toMatchObject({
      200: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DockerSidecarLogTailDto' },
          },
        },
      },
    });
  });

  it('documents the nullable Docker socket path in diagnostics', () => {
    expect(
      document.paths['/api/v1/metrics/docker']?.get?.responses,
    ).toMatchObject({
      200: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DockerMetricsSnapshotDto' },
          },
        },
      },
    });
    expect(document.components.schemas.DockerMetricsSnapshotDto).toMatchObject({
      properties: { socketPath: { type: 'string', nullable: true } },
      required: expect.arrayContaining(['socketPath']),
    });
  });

  it('does not document request bodies for bodyless mutations', () => {
    expectNoRequestBody('/api/v1/devices/{id}/lifecycle/stop', 'post');
    expectNoRequestBody('/api/v1/devices/{id}/runtime/screenshot', 'post');
    expectNoRequestBody('/api/v1/network-policies/reconcile', 'post');
    expectNoRequestBody('/api/v1/platform/docker/networks/{id}', 'delete');
    expectNoRequestBody('/api/v1/platform/docker/images/{id}', 'delete');
    expectNoRequestBody(
      '/api/v1/platform/display-sidecar/sessions/{id}',
      'delete',
    );
  });

  it('requires the authenticated web account and runtime version for viewer activity', () => {
    const activity =
      document.paths['/api/v1/devices/{id}/viewer/activity']?.post;
    expect(activity?.requestBody).toMatchObject({
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApplicationViewerActivityDto' },
        },
      },
    });
    expect(
      document.components.schemas.ApplicationViewerActivityDto,
    ).toMatchObject({
      required: expect.arrayContaining(['ownerUserId', 'runtimeKey']),
    });
  });

  it('exposes a bodyless runtime recreation command with a conflict response', () => {
    const path = '/api/v1/devices/{id}/lifecycle/recreate';
    expectNoRequestBody(path, 'post');
    expect(document.paths[path]?.post?.responses).toMatchObject({
      200: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApplicationCommandResultDto',
            },
          },
        },
      },
      409: { description: expect.any(String) },
    });
  });

  it.each([
    '/api/v1/devices',
    '/api/v1/devices/{id}/clone',
    '/api/v1/devices/{id}/lifecycle/start',
    '/api/v1/devices/{id}/lifecycle/recreate',
  ])('documents the trusted owner quota for %s', (path) => {
    expect(document.paths[path]?.post?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'x-rebroid-max-open-apps',
        in: 'header',
      }),
    );
  });

  it('documents the trusted egress permission for network policy changes', () => {
    const operation =
      document.paths['/api/v1/devices/{id}/network-policy']?.patch;
    expect(operation?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'x-rebroid-allow-broad-egress',
        in: 'header',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false'],
          default: 'false',
        },
      }),
    );
  });

  it.each(['/api/v1/devices', '/api/v1/devices/{id}/clone'])(
    'documents the trusted image grants for %s',
    (path) => {
      expect(document.paths[path]?.post?.parameters).toContainEqual(
        expect.objectContaining({
          name: 'x-rebroid-image-access',
          in: 'header',
          schema: {
            type: 'string',
            enum: ['none', 'redroid', 'custom', 'all', 'admin'],
          },
        }),
      );
    },
  );
});

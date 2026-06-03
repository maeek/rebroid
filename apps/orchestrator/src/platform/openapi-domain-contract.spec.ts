import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type OpenApiOperation = {
  requestBody?: unknown;
};

type OpenApiDocument = {
  paths: Record<string, Partial<Record<string, OpenApiOperation>>>;
};

const document = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../packages/orchestrator-client/openapi.json'),
    'utf8',
  ),
) as OpenApiDocument;

const expectNoRequestBody = (path: string, method: string) => {
  expect(document.paths[path]?.[method]?.requestBody).toBeUndefined();
};

describe('orchestrator OpenAPI domain contract', () => {
  it('exposes the app domain routes without legacy android-applications paths', () => {
    expect(document.paths['/api/v1/apps']).toBeDefined();
    expect(document.paths['/api/v1/apps/{id}/lifecycle/start']).toBeDefined();
    expect(
      document.paths['/api/v1/apps/{id}/runtime/data-files'],
    ).toBeDefined();
    expect(document.paths['/api/v1/apps/{id}/viewer/session']).toBeDefined();
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

  it('does not document request bodies for bodyless mutations', () => {
    expectNoRequestBody('/api/v1/apps/{id}/lifecycle/stop', 'post');
    expectNoRequestBody('/api/v1/apps/{id}/runtime/screenshot', 'post');
    expectNoRequestBody('/api/v1/apps/{id}/viewer/activity', 'post');
    expectNoRequestBody('/api/v1/network-policies/reconcile', 'post');
    expectNoRequestBody('/api/v1/platform/docker/networks/{id}', 'delete');
    expectNoRequestBody('/api/v1/platform/docker/images/{id}', 'delete');
    expectNoRequestBody(
      '/api/v1/platform/display-sidecar/sessions/{id}',
      'delete',
    );
  });
});

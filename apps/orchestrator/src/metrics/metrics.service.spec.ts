import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('reports Docker access metrics for Prometheus and dashboard snapshots', async () => {
    const service = new MetricsService();
    service.configureDocker('local-socket', {
      maxConcurrentReads: 8,
      maxConcurrentLongOperations: 4,
      slowRequestWarningMs: 5_000,
      longOperationTimeoutMs: 1_800_000,
      remoteRequestTimeoutMs: 60_000,
    });
    service.queueDockerOperation('read', 1);
    service.queueDockerOperation('read', -1);
    service.recordDockerRetry('container_inspect', 'ECONNRESET');
    service.recordSlowDockerOperation('long', 'image_pull', 5_001);
    service.beginDockerOperation('read', 'container_inspect')('success');
    service.beginDockerOperation('mutation', 'network_connect')(
      'error',
      'socket hang up',
    );

    expect(service.dockerSnapshot()).toMatchObject({
      transport: 'local-socket',
      limits: {
        maxConcurrentReads: 8,
        maxConcurrentLongOperations: 4,
      },
      totals: {
        success: 1,
        errors: 1,
        timeouts: 0,
        retries: 1,
        slow: 1,
      },
      inFlight: { read: 0, mutation: 0, long: 0 },
      queued: { read: 0, mutation: 0, long: 0 },
      events: [
        expect.objectContaining({
          class: 'mutation',
          operation: 'network_connect',
          outcome: 'error',
        }),
        expect.objectContaining({
          class: 'long',
          operation: 'image_pull',
          outcome: 'slow',
        }),
      ],
    });
    await expect(service.registry.metrics()).resolves.toContain(
      'rebroid_docker_api_operations_total',
    );
  });
});

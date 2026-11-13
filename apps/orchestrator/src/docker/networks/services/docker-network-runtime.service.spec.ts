import type { DockerNetworkAttachmentTimings } from '../../contracts/docker-network-runtime.port';
import { OperationDeadline } from '../../../common/operation-deadline';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerErrorClassifier } from '../../engine/services/docker-error-classifier.service';
import { DockerNetworkRuntimeService } from './docker-network-runtime.service';

const managedLabels = (applicationId: string) => ({
  'com.rebroid.managed': 'true',
  'com.rebroid.application-id': applicationId,
  'com.rebroid.component': 'network',
  'com.rebroid.resource-prefix': 'rebroid',
});

const createEngine = () => {
  const errors = new DockerErrorClassifier();
  const docker = {
    getContainer: jest.fn(),
    listNetworks: jest.fn(),
    getNetwork: jest.fn(),
    createNetwork: jest.fn(),
  };

  return {
    docker,
    orchestratorHostname: 'a1b2c3d4e5f6',
    transport: 'local-socket',
    coalesceRead: jest.fn((_key: string, operation: () => Promise<unknown>) =>
      operation(),
    ),
    read: jest.fn((operation: () => Promise<unknown>) => operation()),
    mutate: jest.fn((operation: () => Promise<unknown>) => operation()),
    labels: jest.fn((applicationId: string, component: string) => ({
      'com.rebroid.managed': 'true',
      'com.rebroid.application-id': applicationId,
      'com.rebroid.component': component,
      'com.rebroid.resource-prefix': 'rebroid',
    })),
    isResourceAlreadyExists: jest.fn(() => false),
    isDockerConflict: (error: unknown) => errors.isDockerConflict(error),
    isDockerNotFound: (error: unknown) => errors.isDockerNotFound(error),
    isContainerAlreadyConnectedToNetwork: (error: unknown) =>
      errors.isContainerAlreadyConnectedToNetwork(error),
    isContainerAlreadyDisconnectedFromNetwork: (error: unknown) =>
      errors.isContainerAlreadyDisconnectedFromNetwork(error),
    isTransientDockerTransportError: (error: unknown) =>
      errors.isTransientDockerTransportError(error),
  } as unknown as DockerEngineService & { docker: typeof docker };
};

describe('DockerNetworkRuntimeService', () => {
  const notFound = Object.assign(new Error('Network or container not found'), {
    statusCode: 404,
  });
  const duplicateEndpoint = Object.assign(
    new Error(
      'endpoint with name orchestrator already exists in network app-network',
    ),
    { statusCode: 403 },
  );

  it('separates Docker admission wait from network connect latency', async () => {
    jest.useFakeTimers();
    try {
      const engine = createEngine();
      engine.mutate = async <T>(operation: () => Promise<T>) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return operation();
      };
      const connect = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 700)),
      );
      engine.docker.getNetwork.mockReturnValue({ connect });
      const timings: DockerNetworkAttachmentTimings = {
        dockerMutationQueueMs: 0,
        networkConnectMs: 0,
        networkConvergenceMs: 0,
      };
      const attachment = new DockerNetworkRuntimeService(
        engine,
      ).connectContainerToNetwork('container', 'network', timings);
      await jest.advanceTimersByTimeAsync(900);
      await attachment;
      expect(timings).toEqual({
        dockerMutationQueueMs: 200,
        networkConnectMs: 700,
        networkConvergenceMs: 0,
        networkConnect: {
          requestId: expect.any(String),
          containerId: 'container',
          networkName: 'network',
          transport: 'local-socket',
          dispatchedAt: expect.any(String),
          settledAt: expect.any(String),
          outcome: 'fulfilled',
        },
      });
      expect(
        Date.parse(timings.networkConnect!.settledAt!) -
          Date.parse(timings.networkConnect!.dispatchedAt),
      ).toBe(700);
      expect(engine.docker.getNetwork).toHaveBeenCalledTimes(1);
      expect(engine.docker.getContainer).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retains a rejected request observation when membership resolves an ambiguous connect', async () => {
    const engine = createEngine();
    engine.docker.getNetwork.mockReturnValue({
      connect: jest.fn().mockRejectedValue(duplicateEndpoint),
      inspect: jest.fn().mockResolvedValue({ Containers: { container: {} } }),
    });
    const timings: DockerNetworkAttachmentTimings = {
      dockerMutationQueueMs: 0,
      networkConnectMs: 0,
      networkConvergenceMs: 0,
    };
    await new DockerNetworkRuntimeService(engine).connectContainerToNetwork(
      'container',
      'network',
      timings,
    );
    expect(timings.networkConnect).toMatchObject({
      containerId: 'container',
      networkName: 'network',
      outcome: 'rejected',
      settledAt: expect.any(String),
    });
  });

  it.each([true, false])(
    'accounts for expired queue wait with dispatch callback %s',
    async (dispatchCallback) => {
      jest.useFakeTimers();
      try {
        const engine = createEngine();
        const deadline = new OperationDeadline(100);
        const timings = {
          dockerMutationQueueMs: 0,
          networkConnectMs: 0,
          networkConvergenceMs: 0,
        };
        engine.mutate = async <T>(operation: () => Promise<T>) => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (!dispatchCallback) deadline.throwIfExpired();
          return operation();
        };
        const connect = jest.fn();
        const inspect = jest.fn();
        engine.docker.getNetwork.mockReturnValue({ connect, inspect });
        const pending = new DockerNetworkRuntimeService(
          engine,
        ).connectContainerToNetwork('container', 'network', timings, {
          deadline,
        });
        const rejected = expect(pending).rejects.toThrow('deadline');
        await jest.advanceTimersByTimeAsync(200);
        await rejected;
        expect(timings.dockerMutationQueueMs).toBe(200);
        expect(connect).not.toHaveBeenCalled();
        expect(inspect).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('does not verify membership for cancelled work that never dispatched', async () => {
    const engine = createEngine();
    const controller = new AbortController();
    const reason = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    engine.mutate = async <T>(operation: () => Promise<T>) => {
      controller.abort(reason);
      return operation();
    };
    const connect = jest.fn();
    const inspect = jest.fn();
    engine.docker.getNetwork.mockReturnValue({ connect, inspect });
    await expect(
      new DockerNetworkRuntimeService(engine).connectContainerToNetwork(
        'container',
        'network',
        undefined,
        { signal: controller.signal },
      ),
    ).rejects.toBe(reason);
    expect(connect).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
  });

  it('still verifies an ambiguous dispatched mutation after its caller cancels', async () => {
    const engine = createEngine();
    const controller = new AbortController();
    const inspect = jest
      .fn()
      .mockResolvedValue({ Containers: { container: {} } });
    const connect = jest.fn(async () => {
      controller.abort(new Error('cancelled'));
      throw Object.assign(new Error('endpoint already exists'), {
        statusCode: 409,
      });
    });
    engine.docker.getNetwork.mockReturnValue({ connect, inspect });
    await expect(
      new DockerNetworkRuntimeService(engine).connectContainerToNetwork(
        'container',
        'network',
        undefined,
        { signal: controller.signal },
      ),
    ).resolves.toBeUndefined();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('does not attempt attachment when the orchestrator is missing from the engine', async () => {
    const engine = createEngine();
    engine.docker.getContainer.mockReturnValue({
      inspect: jest.fn().mockRejectedValue(notFound),
    });

    await expect(
      new DockerNetworkRuntimeService(engine).connectOrchestratorToNetwork(
        'app-network',
      ),
    ).resolves.toBeUndefined();
    expect(engine.docker.getNetwork).not.toHaveBeenCalled();
  });

  it('uses the full ID resolved from the local hostname for network attachment', async () => {
    const engine = createEngine();
    const connect = jest.fn().mockResolvedValue(undefined);
    const id = engine.orchestratorHostname.padEnd(64, 'a');
    engine.docker.getContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Id: id,
        Name: '/custom-compose-name',
        NetworkSettings: { Networks: { 'app-network': { EndpointID: '' } } },
      }),
    });
    engine.docker.getNetwork.mockReturnValue({ connect });

    await new DockerNetworkRuntimeService(engine).connectOrchestratorToNetwork(
      'app-network',
    );

    expect(engine.docker.getContainer).toHaveBeenCalledWith(
      engine.orchestratorHostname,
    );
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith({ Container: id });
  });

  it('skips a redundant attachment when the identified orchestrator already has an endpoint', async () => {
    const engine = createEngine();
    const id = engine.orchestratorHostname.padEnd(64, 'a');
    const inspect = jest.fn().mockResolvedValue({
      Id: id,
      NetworkSettings: {
        Networks: { 'app-network': { EndpointID: 'attached-endpoint' } },
      },
    });
    engine.docker.getContainer.mockReturnValue({ inspect });

    await new DockerNetworkRuntimeService(engine).connectOrchestratorToNetwork(
      'app-network',
    );

    expect(inspect).toHaveBeenCalledTimes(1);
    expect(engine.docker.getNetwork).not.toHaveBeenCalled();
    expect(engine.mutate).not.toHaveBeenCalled();
  });

  it('does not attach a container that merely has the same name as the local hostname', async () => {
    const engine = createEngine();
    engine.docker.getContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Id: 'unrelated-container-id',
        Config: { Hostname: 'unrelated-hostname' },
      }),
    });

    await new DockerNetworkRuntimeService(engine).connectOrchestratorToNetwork(
      'app-network',
    );

    expect(engine.docker.getNetwork).not.toHaveBeenCalled();
  });

  it('surfaces a missing app network when the orchestrator exists', async () => {
    const engine = createEngine();
    const connect = jest.fn().mockRejectedValue(notFound);
    const id = engine.orchestratorHostname.padEnd(64, 'a');
    engine.docker.getNetwork.mockReturnValue({ connect });
    engine.docker.getContainer.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({ Id: id }),
    });

    await expect(
      new DockerNetworkRuntimeService(engine).connectOrchestratorToNetwork(
        'app-network',
      ),
    ).rejects.toBe(notFound);
  });

  it('only removes an app network when its labels match the requested owner', async () => {
    const engine = createEngine();
    const remove = jest.fn();
    const disconnect = jest.fn();
    const inspect = jest.fn().mockResolvedValue({
      Id: 'network-id',
      Labels: managedLabels('another-app'),
      Containers: { 'container-id': {} },
    });
    engine.docker.getNetwork.mockReturnValue({ inspect, remove, disconnect });
    const service = new DockerNetworkRuntimeService(engine);
    await expect(service.removeNetwork('app-network', 'app-1')).rejects.toThrow(
      'not managed',
    );
    expect(remove).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();

    inspect.mockResolvedValue({
      Id: 'network-id',
      Labels: managedLabels('app-1'),
      Containers: { 'container-id': {} },
    });
    await service.removeNetwork('app-network', 'app-1');
    expect(disconnect).toHaveBeenCalledWith({
      Container: 'container-id',
      Force: true,
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(engine.docker.getNetwork).toHaveBeenLastCalledWith('network-id');
  });

  it('creates app networks with normal Docker egress', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const network = { id: 'created-network' };
    engine.docker.listNetworks.mockResolvedValue([]);
    engine.docker.createNetwork.mockResolvedValue(network);

    await expect(
      service.createIsolatedNetwork('app-1', 'rebroid-net-app-1'),
    ).resolves.toBe(network);
    expect(engine.docker.createNetwork).toHaveBeenCalledWith({
      Name: 'rebroid-net-app-1',
      Internal: false,
      CheckDuplicate: true,
      Labels: managedLabels('app-1'),
    });
  });

  it('recreates stale managed internal networks when no containers are attached', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const staleNetwork = {
      inspect: jest.fn().mockResolvedValue({
        Internal: true,
        Labels: managedLabels('app-1'),
        Containers: {},
      }),
      remove: jest.fn(),
    };
    const createdNetwork = { id: 'created-network' };
    engine.docker.listNetworks.mockResolvedValue([
      { Name: 'rebroid-net-app-1', Id: 'network-id' },
    ]);
    engine.docker.getNetwork.mockReturnValue(staleNetwork);
    engine.docker.createNetwork.mockResolvedValue(createdNetwork);

    await expect(
      service.createIsolatedNetwork('app-1', 'rebroid-net-app-1'),
    ).resolves.toBe(createdNetwork);
    expect(staleNetwork.remove).toHaveBeenCalledTimes(1);
    expect(engine.docker.createNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ Internal: false }),
    );
  });

  it('reports attached stale internal networks because Docker cannot change Internal in place', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const staleNetwork = {
      inspect: jest.fn().mockResolvedValue({
        Internal: true,
        Labels: managedLabels('app-1'),
        Containers: { containerId: {} },
      }),
      remove: jest.fn(),
    };
    engine.docker.listNetworks.mockResolvedValue([
      { Name: 'rebroid-net-app-1', Id: 'network-id' },
    ]);
    engine.docker.getNetwork.mockReturnValue(staleNetwork);

    await expect(
      service.createIsolatedNetwork('app-1', 'rebroid-net-app-1'),
    ).rejects.toThrow(
      'Docker network rebroid-net-app-1 is internal, so containers on it cannot use internet or external DNS.',
    );
    expect(staleNetwork.remove).not.toHaveBeenCalled();
    expect(engine.docker.createNetwork).not.toHaveBeenCalled();
  });

  it('does not replace non-managed internal networks with the same name', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const existingNetwork = {
      inspect: jest.fn().mockResolvedValue({
        Internal: true,
        Labels: {},
        Containers: {},
      }),
      remove: jest.fn(),
    };
    engine.docker.listNetworks.mockResolvedValue([
      { Name: 'rebroid-net-app-1', Id: 'network-id' },
    ]);
    engine.docker.getNetwork.mockReturnValue(existingNetwork);

    await expect(
      service.createIsolatedNetwork('app-1', 'rebroid-net-app-1'),
    ).rejects.toThrow(
      'Docker network rebroid-net-app-1 is internal and is not managed by this application.',
    );
    expect(existingNetwork.remove).not.toHaveBeenCalled();
  });

  it('accepts an ambiguous network attachment when inspection confirms it committed', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const error = new Error('socket hang up');
    const network = {
      connect: jest.fn().mockRejectedValue(error),
      inspect: jest.fn().mockResolvedValue({
        Containers: { 'container-id': {} },
      }),
    };
    engine.docker.getNetwork.mockReturnValue(network);

    await expect(
      service.connectContainerToNetwork('container-id', 'app-network'),
    ).resolves.toBeUndefined();
    expect(network.connect).toHaveBeenCalledTimes(1);
    expect(network.inspect).toHaveBeenCalledTimes(1);
  });

  it('accepts a duplicate endpoint only when inspection reports the exact container ID', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const id = engine.orchestratorHostname.padEnd(64, 'a');
    const endpoint = { Name: 'orchestrator', EndpointID: 'endpoint' };
    const inspect = jest
      .fn()
      .mockResolvedValueOnce({
        Containers: { [id.slice(0, 12)]: endpoint, 'stale-id': endpoint },
      })
      .mockResolvedValueOnce({ Containers: { [id]: endpoint } });
    engine.docker.getNetwork.mockReturnValue({
      connect: jest.fn().mockRejectedValue(duplicateEndpoint),
      inspect,
    });

    await expect(
      service.connectContainerToNetwork(id, 'app-network'),
    ).rejects.toBe(duplicateEndpoint);
    await expect(
      service.connectContainerToNetwork(id, 'app-network'),
    ).resolves.toBeUndefined();
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it('preserves the original conflict when membership cannot be verified', async () => {
    const engine = createEngine();
    const conflict = Object.assign(new Error('Network is in conflict'), {
      statusCode: 409,
    });
    engine.docker.getNetwork.mockReturnValue({
      connect: jest.fn().mockRejectedValue(conflict),
      inspect: jest.fn().mockRejectedValue(new Error('Verification failed')),
    });

    await expect(
      new DockerNetworkRuntimeService(engine).connectContainerToNetwork(
        'container-id',
        'app-network',
      ),
    ).rejects.toBe(conflict);
  });

  it('treats an already disconnected endpoint as success only if the exact ID is absent', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const absent = Object.assign(
      new Error(
        'container container-id is not connected to network app-network',
      ),
      { statusCode: 500 },
    );
    const inspect = jest
      .fn()
      .mockResolvedValueOnce({ Containers: { 'container-id': {} } })
      .mockResolvedValueOnce({ Containers: { 'another-id': {} } });
    engine.docker.getNetwork.mockReturnValue({
      disconnect: jest.fn().mockRejectedValue(absent),
      inspect,
    });

    await expect(
      service.disconnectContainerFromNetwork('container-id', 'app-network'),
    ).rejects.toBe(absent);
    await expect(
      service.disconnectContainerFromNetwork('container-id', 'app-network'),
    ).resolves.toBeUndefined();
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it('confirms a detach committed after Docker lost the response', async () => {
    const engine = createEngine();
    const disconnected = Object.assign(new Error('connection reset'), {
      code: 'ECONNRESET',
    });
    const inspect = jest.fn().mockResolvedValue({ Containers: {} });
    engine.docker.getNetwork.mockReturnValue({
      disconnect: jest.fn().mockRejectedValue(disconnected),
      inspect,
    });

    await expect(
      new DockerNetworkRuntimeService(engine).disconnectContainerFromNetwork(
        'container-id',
        'app-network',
      ),
    ).resolves.toBeUndefined();
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('keeps a missing network idempotent and surfaces unrelated detach errors', async () => {
    const engine = createEngine();
    const service = new DockerNetworkRuntimeService(engine);
    const unrelated = Object.assign(
      new Error('Authorization plugin not found'),
      {
        statusCode: 500,
      },
    );
    const inspect = jest.fn();
    engine.docker.getNetwork.mockReturnValue({
      disconnect: jest
        .fn()
        .mockRejectedValueOnce(notFound)
        .mockRejectedValueOnce(unrelated),
      inspect,
    });

    await expect(
      service.disconnectContainerFromNetwork('container-id', 'app-network'),
    ).resolves.toBeUndefined();
    await expect(
      service.disconnectContainerFromNetwork('container-id', 'app-network'),
    ).rejects.toBe(unrelated);
    expect(inspect).not.toHaveBeenCalled();
  });
});

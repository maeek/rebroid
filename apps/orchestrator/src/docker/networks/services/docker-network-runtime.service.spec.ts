import { DockerEngineService } from '../../docker-engine.service';
import { DockerNetworkRuntimeService } from './docker-network-runtime.service';

const managedLabels = (applicationId: string) => ({
  'com.rebroid.managed': 'true',
  'com.rebroid.application-id': applicationId,
  'com.rebroid.component': 'network',
  'com.rebroid.resource-prefix': 'rebroid',
});

const createEngine = () => {
  const docker = {
    getContainer: jest.fn(),
    listNetworks: jest.fn(),
    getNetwork: jest.fn(),
    createNetwork: jest.fn(),
  };

  return {
    docker,
    orchestratorHostname: 'a1b2c3d4e5f6',
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
    isDockerConflict: jest.fn(() => false),
    isDockerNotFound: jest.fn(
      (error: unknown) =>
        (error as { statusCode?: number })?.statusCode === 404,
    ),
    isContainerAlreadyConnectedToNetwork: jest.fn(() => false),
    isContainerAlreadyDisconnectedFromNetwork: jest.fn(() => false),
    isTransientDockerTransportError: jest.fn(() => false),
  } as unknown as DockerEngineService & { docker: typeof docker };
};

describe('DockerNetworkRuntimeService', () => {
  const notFound = Object.assign(new Error('Network or container not found'), {
    statusCode: 404,
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
      inspect: jest
        .fn()
        .mockResolvedValue({ Id: id, Name: '/custom-compose-name' }),
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
    (
      engine.isTransientDockerTransportError as jest.MockedFunction<
        DockerEngineService['isTransientDockerTransportError']
      >
    ).mockReturnValue(true);

    await expect(
      service.connectContainerToNetwork('container-id', 'app-network'),
    ).resolves.toBeUndefined();
    expect(network.connect).toHaveBeenCalledTimes(1);
    expect(network.inspect).toHaveBeenCalledTimes(1);
  });
});

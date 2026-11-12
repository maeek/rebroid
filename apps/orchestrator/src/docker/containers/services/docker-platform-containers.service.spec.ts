import { DockerPlatformContainersService } from './docker-platform-containers.service';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it.each(['stop', 'remove'] as const)(
  'drains workflow operations before platform %s and uses the inspected container ID',
  async (action) => {
    const stopContainer = jest.fn();
    const removeContainer = jest.fn();
    const docker = new DockerPlatformContainersService(
      { orchestratorHostname: 'orchestrator' } as never,
      {
        stopContainer,
        removeContainer,
        inspectContainer: async () => ({
          Id: 'full-container-id',
          Config: {
            Labels: {
              'com.rebroid.managed': 'true',
              'com.rebroid.application-id': 'app',
            },
          },
        }),
      } as never,
      {} as never,
    );
    const entered = deferred();
    const release = deferred();
    const admit = jest.fn(async (_target, operation: () => Promise<void>) => {
      entered.resolve();
      await release.promise;
      await operation();
    });
    const mutation =
      action === 'stop'
        ? docker.stopPlatformContainer('alias', admit)
        : docker.removePlatformContainer('alias', true, admit);
    try {
      await entered.promise;
      expect(admit).toHaveBeenCalledWith(
        { id: 'full-container-id', applicationId: 'app' },
        expect.any(Function),
      );
      expect(stopContainer).not.toHaveBeenCalled();
      expect(removeContainer).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await mutation;
    }
    if (action === 'stop') {
      expect(stopContainer).toHaveBeenCalledWith('full-container-id');
    } else {
      expect(removeContainer).toHaveBeenCalledWith('full-container-id', {
        force: true,
      });
    }
  },
);

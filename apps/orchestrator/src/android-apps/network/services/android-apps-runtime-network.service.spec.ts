import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { AndroidAppsRuntimeNetworkService } from './android-apps-runtime-network.service';

const createService = (
  apply: jest.Mock,
  stopContainer = jest.fn().mockResolvedValue(undefined),
) => {
  const guardStartup = jest.fn().mockResolvedValue('guard-token');
  const releaseStartupGuard = jest.fn().mockResolvedValue(undefined);
  const start = jest.fn().mockResolvedValue(undefined);
  const service = new AndroidAppsRuntimeNetworkService(
    {} as NetworkIsolationService,
    { apply, guardStartup, releaseStartupGuard } as unknown as NetworkPolicyService,
    {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsLogService,
    {
      save: jest.fn().mockResolvedValue(undefined),
      setNetworkPolicyState: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsStateWriter,
    {} as AndroidAppsViewerNetworkService,
    { stopContainer } as unknown as DockerContainerLifecycleService,
  );
  return { service, stopContainer, guardStartup, releaseStartupGuard, start };
};

const app = {
  id: 'app-1',
  containerId: 'container-1',
  networkPolicyEnabled: true,
} as AndroidApplication;

describe('AndroidAppsRuntimeNetworkService', () => {
  it('does not stop an unrestricted runtime when firewall enforcement is disabled', async () => {
    const { service, stopContainer, start, guardStartup, releaseStartupGuard } = createService(
      jest.fn().mockResolvedValue({
        status: 'skipped',
        message: 'Firewall enforcement is disabled.',
      }),
    );
    await expect(
      service.startWithPolicy({ ...app, networkPolicyEnabled: false }, start),
    ).resolves.toMatchObject({ status: 'skipped' });
    expect(guardStartup).not.toHaveBeenCalled();
    expect(releaseStartupGuard).not.toHaveBeenCalled();
    expect(stopContainer).not.toHaveBeenCalled();
  });

  it('keeps a runtime running after post-start policy enforcement succeeds', async () => {
    const { service, stopContainer, start, guardStartup, releaseStartupGuard } = createService(
      jest.fn().mockResolvedValue({
        status: 'applied',
        message: 'Policy applied.',
      }),
    );

    await expect(
      service.startWithPolicy({ ...app }, start, { retryAttempts: 1 }),
    ).resolves.toMatchObject({ status: 'applied' });

    expect(guardStartup.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]);
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(releaseStartupGuard.mock.invocationCallOrder[0]);
    expect(stopContainer).not.toHaveBeenCalled();
  });

  it('refuses to start if the startup guard could not be applied', async () => {
    const { service, guardStartup, start } = createService(jest.fn());
    guardStartup.mockRejectedValue(new Error('Firewall unavailable'));
    await expect(service.startWithPolicy({ ...app }, start)).rejects.toThrow('Firewall unavailable');
    expect(start).not.toHaveBeenCalled();
  });

  it('uses a graceful stop after persistent post-start policy failure', async () => {
    const { service, stopContainer, start, guardStartup, releaseStartupGuard } = createService(
      jest.fn().mockResolvedValue({
        status: 'skipped',
        message: 'Container network address is not available yet.',
      }),
    );

    await expect(
      service.startWithPolicy({ ...app }, start, { retryAttempts: 1 }),
    ).rejects.toThrow(
      'Outbound policy enforcement failed: Container network address is not available yet.',
    );

    expect(guardStartup).toHaveBeenCalled();
    expect(stopContainer).toHaveBeenCalledWith('container-1', 10);
    expect(stopContainer.mock.invocationCallOrder[0]).toBeLessThan(releaseStartupGuard.mock.invocationCallOrder[0]);
  });
});

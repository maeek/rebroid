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
) => ({
  service: new AndroidAppsRuntimeNetworkService(
    {} as NetworkIsolationService,
    { apply } as unknown as NetworkPolicyService,
    {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsLogService,
    {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsStateWriter,
    {} as AndroidAppsViewerNetworkService,
    { stopContainer } as unknown as DockerContainerLifecycleService,
  ),
  stopContainer,
});

const app = {
  id: 'app-1',
  containerId: 'container-1',
  networkPolicyEnabled: true,
} as AndroidApplication;

describe('AndroidAppsRuntimeNetworkService', () => {
  it('keeps a runtime running after post-start policy enforcement succeeds', async () => {
    const { service, stopContainer } = createService(
      jest.fn().mockResolvedValue({
        status: 'applied',
        message: 'Policy applied.',
      }),
    );

    await expect(
      service.enforcePolicyAfterStart({ ...app }, { retryAttempts: 1 }),
    ).resolves.toMatchObject({ status: 'applied' });

    expect(stopContainer).not.toHaveBeenCalled();
  });

  it('uses a graceful stop after persistent post-start policy failure', async () => {
    const { service, stopContainer } = createService(
      jest.fn().mockResolvedValue({
        status: 'skipped',
        message: 'Container network address is not available yet.',
      }),
    );

    await expect(
      service.enforcePolicyAfterStart({ ...app }, { retryAttempts: 1 }),
    ).rejects.toThrow(
      'Outbound policy enforcement failed: Container network address is not available yet.',
    );

    expect(stopContainer).toHaveBeenCalledWith('container-1', 10);
  });
});

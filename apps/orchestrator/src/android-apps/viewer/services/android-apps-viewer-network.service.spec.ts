import type { DockerContainerExecPort } from '../../../docker/contracts/docker-container-exec.port';
import type { DockerNetworkRuntimePort } from '../../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../../docker/contracts/docker-sidecar.port';
import type { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import type { AndroidApplication } from '../../android-application.entity';
import type { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import type { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import type { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import {
  AndroidAppsViewerNetworkService,
  ViewerRuntimeChangedError,
} from './android-apps-viewer-network.service';

const runtime = {
  id: 'app-1',
  containerId: 'container-1',
  containerName: 'app-1',
  containerImage: 'fixture',
  networkName: 'network-1',
  adbPort: 5555,
  lastStartedAt: new Date(1000),
  status: AndroidApplicationStatus.Running,
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: '["192.0.2.0/24"]',
  networkPolicyRevision: 2,
} as AndroidApplication;

function setup(current = runtime) {
  const sidecar = {
    connectAdb: jest
      .fn()
      .mockResolvedValue({ configured: true, connected: true }),
  };
  const policy = {
    apply: jest.fn(),
    remove: jest.fn(),
    refreshViewerPolicy: jest
      .fn()
      .mockResolvedValue({ status: 'applied', message: 'Applied' }),
  };
  const writer = {
    recordViewerNetworkPolicy: jest.fn().mockResolvedValue(true),
  };
  const queries = { getStored: jest.fn().mockResolvedValue(current) };
  const gate = new AndroidAppsPolicyGate();
  const viewer = new AndroidAppsViewerNetworkService(
    {} as DockerNetworkRuntimePort,
    sidecar as unknown as DockerSidecarPort,
    {} as DockerContainerExecPort,
    policy as unknown as NetworkPolicyService,
    {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as AndroidAppsLogService,
    writer as unknown as AndroidAppsStateWriter,
    queries as unknown as AndroidAppsQueryService,
    gate,
  );
  return { viewer, policy, sidecar, writer, queries, gate };
}

describe('viewer firewall refresh', () => {
  it.each([true, false])(
    'uses the current allowlist and revision even if the viewer snapshot had restrictions enabled = %s',
    async (networkPolicyEnabled) => {
      const { viewer, policy, writer } = setup();
      await viewer.prepareScrcpyAdbTarget(
        {
          ...runtime,
          networkPolicyEnabled,
          networkPolicyAllowCidrs: '["0.0.0.0/0"]',
          networkPolicyRevision: 1,
        },
        '172.18.0.2',
      );

      expect(policy.refreshViewerPolicy).toHaveBeenCalledWith(runtime);
      expect(policy.apply).not.toHaveBeenCalled();
      expect(policy.remove).not.toHaveBeenCalled();
      expect(writer.recordViewerNetworkPolicy).toHaveBeenCalledWith(
        runtime,
        expect.objectContaining({ status: 'applied' }),
      );
    },
  );

  it('leaves host rules and policy observations alone for an unrestricted app', async () => {
    const { viewer, policy, writer, sidecar } = setup({
      ...runtime,
      networkPolicyEnabled: false,
      networkPolicyRevision: 3,
    });
    await viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2');
    expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
    expect(policy.apply).not.toHaveBeenCalled();
    expect(policy.remove).not.toHaveBeenCalled();
    expect(writer.recordViewerNetworkPolicy).not.toHaveBeenCalled();
    expect(sidecar.connectAdb).toHaveBeenCalled();
  });

  it.each([{ containerId: 'replacement' }, { lastStartedAt: new Date(2000) }])(
    'rejects a replaced runtime before refreshing or connecting (%o)',
    async (change) => {
      const { viewer, policy, sidecar } = setup({ ...runtime, ...change });
      await expect(
        viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2'),
      ).rejects.toBeInstanceOf(ViewerRuntimeChangedError);
      expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
      expect(sidecar.connectAdb).not.toHaveBeenCalled();
    },
  );

  it('shares the gate with other policy changes before reading or writing', async () => {
    const { viewer, gate, queries, policy } = setup();
    await gate.run(runtime.id, async () => {
      await expect(
        viewer.prepareScrcpyAdbTarget(runtime, '172.18.0.2'),
      ).rejects.toThrow('A network policy change is already in progress');
    });
    expect(queries.getStored).not.toHaveBeenCalled();
    expect(policy.refreshViewerPolicy).not.toHaveBeenCalled();
  });
});

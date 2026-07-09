import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { shouldReconcileContainerState } from './android-apps-state.utils';

describe('android apps state utilities', () => {
  it('reconciles runtime-backed app states with a container', () => {
    expect(
      shouldReconcileContainerState({
        containerId: 'container-1',
        status: AndroidApplicationStatus.Provisioning,
      } as never),
    ).toBe(true);

    expect(
      shouldReconcileContainerState({
        containerId: 'container-1',
        status: AndroidApplicationStatus.Running,
      } as never),
    ).toBe(true);

    expect(
      shouldReconcileContainerState({
        containerId: null,
        status: AndroidApplicationStatus.Running,
      } as never),
    ).toBe(false);

    expect(
      shouldReconcileContainerState({
        containerId: 'container-1',
        status: AndroidApplicationStatus.Stopped,
      } as never),
    ).toBe(true);
  });
});

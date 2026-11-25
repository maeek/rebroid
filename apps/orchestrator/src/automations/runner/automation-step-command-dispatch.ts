import type { AndroidAppsAutomationPort } from '../../android-apps/contracts/android-apps-automation.port';
import { ConflictException } from '@nestjs/common';
import { externalAutomationCapability } from '@rebroid/automation-core/device-capabilities';
import { waitForOperation } from '../../common/wait-for-operation';
import type { AutomationTargetExecutor } from '../commands/automation-command.types';
import type {
  AutomationExecutionState,
  AutomationStepExecutionOptions,
} from './automation-runner-execution.types';

const commandsWithoutTargetWork = new Set([
  'ai.run',
  'android.wait',
  'debug.log',
  'flow.stop',
  'flow.fail',
]);

export const capturesScreen = (uses: string) =>
  uses === 'vision.observe' || uses === 'vision.locate';

export function createStepCommandDispatch(
  applications: AndroidAppsAutomationPort,
  state: AutomationExecutionState,
  options: AutomationStepExecutionOptions,
  stepUses: string,
) {
  const pendingAiWork = new Set<Promise<unknown>>();
  const runWithTarget: AutomationTargetExecutor = async (signal, operation) => {
    signal?.throwIfAborted();
    const pending = options.admitTargetWork(() =>
      applications.withAutomationTarget(state.target, signal, (app) => {
        state.app = app;
        return operation(app);
      }),
    );
    if (stepUses !== 'ai.run' || !signal) return pending;
    pendingAiWork.add(pending);
    const forget = () => pendingAiWork.delete(pending);
    void pending.then(forget, forget);
    return waitForOperation(pending, signal);
  };
  function dispatch<T>(
    uses: string,
    signal: AbortSignal | undefined,
    execute: (app: AutomationExecutionState['app']) => Promise<T>,
  ) {
    if (
      state.target.kind === 'external' &&
      !externalAutomationCapability(uses)
    ) {
      throw new ConflictException(
        `Command "${uses}" requires a managed device.`,
      );
    }
    if (
      (commandsWithoutTargetWork.has(uses) &&
        !(state.target.kind === 'external' && uses === 'android.wait')) ||
      capturesScreen(uses)
    ) {
      return execute(state.app);
    }
    if (state.authorizeTarget) {
      return state
        .authorizeTarget(signal, uses)
        .then(() => runWithTarget(signal, execute));
    }
    return runWithTarget(signal, execute);
  }
  const withTarget: AutomationTargetExecutor = async (signal, operation) => {
    await state.authorizeTarget?.(signal, stepUses);
    return runWithTarget(signal, operation);
  };

  return {
    dispatch,
    withTarget,
    drain: () => Promise.allSettled(pendingAiWork),
  };
}

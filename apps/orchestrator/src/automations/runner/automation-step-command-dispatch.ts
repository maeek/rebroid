import type { AndroidAppsAutomationPort } from '../../android-apps/contracts/android-apps-automation.port';
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
  const withTarget: AutomationTargetExecutor = async (signal, operation) => {
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
    if (commandsWithoutTargetWork.has(uses) || capturesScreen(uses)) {
      return execute(state.app);
    }
    return withTarget(signal, execute);
  }

  return {
    dispatch,
    withTarget,
    drain: () => Promise.allSettled(pendingAiWork),
  };
}

import type { OperationDeadline } from '../../common/operation-deadline';

export interface DockerOperationOptions {
  deadline?: OperationDeadline;
  signal?: AbortSignal;
  /** Observes admission after queue residence; must not affect operation behavior. */
  onDispatched?: () => void;
}

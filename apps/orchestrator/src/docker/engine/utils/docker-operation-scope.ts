import { OperationDeadlineExceededError } from '../../../common/operation-deadline';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';

/** The owner disposes the timer and upstream listener when its work is settled. */
export function dockerOperationScope(options?: DockerOperationOptions) {
  const controller = new AbortController();
  const abort = () => controller.abort(options?.signal?.reason);
  let timer: ReturnType<typeof setTimeout> | undefined;
  options?.signal?.addEventListener('abort', abort, { once: true });
  if (options?.signal?.aborted) abort();
  if (options?.deadline) {
    const remaining = options.deadline.remainingMs();
    if (remaining === 0) {
      controller.abort(new OperationDeadlineExceededError());
    } else {
      timer = setTimeout(
        () => controller.abort(new OperationDeadlineExceededError()),
        remaining,
      );
    }
  }
  return {
    signal: controller.signal,
    dispose() {
      if (timer) clearTimeout(timer);
      options?.signal?.removeEventListener('abort', abort);
    },
  };
}

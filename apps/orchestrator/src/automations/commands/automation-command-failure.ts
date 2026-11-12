import type { AutomationCommandOutcome } from '@rebroid/automation-core/command-registry';

export class AutomationCommandFailure extends Error {
  constructor(
    message: string,
    readonly outcome: Exclude<AutomationCommandOutcome, 'succeeded'>,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

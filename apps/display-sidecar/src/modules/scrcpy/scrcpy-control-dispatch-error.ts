export class ScrcpyControlDispatchError extends Error {
  constructor(
    readonly code: "control_not_dispatched" | "control_outcome_unknown",
    message: string,
  ) {
    super(message);
  }
}

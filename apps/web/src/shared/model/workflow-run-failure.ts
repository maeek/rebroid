export const workflowRunFailureMessage = (error: string | null | undefined, startedAt: string | null) => {
  if (!error?.trim()) return 'Check Events for recorded details.'
  if (error.trim().toLowerCase() !== 'fetch failed') return error
  if (!startedAt)
    return 'A service request failed before the workflow started. The original request details were not recorded.'
  return 'A service request failed during execution. The original request details were not recorded.'
}

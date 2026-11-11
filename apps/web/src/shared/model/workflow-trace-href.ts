export const workflowTraceHref = (workflowId: string, runId?: string | null) => {
  const history = `/automations/${encodeURIComponent(workflowId)}/traces`
  return runId ? `${history}?${new URLSearchParams({ run: runId })}` : history
}

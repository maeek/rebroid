const authorizationFailures = {
  authorization_unreachable: {
    title: 'Workflow authorization service is unreachable',
    description:
      'Ask an administrator to check the connection between the orchestrator and web service, then run the workflow again.'
  },
  authorization_timeout: {
    title: 'Workflow authorization timed out',
    description:
      'Run the workflow again. If authorization keeps timing out, share the request ID with an administrator.'
  },
  authorization_unavailable: {
    title: 'Workflow authorization is unavailable',
    description:
      'Try running the workflow again when the service recovers. If the error persists, share the request ID with an administrator.'
  },
  authorization_rejected: {
    title: 'Workflow access was denied',
    description:
      'Check your access to the app, the selected profile, and the workflow commands. If the workflow starts the app, check your Start permission and resource limits.'
  },
  authorization_credentials: {
    title: 'Workflow authorization credentials were rejected',
    description:
      'Ask an administrator to check that the orchestrator and web service use the same shared secret, then run the workflow again.'
  },
  authorization_invalid_request: {
    title: 'Workflow authorization request was rejected',
    description:
      'Ask an administrator to check that the orchestrator and web service are running the same version. Share the request ID.'
  },
  authorization_invalid_quota: {
    title: 'Workflow start limit could not be verified',
    description:
      'Ask an administrator to check the authorization service and your application limits. Share the request ID.'
  }
}

export const workflowAuthorizationFailure = (code: unknown) =>
  typeof code === 'string' && Object.hasOwn(authorizationFailures, code)
    ? authorizationFailures[code as keyof typeof authorizationFailures]
    : undefined

export const workflowRunFailureMessage = (error: string | null | undefined, startedAt: string | null) => {
  if (!error?.trim()) return 'Check Events for recorded details.'
  if (error.trim().toLowerCase() !== 'fetch failed') return error
  if (!startedAt)
    return 'A service request failed before the workflow started. Check the service status, then run the workflow again.'
  return 'A service request failed during execution. Check Events for the last completed step before running the workflow again.'
}

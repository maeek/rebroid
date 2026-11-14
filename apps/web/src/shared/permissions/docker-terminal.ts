export const dockerOpenTerminal = 'docker:open-terminal'

// Platform privileges are derived from built-in membership and cannot be granted by group policy.
export const hasDockerTerminalPrivilege = (
  account: { isPlatformAdmin: boolean },
  privilege: typeof dockerOpenTerminal
) => privilege === dockerOpenTerminal && account.isPlatformAdmin

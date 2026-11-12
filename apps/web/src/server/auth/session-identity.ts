import 'server-only'

export type AccountSessionIdentity = {
  userId: string
  sessionId: string
  sessionVersion: number
  authEpoch: string
}

export const readAccountSessionIdentity = (
  value: { userId?: string; sessionId?: string; sessionVersion?: number; authEpoch?: string } | null | undefined
): AccountSessionIdentity | null => {
  if (
    !value?.userId ||
    typeof value.sessionId !== 'string' ||
    typeof value.sessionVersion !== 'number' ||
    typeof value.authEpoch !== 'string'
  ) {
    return null
  }
  return {
    userId: value.userId,
    sessionId: value.sessionId,
    sessionVersion: value.sessionVersion,
    authEpoch: value.authEpoch
  }
}

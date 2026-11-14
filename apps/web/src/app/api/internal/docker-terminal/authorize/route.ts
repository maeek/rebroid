import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { dockerOpenTerminal, hasDockerTerminalPrivilege } from '@/shared/permissions/docker-terminal'

export const GET = async (request: Request) => {
  const headers = { 'Cache-Control': 'no-store' }
  if (!hasInternalSecret(request.headers)) return new Response(null, { status: 401, headers })

  const current = await Promise.all([getCurrentUser(), getCurrentSessionIdentity()]).catch(() => null)
  if (!current || !hasDockerTerminalPrivilege(current[0], dockerOpenTerminal)) {
    return new Response(null, { status: 403, headers })
  }

  const [account, session] = current
  return Response.json({ userId: account.id, accountSessionId: session.sessionId }, { headers })
}

import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'

export const loadExternalAdbPageData = async () => {
  const admin = await requireAdmin()
  const [availability, policy, users] = await Promise.all([
    externalDeviceClient.availability(),
    externalDeviceClient.tcpPolicy(admin.id),
    userService.listUsers()
  ])
  const sessions =
    availability.enabled || availability.status === 'feature_disabled'
      ? await orchestratorDiagnosticsClient.listDisplaySidecarSessions('external').catch(() => null)
      : []
  return {
    availability,
    policy,
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions
  }
}

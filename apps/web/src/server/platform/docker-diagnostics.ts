import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'

export const readDockerMetrics = async () => {
  await requireAdmin()
  return orchestratorDiagnosticsClient.dockerMetrics()
}

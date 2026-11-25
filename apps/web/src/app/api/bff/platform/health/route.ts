import { requireAdmin } from '@/server/auth/authorization'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'

export const GET = (request: Request) =>
  runRouteHandler(async () => {
    await requireAdmin('api')
    return orchestratorDiagnosticsClient.healthSummary(request.signal)
  })

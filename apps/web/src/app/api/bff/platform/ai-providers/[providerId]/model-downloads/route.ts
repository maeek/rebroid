import { requireAdmin } from '@/server/auth/authorization'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'

export const GET = (_request: Request, context: { params: Promise<{ providerId: string }> }) =>
  runRouteHandler(async () => {
    await requireAdmin('api')
    const { providerId } = await context.params
    return orchestratorSettingsClient.listActiveAiProviderModelDownloads(parseRouteInput(routeResourceId, providerId))
  })

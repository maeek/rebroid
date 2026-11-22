import { z } from 'zod'
import { requireAdmin } from '@/server/auth/authorization'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'

const providerIdSchema = z.string().trim().min(1).max(128)

export const GET = (_request: Request, context: { params: Promise<{ providerId: string }> }) =>
  runRouteHandler(async () => {
    await requireAdmin('api')
    const { providerId } = await context.params
    return orchestratorSettingsClient.listActiveAiProviderModelDownloads(providerIdSchema.parse(providerId))
  })

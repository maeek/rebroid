import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { requireAdminUser } from '@/server/orchestrator/shared'

const providerIdSchema = z.string().trim().min(1).max(128)

export const GET = (_request: Request, context: { params: Promise<{ providerId: string }> }) =>
  runRouteHandler(async () => {
    await requireAdminUser()
    const { providerId } = await context.params
    return orchestratorSettingsClient.listActiveAiProviderModelDownloads(providerIdSchema.parse(providerId))
  })

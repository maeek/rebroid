import { runRouteHandler } from '@/server/http/route-handler'
import { requireAutomationUser } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'

export const GET = () =>
  runRouteHandler(async () => {
    const user = await requireAutomationUser('automations:run', 'api')
    return orchestratorAutomationsClient.listRunnableOptions(user.ownerUserId)
  })

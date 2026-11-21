import { runRouteHandler } from '@/server/http/route-handler'
import { assertAutomationPermission } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const GET = () =>
  runRouteHandler(async () => {
    const user = await getCurrentUserContext()
    assertAutomationPermission(user, 'automations:run')
    return orchestratorAutomationsClient.listRunnableOptions(user.ownerUserId)
  })

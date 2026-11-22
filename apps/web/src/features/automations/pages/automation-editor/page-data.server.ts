import { notFound } from 'next/navigation'
import { runSafeAction } from '@/server/actions/safe-action'
import {
  listPermittedAutomationCommands,
  requireAutomationUser
} from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission } from '@/shared/permissions/permissions'

const getWorkflow = async (ownerUserId: string, id: string) => {
  try {
    return await orchestratorAutomationsClient.get(ownerUserId, id)
  } catch (error) {
    if (error instanceof OrchestratorRequestError && error.status === 404) notFound()
    throw error
  }
}

export const loadWorkflowEditor = (id?: string) =>
  runSafeAction(
    async () => {
      const user = await requireAutomationUser('automations:manage')
      const initialAutomation = id === undefined ? null : await getWorkflow(user.ownerUserId, id)
      return {
        initialAutomation,
        initialCommands: await listPermittedAutomationCommands(user),
        draftOwnerUserId: id === undefined ? user.ownerUserId : undefined,
        canUseAi: hasPermission(user.permissions, 'automations:run-ai'),
        canManageAi: user.isPlatformAdmin
      }
    },
    { logLabel: 'Load workflow editor' }
  )

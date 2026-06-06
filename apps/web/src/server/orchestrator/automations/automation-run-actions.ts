'use server'

import { revalidatePath } from 'next/cache'
import { getOrchestratorBrowserWsUrl } from '@/server/orchestrator/config'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  assertRunProfilePermission,
  assertTargetApplication,
  listPermittedAiTools,
  recordAutomationAudit
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { RunAdHocAiAutomationInput, RunAutomationInput } from './types'

export const runAutomationAction = async (id: string, input: RunAutomationInput) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  await assertTargetApplication(input.targetApplicationId)
  assertRunProfilePermission(user, input)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, id)
  await assertDefinitionPermissions(user, automation.definition)
  const run = await orchestratorAutomationsClient.run(user.ownerUserId, id, input)
  revalidatePath('/automations')
  revalidatePath(`/automations/${id}`)
  await recordAutomationAudit('automation.run', automation.id, automation.name, {
    runId: run.id,
    targetApplicationId: run.targetApplicationId,
    targetProfileMode: run.targetProfileMode,
    targetProfileName: run.targetProfileName
  })
  return run
}

export const runAdHocAiAutomationAction = async (input: RunAdHocAiAutomationInput) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  await assertTargetApplication(input.targetApplicationId)
  assertRunProfilePermission(user, input)
  const run = await orchestratorAutomationsClient.runAdHocAi(user.ownerUserId, {
    ...input,
    allowedTools: await listPermittedAiTools(user)
  })
  revalidatePath('/automations')
  await recordAutomationAudit('automation.ai.run', run.automationId, 'Ad-hoc AI automation', {
    runId: run.id,
    targetApplicationId: run.targetApplicationId
  })
  return run
}

export const cancelAutomationRunAction = async (runId: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  const run = await orchestratorAutomationsClient.cancelRun(user.ownerUserId, runId)
  revalidatePath('/automations')
  revalidatePath(`/automations/${run.automationId}`)
  return run
}

export const listAutomationRunEventsAction = async (runId: string, after = 0) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return orchestratorAutomationsClient.listRunEvents(user.ownerUserId, runId, after)
}

export const createAutomationRunEventStreamUrlAction = async (runId: string, after = 0) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  const token = await orchestratorAutomationsClient.createRunEventStreamToken(user.ownerUserId, runId)
  const query = new URLSearchParams({ token: token.token, after: String(after) })
  return getOrchestratorBrowserWsUrl(`/automations/runs/events/ws?${query}`)
}

export const listActiveAutomationRunsAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return orchestratorAutomationsClient.listActiveRuns(user.ownerUserId)
}

export const listAutomationRunsAction = async (automationId: string, limit = 50) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listRuns(user.ownerUserId, automationId, limit)
}

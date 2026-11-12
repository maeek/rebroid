'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  assertRunProfilePermission,
  assertTargetApplication,
  listPermittedDefaultAiCapabilities,
  recordAutomationAudit
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type {
  RunAdHocAiAutomationInput,
  RunAutomationInput,
  SuggestAdHocAiPromptsInput
} from '@/shared/contracts/automation'

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
  if (input.startPolicy === 'start-if-needed') assertRunProfilePermission(user, input)
  const rawShellRequested = input.rawShellPolicy === 'allowlisted'
  if (rawShellRequested) assertAutomationPermission(user, 'automations:run-adb-shell')
  const capabilities = await listPermittedDefaultAiCapabilities(user)
  const run = await orchestratorAutomationsClient.runAdHocAi(user.ownerUserId, {
    ...input,
    capabilities,
    rawShellPolicy: rawShellRequested ? 'allowlisted' : 'deny'
  })
  revalidatePath('/automations')
  await recordAutomationAudit('automation.ai.run', run.automationId, 'Ad-hoc AI automation', {
    runId: run.id,
    targetApplicationId: run.targetApplicationId,
    rawShellPolicy: rawShellRequested ? 'allowlisted' : 'deny'
  })
  return run
}

export const suggestAdHocAiPromptsAction = async (input: SuggestAdHocAiPromptsInput) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  await assertTargetApplication(input.targetApplicationId)
  return orchestratorAutomationsClient.suggestAdHocAiPrompts(user.ownerUserId, {
    ...input,
    allowedTools: await listPermittedDefaultAiCapabilities(user)
  })
}

export const cancelAutomationRunAction = async (runId: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  const run = await orchestratorAutomationsClient.cancelRun(user.ownerUserId, runId)
  revalidatePath('/automations')
  revalidatePath(`/automations/${run.automationId}`)
  return run
}

export const listAdHocAiAutomationRunsAction = async (targetApplicationId: string, limit = 20) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  await assertTargetApplication(targetApplicationId)
  return orchestratorAutomationsClient.listAdHocAiRuns(user.ownerUserId, targetApplicationId, limit)
}

export const listAdHocAiAutomationRunHistoryAction = async (targetApplicationId: string, limit = 20) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  await assertTargetApplication(targetApplicationId)
  return orchestratorAutomationsClient.listAdHocAiRunHistory(user.ownerUserId, targetApplicationId, limit)
}

export const clearAdHocAiAutomationRunsAction = async (targetApplicationId: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  await assertTargetApplication(targetApplicationId)
  return orchestratorAutomationsClient.clearAdHocAiRuns(user.ownerUserId, targetApplicationId)
}

export const listAutomationRunsAction = async (automationId: string, limit = 50) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listRuns(user.ownerUserId, automationId, limit)
}

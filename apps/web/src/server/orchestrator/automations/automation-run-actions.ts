'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
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
import type { RunAdHocAiAutomationInput, RunAutomationInput, SuggestAdHocAiPromptsInput } from './types'

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
  const permittedTools = await listPermittedAiTools(user)
  const rawShellRequested = input.rawShellPolicy === 'allowlisted'
  if (rawShellRequested && !permittedTools.includes('android.adbShell')) {
    assertAutomationPermission(user, 'automations:run-adb-shell')
  }
  const capabilities = permittedTools.filter(uses => uses !== 'android.adbShell')
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
  assertRunProfilePermission(user, input)
  return orchestratorAutomationsClient.suggestAdHocAiPrompts(user.ownerUserId, {
    ...input,
    allowedTools: await listPermittedAiTools(user)
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
  const requestHeaders = await headers()
  const isHttpsRequest =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ||
    requestHeaders.get('x-forwarded-ssl') === 'on' ||
    requestHeaders.get('origin')?.startsWith('https://') === true
  const origin = requestHeaders.get('origin')
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const browserOrigin = origin?.startsWith('https://')
    ? origin
    : isHttpsRequest && forwardedHost
      ? `https://${forwardedHost}`
      : null
  if (browserOrigin) {
    const url = new URL(`/api/v1/automations/runs/events/ws?${query}`, browserOrigin)
    url.protocol = 'wss:'
    return url.toString()
  }
  return getOrchestratorBrowserWsUrl(`/automations/runs/events/ws?${query}`, {
    secure: isHttpsRequest
  })
}

export const listActiveAutomationRunsAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return orchestratorAutomationsClient.listActiveRuns(user.ownerUserId)
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
  const runs = await orchestratorAutomationsClient.listAdHocAiRuns(user.ownerUserId, targetApplicationId, limit)
  const events = await Promise.all(
    runs.map(run => orchestratorAutomationsClient.listRunEvents(user.ownerUserId, run.id, 0))
  )
  return runs.map((run, index) => ({ run, events: events[index] ?? [] }))
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

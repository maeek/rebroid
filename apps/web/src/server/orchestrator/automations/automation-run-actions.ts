'use server'

import { revalidatePath } from 'next/cache'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  assertAutomationPermission,
  requireRunnableWorkflow,
  assertRunProfilePermission,
  assertTargetApplication,
  assertExternalCommandPermission,
  assertCurrentExternalAttachment,
  listPermittedDefaultAiCapabilities,
  recordAutomationAudit,
  requireAutomationUser
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type {
  RunAdHocAiAutomationInput,
  RunAutomationInput,
  SuggestAdHocAiPromptsInput
} from '@/shared/contracts/automation'

export const runAutomationAction = async (id: string, input: RunAutomationInput) => {
  const user = await requireAutomationUser('automations:run')
  const automation = await requireRunnableWorkflow(user, id, input)
  if (input.attachmentId) await assertCurrentExternalAttachment(input.targetDeviceId, input.attachmentId)
  const run = await orchestratorAutomationsClient.run(user.ownerUserId, id, input)
  revalidatePath('/automations')
  revalidatePath(`/automations/${id}`)
  recordAutomationAudit(user.ownerUserId, 'automation.run', automation.id, automation.name, {
    runId: run.id,
    targetDeviceId: run.targetDeviceId,
    targetProfileMode: run.targetProfileMode,
    targetProfileName: run.targetProfileName
  })
  return run
}

export const runAdHocAiAutomationAction = async (input: RunAdHocAiAutomationInput) => {
  const user = await requireAutomationUser('automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  const external = await assertTargetApplication(input.targetDeviceId)
  if (external) {
    assertExternalCommandPermission(user, 'ai.run')
    if (!input.attachmentId || input.attachmentId !== external.connection.attachmentId) {
      throw new PublicActionError('The verified attachment changed. Open the device viewer again.', {
        code: 'conflict',
        status: 409
      })
    }
    if (
      input.startPolicy === 'start-if-needed' ||
      input.profileMode ||
      input.profileName ||
      input.rawShellPolicy === 'allowlisted'
    ) {
      throw new PublicActionError('External device AI uses the verified connection and its typed tools.', {
        code: 'validation'
      })
    }
  }
  if (input.startPolicy === 'start-if-needed') assertRunProfilePermission(user, input)
  const rawShellRequested = input.rawShellPolicy === 'allowlisted'
  if (rawShellRequested) assertAutomationPermission(user, 'automations:run-adb-shell')
  const capabilities = external
    ? await listPermittedDefaultAiCapabilities(user, true)
    : await listPermittedDefaultAiCapabilities(user)
  const run = await orchestratorAutomationsClient.runAdHocAi(user.ownerUserId, {
    ...input,
    capabilities,
    rawShellPolicy: rawShellRequested ? 'allowlisted' : 'deny'
  })
  revalidatePath('/automations')
  recordAutomationAudit(user.ownerUserId, 'automation.ai.run', run.automationId, 'Ad-hoc AI automation', {
    runId: run.id,
    targetDeviceId: run.targetDeviceId,
    rawShellPolicy: rawShellRequested ? 'allowlisted' : 'deny'
  })
  return run
}

export const suggestAdHocAiPromptsAction = async (input: SuggestAdHocAiPromptsInput) => {
  const user = await requireAutomationUser('automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  const external = await assertTargetApplication(input.targetDeviceId)
  if (external) {
    assertExternalCommandPermission(user, 'ai.run')
    if (!input.attachmentId || input.attachmentId !== external.connection.attachmentId) {
      throw new PublicActionError('The device attachment changed.', { code: 'conflict', status: 409 })
    }
  }
  return orchestratorAutomationsClient.suggestAdHocAiPrompts(user.ownerUserId, {
    ...input,
    allowedTools: external
      ? await listPermittedDefaultAiCapabilities(user, true)
      : await listPermittedDefaultAiCapabilities(user)
  })
}

export const cancelAutomationRunAction = async (runId: string) => {
  const user = await requireAutomationUser('automations:run')
  const run = await orchestratorAutomationsClient.cancelRun(user.ownerUserId, runId)
  revalidatePath('/automations')
  revalidatePath(`/automations/${run.automationId}`)
  return run
}

export const listAdHocAiAutomationRunHistoryAction = async (
  targetDeviceId: string,
  limit = 20,
  attachmentId?: string
) => {
  const user = await requireAutomationUser('automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  const external = await assertTargetApplication(targetDeviceId)
  if (external && (!attachmentId || attachmentId !== external.connection.attachmentId))
    throw new PublicActionError('The device attachment changed.', { code: 'conflict', status: 409 })
  return attachmentId
    ? orchestratorAutomationsClient.listAdHocAiRunHistory(user.ownerUserId, targetDeviceId, limit, attachmentId)
    : orchestratorAutomationsClient.listAdHocAiRunHistory(user.ownerUserId, targetDeviceId, limit)
}

export const clearAdHocAiAutomationRunsAction = async (targetDeviceId: string, attachmentId?: string) => {
  const user = await requireAutomationUser('automations:run')
  assertAutomationPermission(user, 'automations:run-ai')
  const external = await assertTargetApplication(targetDeviceId)
  if (external && (!attachmentId || attachmentId !== external.connection.attachmentId))
    throw new PublicActionError('The device attachment changed.', { code: 'conflict', status: 409 })
  return attachmentId
    ? orchestratorAutomationsClient.clearAdHocAiRuns(user.ownerUserId, targetDeviceId, attachmentId)
    : orchestratorAutomationsClient.clearAdHocAiRuns(user.ownerUserId, targetDeviceId)
}

'use server'

import { AUTOMATION_DRAFT_PROMPT_MAX_LENGTH, type AutomationYamlDraft } from '@rebroid/automation-core/yaml-draft'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { adHocAiRunPrompt, finalAiRunEvent } from '@/shared/model/ad-hoc-ai-run-events'
import { readAutomationDraftStream } from '@/shared/model/automation-draft/read-automation-draft-stream'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  listPermittedAiTools,
  recordAutomationAudit
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { AutomationRunEvent, DraftAutomationYamlInput, SaveAutomationInput } from '@/shared/contracts/automation'

export const listAutomationCommandsAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listCommands()
}

export const validateAutomationYamlAction = async (yaml: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  const validation = await orchestratorAutomationsClient.validateYaml(yaml)
  if (validation.definition) {
    await assertDefinitionPermissions(user, validation.definition)
  }
  return validation
}

const draftFromStream = async (input: DraftAutomationYamlInput): Promise<AutomationYamlDraft> => {
  const response = await orchestratorAutomationsClient.draftYamlStream(input)
  const outcome = await readAutomationDraftStream(response.body)
  if (outcome.type === 'draft.completed') return outcome.draft
  if (outcome.type === 'draft.failed') throw new Error(outcome.message)
  throw new Error(`AI draft needs more detail: ${outcome.question}`)
}

const eventLine = (event: AutomationRunEvent) => {
  const message = event.message.trim()
  const data = Object.keys(event.data).length > 0 ? ` data=${JSON.stringify(event.data).slice(0, 1200)}` : ''
  return `- ${event.type}${event.stepId ? ` step=${event.stepId}` : ''}${message ? `: ${message}` : ''}${data}`
}

const promptFromAdHocRun = ({
  events,
  runId,
  targetApplicationId,
  targetProfileMode,
  targetProfileName
}: {
  events: AutomationRunEvent[]
  runId: string
  targetApplicationId: string
  targetProfileMode: string | null
  targetProfileName: string | null
}) => {
  const userPrompt = adHocAiRunPrompt(events)
  const finalAnswer = finalAiRunEvent(events)?.message.trim()
  const usefulEvents = events
    .filter(event =>
      [
        'ai.tool.completed',
        'ai.tool.failed',
        'ai.plan.proposed',
        'ai.plan.updated',
        'ai.action.decided',
        'ai.perception.summary',
        'ai.perception.observed',
        'step.completed',
        'step.failed'
      ].includes(event.type)
    )
    .slice(-40)

  const context = [
    'Convert this successful Rebroid ad-hoc AI automation run into a reusable workflow.',
    'Use concrete automation commands. Do not use ai.run. Keep the workflow focused on the actions and checks that made the run succeed.',
    '',
    `Run id: ${runId}`,
    `Target application id: ${targetApplicationId}`,
    `Target profile mode: ${targetProfileMode ?? 'default'}`,
    `Target profile name: ${targetProfileName ?? 'default'}`,
    '',
    `Original request:\n${(userPrompt || 'Ad-hoc AI run').slice(0, 8_000)}`,
    '',
    finalAnswer ? `Final assistant answer:\n${finalAnswer.slice(0, 1_000)}` : '',
    '',
    'Draft a complete workflow YAML with a clear name, short description, and only concrete steps.',
    'Relevant run events:'
  ]
    .filter(Boolean)
    .join('\n')
  const evidence = usefulEvents.length
    ? usefulEvents.map(eventLine).join('\n')
    : '- No detailed tool events were recorded.'
  return `${context}\n${evidence}`.slice(0, AUTOMATION_DRAFT_PROMPT_MAX_LENGTH)
}

export const draftWorkflowFromAdHocRunAction = async ({
  modelId,
  providerId,
  runId,
  visionModelId,
  visionProviderId
}: {
  runId: string
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  assertAutomationPermission(user, 'automations:run-ai')
  const run = await orchestratorAutomationsClient.getRun(user.ownerUserId, runId)
  if (run.status !== 'success') {
    throw new Error('Only successful AI runs can be saved as workflow drafts.')
  }
  const events = await orchestratorAutomationsClient.listRunEvents(user.ownerUserId, runId, 0, 'conversation')
  if (!adHocAiRunPrompt(events)) {
    throw new Error('This run does not contain an ad-hoc AI prompt.')
  }
  if (finalAiRunEvent(events)?.data.completed !== true) {
    throw new Error('Only completed AI tasks can be saved as workflow drafts.')
  }
  const draft = await draftFromStream({
    prompt: promptFromAdHocRun({
      events,
      runId: run.id,
      targetApplicationId: run.targetApplicationId,
      targetProfileMode: run.targetProfileMode,
      targetProfileName: run.targetProfileName
    }),
    providerId,
    modelId,
    visionProviderId,
    visionModelId,
    allowedTools: await listPermittedAiTools(user)
  })
  await assertDefinitionPermissions(user, draft.definition)
  await recordAutomationAudit('automation.ai.draft-from-run', run.automationId, 'Ad-hoc AI automation', { runId })
  return draft
}

export const listAutomationsAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.list(user.ownerUserId)
}

export const listAutomationsGridAction = async (
  input: Parameters<typeof orchestratorAutomationsClient.listGrid>[1] = {}
) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listGrid(user.ownerUserId, input)
}

export const listRunnableAutomationsAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return orchestratorAutomationsClient.listRunnable(user.ownerUserId)
}

export const getAutomationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.get(user.ownerUserId, id)
}

export const createAutomationAction = async (input: SaveAutomationInput) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  const validation = await orchestratorAutomationsClient.validateYaml(input.yaml)
  if (!validation.definition) {
    throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
  }
  await assertDefinitionPermissions(user, validation.definition)
  const automation = await orchestratorAutomationsClient.create(user.ownerUserId, {
    ...input,
    yaml: validation.yaml ?? input.yaml
  })
  revalidatePath('/automations')
  await recordAutomationAudit('automation.create', automation.id, automation.name)
  return automation
}

export const updateAutomationAction = async (id: string, input: Partial<SaveAutomationInput>) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  input = z.object({ yaml: z.string().optional() }).strict().parse(input)
  let payload = input
  if (input.yaml !== undefined) {
    const validation = await orchestratorAutomationsClient.validateYaml(input.yaml)
    if (!validation.definition) {
      throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
    }
    await assertDefinitionPermissions(user, validation.definition)
    payload = { ...input, yaml: validation.yaml ?? input.yaml }
  }
  const automation = await orchestratorAutomationsClient.update(user.ownerUserId, id, payload)
  revalidatePath('/automations')
  await recordAutomationAudit('automation.update', automation.id, automation.name, { fields: Object.keys(input) })
  return automation
}

export const deleteAutomationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  const automation = await orchestratorAutomationsClient.remove(user.ownerUserId, id)
  revalidatePath('/automations')
  await recordAutomationAudit('automation.delete', automation.id, automation.name)
  return automation
}

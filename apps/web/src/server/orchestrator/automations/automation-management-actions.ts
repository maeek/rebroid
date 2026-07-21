'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  listPermittedAiTools,
  recordAutomationAudit
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { AutomationRunEvent, DraftAutomationYamlInput, SaveAutomationInput } from '@/shared/contracts/automation'
import type { AutomationYamlDraft, AutomationYamlDraftStreamEvent } from '@rebroid/automation-core/yaml-draft'

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
  if (!response.body) throw new Error('Draft stream did not return a response body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      for (const event of events) {
        const parsed = parseDraftStreamEvent(event)
        if (!parsed) continue
        if (parsed.type === 'draft.completed') return parsed.data
        if (parsed.type === 'draft.failed') throw new Error(parsed.message)
        if (parsed.type === 'draft.clarification.requested') {
          throw new Error(`AI draft needs more detail: ${parsed.data.question}`)
        }
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
  throw new Error('AI draft stream ended without a completed draft.')
}

const parseDraftStreamEvent = (event: string): AutomationYamlDraftStreamEvent | null => {
  const data = event
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trimStart())
    .join('\n')
  if (!data) return null
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object' && 'type' in parsed ? (parsed as AutomationYamlDraftStreamEvent) : null
  } catch {
    return null
  }
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
  const userPrompt = events.find(event => event.type === 'ai.user.message')?.message.trim()
  const finalAnswer = [...events]
    .reverse()
    .find(event => event.type === 'ai.message.completed')
    ?.message.trim()
  const usefulEvents = events
    .filter(event =>
      [
        'ai.tool.completed',
        'ai.tool.failed',
        'ai.plan.proposed',
        'ai.plan.updated',
        'ai.action.decided',
        'ai.ui.observed',
        'ai.perception.summary',
        'ai.screenshot.observed',
        'step.completed',
        'step.failed'
      ].includes(event.type)
    )
    .slice(-40)

  return [
    'Convert this successful Rebroid ad-hoc AI automation run into a reusable workflow.',
    'Use concrete automation commands. Do not use ai.run. Keep the workflow focused on the actions and checks that made the run succeed.',
    '',
    `Run id: ${runId}`,
    `Target application id: ${targetApplicationId}`,
    `Target profile mode: ${targetProfileMode ?? 'default'}`,
    `Target profile name: ${targetProfileName ?? 'default'}`,
    '',
    `Original request:\n${userPrompt || 'Ad-hoc AI run'}`,
    '',
    finalAnswer ? `Final assistant answer:\n${finalAnswer}` : '',
    '',
    'Relevant run events:',
    usefulEvents.length > 0 ? usefulEvents.map(eventLine).join('\n') : '- No detailed tool events were recorded.',
    '',
    'Draft a complete workflow YAML with a clear name, short description, and only concrete steps.'
  ]
    .filter(Boolean)
    .join('\n')
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
  const events = await orchestratorAutomationsClient.listRunEvents(user.ownerUserId, runId, 0)
  if (!events.some(event => event.type === 'ai.user.message')) {
    throw new Error('This run does not contain an ad-hoc AI prompt.')
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

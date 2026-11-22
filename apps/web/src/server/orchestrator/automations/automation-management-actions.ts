'use server'

import { AUTOMATION_DRAFT_PROMPT_MAX_LENGTH, type AutomationYamlDraft } from '@rebroid/automation-core/yaml-draft'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { runSafeAction } from '@/server/actions/safe-action'
import { PublicActionError } from '@/server/errors/public-action-error'
import { adHocAiRunPrompt, finalAiRunEvent } from '@/shared/model/ad-hoc-ai-run-events'
import { readAutomationDraftStream } from '@/shared/model/automation-draft/read-automation-draft-stream'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  listPermittedDraftCommands,
  recordAutomationAudit,
  requireAutomationUser,
  validatePermittedWorkflowYaml
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { AutomationRunEvent, DraftAutomationYamlInput, SaveAutomationInput } from '@/shared/contracts/automation'

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
  const user = await requireAutomationUser('automations:manage')
  assertAutomationPermission(user, 'automations:run-ai')
  const run = await orchestratorAutomationsClient.getRun(user.ownerUserId, runId)
  if (run.status !== 'success') {
    throw new Error('Only successful AI runs can be saved as workflow drafts.')
  }
  const events = await orchestratorAutomationsClient.listRunConversationEvents(user.ownerUserId, runId)
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
    allowedTools: await listPermittedDraftCommands(user)
  })
  await assertDefinitionPermissions(user, draft.definition)
  recordAutomationAudit(user.ownerUserId, 'automation.ai.draft-from-run', run.automationId, 'Ad-hoc AI automation', {
    runId
  })
  return draft
}

const saveWorkflowInput = z.object({ yaml: z.string() }).strict()

export const saveAutomationAction = async (id: string | null, input: SaveAutomationInput) =>
  runSafeAction(
    async () => {
      const user = await requireAutomationUser('automations:manage')
      const { yaml } = saveWorkflowInput.parse(input)
      const validation = await validatePermittedWorkflowYaml(user, yaml)
      if (!validation.valid || !validation.definition) {
        const message = validation.errors[0] ?? 'Automation YAML is invalid.'
        throw new PublicActionError(message, { code: 'validation', status: 400, fieldErrors: { yaml: [message] } })
      }
      const payload = { yaml: validation.yaml ?? yaml }
      const automation = id
        ? await orchestratorAutomationsClient.update(user.ownerUserId, id, payload)
        : await orchestratorAutomationsClient.create(user.ownerUserId, payload)
      revalidatePath('/automations')
      recordAutomationAudit(
        user.ownerUserId,
        id ? 'automation.update' : 'automation.create',
        automation.id,
        automation.name,
        id ? { fields: ['yaml'] } : undefined
      )
      return automation
    },
    { fallbackMessage: 'Could not save the workflow.', logLabel: 'saveAutomationAction failed' }
  )

export const deleteAutomationAction = async (id: string) =>
  runSafeAction(
    async () => {
      const user = await requireAutomationUser('automations:manage')
      const automation = await orchestratorAutomationsClient.remove(user.ownerUserId, id)
      revalidatePath('/automations')
      recordAutomationAudit(user.ownerUserId, 'automation.delete', automation.id, automation.name)
      return automation
    },
    { fallbackMessage: 'Could not delete the workflow.', logLabel: 'deleteAutomationAction' }
  )

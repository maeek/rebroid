import { AUTOMATION_AI_RUN_MAX_TIMEOUT_MS } from '@rebroid/automation-core/ai-run'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'
import type { AutomationCommand } from '@/shared/contracts/automation'

const defaultPrompt = 'Inspect the screen and complete the requested task.'
const defaultMaxActions = 20
const defaultTimeoutMs = 120000

export const defaultAiRunInput = () => ({
  prompt: defaultPrompt,
  maxActions: defaultMaxActions,
  timeoutMs: defaultTimeoutMs
})

export const stringValue = (input: Record<string, unknown>, key: string) =>
  typeof input[key] === 'string' ? input[key] : ''

export const numberValue = (input: Record<string, unknown>, key: string, fallback: number) =>
  typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] : fallback

export const stringArrayValue = (input: Record<string, unknown>, key: string) =>
  Array.isArray(input[key]) ? input[key].filter((item): item is string => typeof item === 'string') : []

export const healthLabel = (health: AutomationAiProviderHealth) =>
  health.status === 'ok' ? 'Online' : health.status === 'disabled' ? 'Disabled' : 'Error'

export const normalizeAiRunInput = (input: Record<string, unknown>) => ({
  prompt: stringValue(input, 'prompt') || defaultPrompt,
  ...(stringValue(input, 'providerId') ? { providerId: stringValue(input, 'providerId') } : {}),
  ...(stringValue(input, 'modelId') ? { modelId: stringValue(input, 'modelId') } : {}),
  ...(stringValue(input, 'visionProviderId') ? { visionProviderId: stringValue(input, 'visionProviderId') } : {}),
  ...(stringValue(input, 'visionModelId') ? { visionModelId: stringValue(input, 'visionModelId') } : {}),
  ...(Array.isArray(input.capabilities) ? { capabilities: stringArrayValue(input, 'capabilities') } : {}),
  maxActions: Math.min(Math.max(numberValue(input, 'maxActions', defaultMaxActions), 1), 100),
  timeoutMs: Math.min(
    Math.max(numberValue(input, 'timeoutMs', defaultTimeoutMs), 1000),
    AUTOMATION_AI_RUN_MAX_TIMEOUT_MS
  )
})

export const summarizeAiRunInput = (input: Record<string, unknown>) => {
  const prompt = stringValue(input, 'prompt').trim()
  const provider = stringValue(input, 'providerId')
  const model = stringValue(input, 'modelId')
  const visionProvider = stringValue(input, 'visionProviderId')
  const visionModel = stringValue(input, 'visionModelId')
  const maxActions = numberValue(input, 'maxActions', defaultMaxActions)
  const timeoutSeconds = Math.round(numberValue(input, 'timeoutMs', defaultTimeoutMs) / 1000)
  const preview = prompt.length > 72 ? `${prompt.slice(0, 72)}...` : prompt || 'No prompt'
  const vision =
    visionProvider || visionModel
      ? ` · vision ${visionProvider || 'default'}${visionModel ? `/${visionModel}` : ''}`
      : ''
  return `${preview} · device control ${provider || 'default'}${model ? `/${model}` : ''}${vision} · ${timeoutSeconds}s · ${maxActions} actions`
}

export const selectableAiRunCommands = (commands: AutomationCommand[]) =>
  commands.filter(command => command.uses !== 'ai.run').sort((left, right) => left.uses.localeCompare(right.uses))

export const nextAiRunCapabilities = ({
  capabilities,
  commands,
  enabled,
  uses
}: {
  capabilities: string[] | undefined
  commands: AutomationCommand[]
  enabled: boolean
  uses: string
}) => {
  const next = new Set(capabilities ?? commands.map(command => command.uses))
  if (enabled) next.add(uses)
  else next.delete(uses)
  const selected = Array.from(next)
  return selected.length === commands.length ? undefined : selected
}

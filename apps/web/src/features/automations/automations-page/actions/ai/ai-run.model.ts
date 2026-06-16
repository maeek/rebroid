import { catalogByRole, selectCatalogModel, selectCatalogProvider } from '@rebroid/ai-core/provider'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const defaultPrompt = 'Inspect the screen and complete the requested task.'
const defaultMaxToolCalls = 20
const defaultTimeoutMs = 120000

export const defaultAiRunInput = () => ({
  prompt: defaultPrompt,
  maxToolCalls: defaultMaxToolCalls,
  timeoutMs: defaultTimeoutMs,
  requireFinalAnswer: true
})

export const stringValue = (input: Record<string, unknown>, key: string) =>
  typeof input[key] === 'string' ? input[key] : ''

export const numberValue = (input: Record<string, unknown>, key: string, fallback: number) =>
  typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] : fallback

export const booleanValue = (input: Record<string, unknown>, key: string, fallback: boolean) =>
  typeof input[key] === 'boolean' ? input[key] : fallback

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
  ...(stringArrayValue(input, 'allowedTools').length > 0
    ? { allowedTools: stringArrayValue(input, 'allowedTools') }
    : {}),
  maxToolCalls: Math.min(Math.max(numberValue(input, 'maxToolCalls', defaultMaxToolCalls), 1), 100),
  timeoutMs: Math.min(Math.max(numberValue(input, 'timeoutMs', defaultTimeoutMs), 1000), 360_0000),
  requireFinalAnswer: booleanValue(input, 'requireFinalAnswer', true)
})

export const summarizeAiRunInput = (input: Record<string, unknown>) => {
  const prompt = stringValue(input, 'prompt').trim()
  const provider = stringValue(input, 'providerId')
  const model = stringValue(input, 'modelId')
  const visionProvider = stringValue(input, 'visionProviderId')
  const visionModel = stringValue(input, 'visionModelId')
  const maxToolCalls = numberValue(input, 'maxToolCalls', defaultMaxToolCalls)
  const timeoutSeconds = Math.round(numberValue(input, 'timeoutMs', defaultTimeoutMs) / 1000)
  const preview = prompt.length > 72 ? `${prompt.slice(0, 72)}...` : prompt || 'No prompt'
  const vision =
    visionProvider || visionModel
      ? ` · vision ${visionProvider || 'default'}${visionModel ? `/${visionModel}` : ''}`
      : ''
  return `${preview} · planner ${provider || 'default'}${model ? `/${model}` : ''}${vision} · ${timeoutSeconds}s · ${maxToolCalls} calls`
}

export const selectableAiRunCommands = (commands: AutomationCommand[]) =>
  commands.filter(command => command.uses !== 'ai.run').sort((left, right) => left.uses.localeCompare(right.uses))

export const buildAiRunCatalogPatch = ({
  catalog,
  modelId,
  providerId,
  visionModelId,
  visionProviderId
}: {
  catalog: AutomationAiModelCatalogProvider[]
  modelId: string
  providerId: string
  visionModelId: string
  visionProviderId: string
}) => {
  const plannerProviders = catalogByRole(catalog, 'planner')
  const visionProviders = catalogByRole(catalog, 'vision')
  const provider = selectCatalogProvider(plannerProviders, providerId)
  const model = selectCatalogModel(provider, modelId, 'planner')
  const visionProvider = selectCatalogProvider(visionProviders, visionProviderId)
  const visionModel = selectCatalogModel(visionProvider, visionModelId, 'vision')
  const patch: Record<string, unknown> = {}
  if (provider && provider.id !== providerId) patch.providerId = provider.id
  if (model && model.id !== modelId) patch.modelId = model.id
  if (visionProvider && !visionProviderId) patch.visionProviderId = visionProvider.id
  if (visionModel && !visionModelId) patch.visionModelId = visionModel.id
  return patch
}

export const nextAllowedAiRunTools = ({
  allowedTools,
  commands,
  enabled,
  uses
}: {
  allowedTools: string[]
  commands: AutomationCommand[]
  enabled: boolean
  uses: string
}) => {
  const next = new Set(allowedTools.length === 0 ? commands.map(command => command.uses) : allowedTools)
  if (enabled) next.add(uses)
  else next.delete(uses)
  const selected = Array.from(next)
  return selected.length === commands.length ? [] : selected
}

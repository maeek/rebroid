import type { AutomationAiProviderModelRole } from './provider-form-model'
import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export const modelPurposes: { role: AutomationAiProviderModelRole; label: string; description: string }[] = [
  { role: 'controller', label: 'Device control', description: 'Choose and execute actions on Android devices.' },
  { role: 'planner', label: 'Planning', description: 'Plan automation steps. Also available for device control.' },
  { role: 'vision', label: 'Screen understanding', description: 'Interpret screenshots for automation.' }
]

export const normalizeModelRoles = (roles: AutomationAiProviderModelRole[]): AutomationAiProviderModelRole[] => {
  const selected = new Set(roles)
  if (selected.has('planner')) selected.add('controller')
  return modelPurposes.map(purpose => purpose.role).filter(role => selected.has(role))
}

export const modelPurposeText = (roles: AutomationAiProviderModelRole[]) =>
  modelPurposes
    .filter(purpose => roles.includes(purpose.role))
    .map(purpose => purpose.label)
    .join(', ') || 'No purpose assigned'

export const defaultModelFor = (models: AutomationAiProviderModel[], role: AutomationAiProviderModelRole) =>
  models.find(model => model.enabled && model.roles.includes(role) && model.defaultFor.includes(role)) ??
  models.find(model => model.enabled && model.roles.includes(role))

// Match the API's first-enabled fallback so the draft previews the defaults that will be saved.
export const normalizeModelDefaults = (models: AutomationAiProviderModel[]): AutomationAiProviderModel[] => {
  const normalized = models.map(model => ({ ...model, roles: normalizeModelRoles(model.roles) }))
  const defaults = modelPurposes.map(({ role }) => ({ role, id: defaultModelFor(normalized, role)?.id }))
  return normalized.map(model => ({
    ...model,
    defaultFor: defaults.filter(item => item.id === model.id).map(item => item.role)
  }))
}

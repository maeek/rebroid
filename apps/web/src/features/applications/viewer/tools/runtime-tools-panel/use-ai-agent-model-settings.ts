import { useEffect, useMemo, useState } from 'react'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import { clampAdHocTimeoutMinutes, DEFAULT_AD_HOC_AI_TIMEOUT_MINUTES } from './ai-agent-chat-utils'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

const isValidAgentModel = (
  provider: AutomationAiModelCatalogProvider | undefined,
  model: AutomationAiModelCatalogProvider['models'][number] | undefined,
  health: AutomationAiProviderHealth | null
) => {
  if (!provider || !model) return false
  if (health && health.status !== 'ok') return false
  return true
}

export const useAiAgentModelSettings = () => {
  const [timeoutMinutesInput, setTimeoutMinutesInput] = useState(String(DEFAULT_AD_HOC_AI_TIMEOUT_MINUTES))
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [visionProviderId, setVisionProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  const plannerCatalog = useMemo(
    () =>
      catalog
        .map(provider => ({ ...provider, models: provider.models.filter(model => model.roles?.includes('planner')) }))
        .filter(provider => provider.models.length > 0),
    [catalog]
  )
  const visionCatalog = useMemo(
    () =>
      catalog
        .map(provider => ({ ...provider, models: provider.models.filter(model => model.roles?.includes('vision')) }))
        .filter(provider => provider.models.length > 0),
    [catalog]
  )
  const selectedProvider = plannerCatalog.find(provider => provider.id === providerId) ?? plannerCatalog[0]
  const selectedModel =
    selectedProvider?.models.find(model => model.id === modelId) ??
    selectedProvider?.models.find(model => model.default) ??
    selectedProvider?.models[0]
  const selectedVisionProvider = visionCatalog.find(provider => provider.id === visionProviderId) ?? visionCatalog[0]
  const selectedVisionModel =
    selectedVisionProvider?.models.find(model => model.id === visionModelId) ??
    selectedVisionProvider?.models.find(model => model.default) ??
    selectedVisionProvider?.models[0]
  const modelIsValid = isValidAgentModel(selectedProvider, selectedModel, health)
  const adHocTimeoutMinutes = clampAdHocTimeoutMinutes(Number(timeoutMinutesInput))
  const adHocTimeoutMs = adHocTimeoutMinutes * 60_000

  const selectionMessage = useMemo(() => {
    if (!selectedProvider || !selectedModel) return 'Configure an enabled AI provider and model before sending.'
    if (health?.status === 'error') return health.message || 'Selected provider/model is not healthy.'
    if (health?.status === 'disabled') return 'Selected provider/model is disabled.'
    return null
  }, [health, selectedModel, selectedProvider])

  useEffect(() => {
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(nextCatalog => {
      if (cancelled) return
      setCatalog(nextCatalog)
      const plannerProviders = nextCatalog
        .map(item => ({ ...item, models: item.models.filter(model => model.roles?.includes('planner')) }))
        .filter(item => item.models.length > 0)
      const visionProviders = nextCatalog
        .map(item => ({ ...item, models: item.models.filter(model => model.roles?.includes('vision')) }))
        .filter(item => item.models.length > 0)
      const provider = plannerProviders[0]
      const model = provider?.models.find(item => item.default) ?? provider?.models[0]
      const visionProvider = visionProviders[0]
      const visionModel = visionProvider?.models.find(item => item.default) ?? visionProvider?.models[0]
      setProviderId(provider?.id ?? '')
      setModelId(model?.id ?? '')
      setVisionProviderId(visionProvider?.id ?? '')
      setVisionModelId(visionModel?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProvider || !selectedModel) {
      setHealth(null)
      return
    }
    let cancelled = false
    setIsCheckingHealth(true)
    void checkAutomationAiProviderHealthAction(selectedProvider.id, selectedModel.id, 'planner')
      .then(result => {
        if (!cancelled) setHealth(result)
      })
      .catch(healthError => {
        if (cancelled) return
        setHealth({
          providerId: selectedProvider.id,
          modelId: selectedModel.id,
          status: 'error',
          message: healthError instanceof Error ? healthError.message : 'Health check failed.',
          checkedAt: new Date().toISOString()
        })
      })
      .finally(() => {
        if (!cancelled) setIsCheckingHealth(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedModel, selectedProvider])

  return {
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    catalog,
    health,
    isCheckingHealth,
    modelIsValid,
    plannerCatalog,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    selectionMessage,
    setModelId,
    setProviderId,
    setVisionModelId,
    setVisionProviderId,
    setTimeoutMinutesInput,
    timeoutMinutesInput,
    visionCatalog
  }
}

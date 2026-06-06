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
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel =
    selectedProvider?.models.find(model => model.id === modelId) ??
    selectedProvider?.models.find(model => model.default) ??
    selectedProvider?.models[0]
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
      const provider = nextCatalog[0]
      const model = provider?.models.find(item => item.default) ?? provider?.models[0]
      setProviderId(provider?.id ?? '')
      setModelId(model?.id ?? '')
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
    void checkAutomationAiProviderHealthAction(selectedProvider.id, selectedModel.id)
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
    selectedModel,
    selectedProvider,
    selectionMessage,
    setModelId,
    setProviderId,
    setTimeoutMinutesInput,
    timeoutMinutesInput
  }
}

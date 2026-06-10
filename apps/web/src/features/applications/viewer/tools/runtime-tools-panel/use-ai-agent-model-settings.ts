import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import { catalogByRole, selectCatalogModel, selectCatalogProvider } from '@/shared/automation/automation-ai-catalog'
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

  const plannerCatalog = useMemo(() => catalogByRole(catalog, 'planner'), [catalog])
  const visionCatalog = useMemo(() => catalogByRole(catalog, 'vision'), [catalog])

  const selectedProvider = selectCatalogProvider(plannerCatalog, providerId)
  const selectedModel = selectCatalogModel(selectedProvider, modelId)
  const selectedVisionProvider = selectCatalogProvider(visionCatalog, visionProviderId)
  const selectedVisionModel = selectCatalogModel(selectedVisionProvider, visionModelId)
  const modelIsValid = isValidAgentModel(selectedProvider, selectedModel, health)
  const adHocTimeoutMinutes = clampAdHocTimeoutMinutes(Number(timeoutMinutesInput))
  const adHocTimeoutMs = adHocTimeoutMinutes * 60_000

  const selectionMessage = useMemo(() => {
    if (!selectedProvider || !selectedModel) return 'Configure an enabled AI provider and model before sending.'
    if (health?.status === 'error') return health.message || 'Selected provider/model is not healthy.'
    if (health?.status === 'disabled') return 'Selected provider/model is disabled.'
    return null
  }, [health, selectedModel, selectedProvider])

  const checkSelectedPlannerHealth = useCallback(async () => {
    if (!selectedProvider || !selectedModel) {
      setHealth(null)
      return
    }

    setIsCheckingHealth(true)
    try {
      setHealth(await checkAutomationAiProviderHealthAction(selectedProvider.id, selectedModel.id, 'planner'))
    } catch (healthError) {
      setHealth({
        providerId: selectedProvider.id,
        modelId: selectedModel.id,
        status: 'error',
        message: healthError instanceof Error ? healthError.message : 'Health check failed.',
        checkedAt: new Date().toISOString()
      })
    } finally {
      setIsCheckingHealth(false)
    }
  }, [selectedModel, selectedProvider])

  useEffect(() => {
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(nextCatalog => {
      if (cancelled) return
      setCatalog(nextCatalog)
      const plannerProviders = catalogByRole(nextCatalog, 'planner')
      const visionProviders = catalogByRole(nextCatalog, 'vision')
      const provider = plannerProviders[0]
      const model = selectCatalogModel(provider, '')
      const visionProvider = visionProviders[0]
      const visionModel = selectCatalogModel(visionProvider, '')
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
    recheckHealth: checkSelectedPlannerHealth,
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

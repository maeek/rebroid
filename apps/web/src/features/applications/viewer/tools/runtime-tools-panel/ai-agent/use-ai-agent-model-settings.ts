import { useCallback, useMemo, useState } from 'react'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import { useAiModelCatalogSelection, type AiModelSelectionPatch } from '@/shared/ui/ai/use-ai-model-catalog-selection'
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
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [visionProviderId, setVisionProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')

  const patchSelection = useCallback((patch: AiModelSelectionPatch) => {
    if (patch.providerId !== undefined) setProviderId(patch.providerId)
    if (patch.modelId !== undefined) setModelId(patch.modelId)
    if (patch.visionProviderId !== undefined) setVisionProviderId(patch.visionProviderId)
    if (patch.visionModelId !== undefined) setVisionModelId(patch.visionModelId)
  }, [])

  const loadCatalog = useCallback(() => listAutomationAiModelCatalogAction(), [])
  const checkPlannerHealth = useCallback(
    (nextProviderId: string, nextModelId: string) =>
      checkAutomationAiProviderHealthAction(nextProviderId, nextModelId, 'controller'),
    []
  )

  const modelSelection = useAiModelCatalogSelection({
    checkHealth: checkPlannerHealth,
    loadCatalog,
    modelId,
    onSelectionChange: patchSelection,
    providerId,
    visionModelId,
    visionProviderId
  })

  const {
    catalog,
    health,
    isCheckingHealth,
    plannerCatalog,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    setModelId: setPlannerModelId,
    setProviderId: setPlannerProviderId,
    setVisionModelId: setSelectedVisionModelId,
    setVisionProviderId: setSelectedVisionProviderId,
    visionCatalog
  } = modelSelection

  const modelIsValid = isValidAgentModel(selectedProvider, selectedModel, health)
  const adHocTimeoutMinutes = clampAdHocTimeoutMinutes(Number(timeoutMinutesInput))
  const adHocTimeoutMs = adHocTimeoutMinutes * 60_000

  const selectionMessage = useMemo(() => {
    if (!selectedProvider || !selectedModel) return 'Configure an enabled AI provider and model before sending.'
    if (health?.status === 'error') return health.message || 'Selected provider/model is not healthy.'
    if (health?.status === 'disabled') return 'Selected provider/model is disabled.'
    return null
  }, [health, selectedModel, selectedProvider])

  return {
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    catalog,
    health,
    isCheckingHealth,
    modelIsValid,
    plannerCatalog,
    recheckHealth: modelSelection.recheckHealth,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    selectionMessage,
    setModelId: setPlannerModelId,
    setProviderId: setPlannerProviderId,
    setVisionModelId: setSelectedVisionModelId,
    setVisionProviderId: setSelectedVisionProviderId,
    setTimeoutMinutesInput,
    timeoutMinutesInput,
    visionCatalog
  }
}

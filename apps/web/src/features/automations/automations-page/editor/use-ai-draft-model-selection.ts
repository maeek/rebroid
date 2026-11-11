import { useEffect, useMemo, useState } from 'react'
import { listAutomationAiModelCatalogAction } from '@/server/orchestrator/settings/actions'
import { selectCatalogModel } from '@/shared/model/ai-model-catalog'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { selectAiDraftProviderAndModel } from './ai-draft-model-selection-utils'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const useAiDraftModelSelection = () => {
  const { isFeatureEnabled } = useFeatureFlags()
  const aiEnabled = isFeatureEnabled('feature.ai')
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const { provider, model } = useMemo(
    () => selectAiDraftProviderAndModel(catalog, providerId, modelId),
    [catalog, modelId, providerId]
  )

  useEffect(() => {
    if (!aiEnabled) return
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(nextCatalog => {
      if (cancelled) return
      setCatalog(nextCatalog)
      const nextProvider = nextCatalog[0]
      const nextModel = selectCatalogModel(nextProvider, '', 'planner')
      setProviderId(nextProvider?.id ?? '')
      setModelId(nextModel?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [aiEnabled])

  return {
    canDraftFromPrompt: aiEnabled && Boolean(provider && model),
    catalog,
    model,
    modelId,
    provider,
    providerId,
    setModelId,
    setProviderId
  }
}

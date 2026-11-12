import { useEffect, useMemo, useState } from 'react'
import { listAutomationAiModelCatalogAction } from '@/server/orchestrator/settings/actions'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { selectAiDraftProviderAndModel } from './ai-draft-model-selection-utils'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const useAiDraftModelSelection = (permitted: boolean) => {
  const { isFeatureEnabled } = useFeatureFlags()
  const aiEnabled = permitted && isFeatureEnabled('feature.ai')
  const [models, setModels] = useState<AutomationAiModelCatalogProvider[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const { catalog, provider, model } = useMemo(
    () => selectAiDraftProviderAndModel(models, providerId, modelId),
    [models, modelId, providerId]
  )

  useEffect(() => {
    if (!aiEnabled) return
    let cancelled = false
    void listAutomationAiModelCatalogAction().then(
      nextCatalog => {
        if (cancelled) return
        setModels(nextCatalog)
        setCatalogStatus('ready')
      },
      () => {
        if (cancelled) return
        setModels([])
        setCatalogStatus('error')
      }
    )
    return () => {
      cancelled = true
    }
  }, [aiEnabled])

  return {
    canDraftFromPrompt: aiEnabled,
    catalog,
    catalogStatus,
    model,
    modelId,
    provider,
    providerId,
    setModelId,
    setProviderId
  }
}

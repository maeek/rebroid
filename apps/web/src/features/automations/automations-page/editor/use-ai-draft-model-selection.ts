import { useEffect, useMemo, useState } from 'react'
import { listAutomationAiModelCatalogAction } from '@/server/orchestrator/settings/actions'
import { selectCatalogModel } from '@/shared/automation/automation-ai-catalog'
import { selectAiDraftProviderAndModel } from './ai-draft-model-selection-utils'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const useAiDraftModelSelection = () => {
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const { provider, model } = useMemo(
    () => selectAiDraftProviderAndModel(catalog, providerId, modelId),
    [catalog, modelId, providerId]
  )

  useEffect(() => {
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
  }, [])

  return {
    canDraftFromPrompt: Boolean(provider && model),
    catalog,
    model,
    modelId,
    provider,
    providerId,
    setModelId,
    setProviderId
  }
}

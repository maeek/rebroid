import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  nextCatalogProviderAndModel,
  selectMatchingVisionPair,
  selectPlannerVisionCatalog
} from '@rebroid/ai-core/provider'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

export type AiModelSelectionPatch = {
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}

type AiModelCatalogSelectionInput = {
  checkHealth?: (providerId: string, modelId: string) => Promise<AutomationAiProviderHealth>
  loadCatalog: () => Promise<AutomationAiModelCatalogProvider[]>
  modelId: string
  onSelectionChange: (patch: AiModelSelectionPatch) => void
  providerId: string
  visionModelId: string
  visionProviderId: string
  visionPatchMode?: 'missing' | 'mismatch'
}

const errorHealth = ({
  error,
  modelId,
  providerId
}: {
  error: unknown
  modelId: string
  providerId: string
}): AutomationAiProviderHealth => ({
  providerId,
  modelId,
  status: 'error',
  message: error instanceof Error ? error.message : 'Health check failed.',
  checkedAt: new Date().toISOString()
})

export const useAiModelCatalogSelection = ({
  checkHealth,
  loadCatalog,
  modelId,
  onSelectionChange,
  providerId,
  visionModelId,
  visionPatchMode = 'mismatch',
  visionProviderId
}: AiModelCatalogSelectionInput) => {
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const latestSelectionInputRef = useRef({ modelId, providerId, visionModelId, visionProviderId })
  const onSelectionChangeRef = useRef(onSelectionChange)

  useEffect(() => {
    latestSelectionInputRef.current = { modelId, providerId, visionModelId, visionProviderId }
    onSelectionChangeRef.current = onSelectionChange
  }, [modelId, onSelectionChange, providerId, visionModelId, visionProviderId])

  const selection = useMemo(
    () => selectPlannerVisionCatalog({ catalog, modelId, providerId, visionModelId, visionProviderId }),
    [catalog, modelId, providerId, visionModelId, visionProviderId]
  )

  const patchSelectionFromCatalog = useCallback(
    (nextCatalog: AutomationAiModelCatalogProvider[]) => {
      const current = latestSelectionInputRef.current
      const nextSelection = selectPlannerVisionCatalog({
        catalog: nextCatalog,
        modelId: current.modelId,
        providerId: current.providerId,
        visionModelId: current.visionModelId,
        visionProviderId: current.visionProviderId
      })
      const patch: AiModelSelectionPatch = {}
      if (nextSelection.selectedProvider && nextSelection.selectedProvider.id !== current.providerId) {
        patch.providerId = nextSelection.selectedProvider.id
      }
      if (nextSelection.selectedModel && nextSelection.selectedModel.id !== current.modelId) {
        patch.modelId = nextSelection.selectedModel.id
      }
      if (
        nextSelection.selectedVisionProvider &&
        (visionPatchMode === 'mismatch'
          ? nextSelection.selectedVisionProvider.id !== current.visionProviderId
          : !current.visionProviderId)
      ) {
        patch.visionProviderId = nextSelection.selectedVisionProvider.id
      }
      if (
        nextSelection.selectedVisionModel &&
        (visionPatchMode === 'mismatch'
          ? nextSelection.selectedVisionModel.id !== current.visionModelId
          : !current.visionModelId)
      ) {
        patch.visionModelId = nextSelection.selectedVisionModel.id
      }
      if (Object.keys(patch).length > 0) onSelectionChangeRef.current(patch)
    },
    [visionPatchMode]
  )

  useEffect(() => {
    let cancelled = false
    setIsLoadingCatalog(true)
    void loadCatalog()
      .then(nextCatalog => {
        if (cancelled) return
        setCatalog(nextCatalog)
        patchSelectionFromCatalog(nextCatalog)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadCatalog, patchSelectionFromCatalog])

  const checkSelectedPlannerHealth = useCallback(async () => {
    if (!checkHealth || !selection.selectedProvider || !selection.selectedModel) {
      setHealth(null)
      return
    }

    setIsCheckingHealth(true)
    try {
      setHealth(await checkHealth(selection.selectedProvider.id, selection.selectedModel.id))
    } catch (error) {
      setHealth(
        errorHealth({
          error,
          providerId: selection.selectedProvider.id,
          modelId: selection.selectedModel.id
        })
      )
    } finally {
      setIsCheckingHealth(false)
    }
  }, [checkHealth, selection.selectedModel, selection.selectedProvider])

  useEffect(() => {
    if (!checkHealth || !selection.selectedProvider || !selection.selectedModel) {
      setHealth(null)
      return
    }

    let cancelled = false
    setIsCheckingHealth(true)
    void checkHealth(selection.selectedProvider.id, selection.selectedModel.id)
      .then(result => {
        if (!cancelled) setHealth(result)
      })
      .catch(error => {
        if (cancelled || !selection.selectedProvider || !selection.selectedModel) return
        setHealth(
          errorHealth({
            error,
            providerId: selection.selectedProvider.id,
            modelId: selection.selectedModel.id
          })
        )
      })
      .finally(() => {
        if (!cancelled) setIsCheckingHealth(false)
      })
    return () => {
      cancelled = true
    }
  }, [checkHealth, selection.selectedModel, selection.selectedProvider])

  const setPlannerModelId = useCallback(
    (nextModelId: string) => {
      const nextModel = selection.selectedProvider?.models.find(model => model.id === nextModelId)
      const matchingVision = selectMatchingVisionPair({
        plannerModel: nextModel,
        plannerProvider: selection.selectedProvider,
        visionCatalog: selection.visionCatalog
      })
      onSelectionChange({
        modelId: nextModelId,
        ...(matchingVision.provider && matchingVision.model
          ? {
              visionProviderId: matchingVision.provider.id,
              visionModelId: matchingVision.model.id
            }
          : {})
      })
    },
    [onSelectionChange, selection.selectedProvider, selection.visionCatalog]
  )

  const setPlannerProviderId = useCallback(
    (nextProviderId: string) => {
      const nextSelection = nextCatalogProviderAndModel(selection.plannerCatalog, nextProviderId, 'planner')
      const matchingVision = selectMatchingVisionPair({
        plannerModel: nextSelection.model,
        plannerProvider: nextSelection.provider,
        visionCatalog: selection.visionCatalog
      })
      onSelectionChange({
        providerId: nextProviderId,
        modelId: nextSelection.model?.id ?? '',
        ...(matchingVision.provider && matchingVision.model
          ? {
              visionProviderId: matchingVision.provider.id,
              visionModelId: matchingVision.model.id
            }
          : {})
      })
    },
    [onSelectionChange, selection.plannerCatalog, selection.visionCatalog]
  )

  const setVisionProviderId = useCallback(
    (nextProviderId: string) => {
      const nextSelection = nextCatalogProviderAndModel(selection.visionCatalog, nextProviderId, 'vision')
      onSelectionChange({
        visionProviderId: nextProviderId,
        visionModelId: nextSelection.model?.id ?? ''
      })
    },
    [onSelectionChange, selection.visionCatalog]
  )

  return {
    ...selection,
    catalog,
    health,
    isCheckingHealth,
    isLoadingCatalog,
    recheckHealth: checkSelectedPlannerHealth,
    setModelId: setPlannerModelId,
    setProviderId: setPlannerProviderId,
    setVisionModelId: (nextModelId: string) => onSelectionChange({ visionModelId: nextModelId }),
    setVisionProviderId
  }
}

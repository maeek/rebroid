import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  selectCatalogProviderAndModel,
  selectMatchingVisionPair,
  selectRoleVisionCatalog,
  type AiModelRole
} from '@/shared/model/ai-model-catalog'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

export type AiModelSelectionPatch = {
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}

type AiModelCatalogSelectionInput = {
  checkHealth?: (providerId: string, modelId: string, role: AiModelRole) => Promise<AutomationAiProviderHealth>
  loadCatalog: () => Promise<AutomationAiModelCatalogProvider[]>
  modelId: string
  onSelectionChange: (patch: AiModelSelectionPatch) => void
  providerId: string
  role: Exclude<AiModelRole, 'vision'>
  visionModelId: string
  visionProviderId: string
  selectionMode?: 'automatic' | 'explicit'
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
  role,
  visionModelId,
  selectionMode = 'automatic',
  visionProviderId
}: AiModelCatalogSelectionInput) => {
  const [catalog, setCatalog] = useState<AutomationAiModelCatalogProvider[]>([])
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const latestSelectionInputRef = useRef({ modelId, providerId, visionModelId, visionProviderId })
  const onSelectionChangeRef = useRef(onSelectionChange)
  const healthRequest = useRef(0)

  useEffect(() => {
    latestSelectionInputRef.current = { modelId, providerId, visionModelId, visionProviderId }
    onSelectionChangeRef.current = onSelectionChange
  }, [modelId, onSelectionChange, providerId, visionModelId, visionProviderId])

  const selection = useMemo(
    () =>
      selectRoleVisionCatalog({
        catalog,
        modelId,
        providerId,
        role,
        visionModelId,
        visionProviderId,
        preserveExplicitIds: selectionMode === 'explicit'
      }),
    [catalog, modelId, providerId, role, selectionMode, visionModelId, visionProviderId]
  )

  const patchSelectionFromCatalog = useCallback(
    (nextCatalog: AutomationAiModelCatalogProvider[]) => {
      const current = latestSelectionInputRef.current
      const nextSelection = selectRoleVisionCatalog({
        role,
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
        nextSelection.selectedVisionProvider.id !== current.visionProviderId
      ) {
        patch.visionProviderId = nextSelection.selectedVisionProvider.id
      }
      if (nextSelection.selectedVisionModel && nextSelection.selectedVisionModel.id !== current.visionModelId) {
        patch.visionModelId = nextSelection.selectedVisionModel.id
      }
      if (Object.keys(patch).length > 0) onSelectionChangeRef.current(patch)
    },
    [role]
  )

  useEffect(() => {
    let cancelled = false
    setIsLoadingCatalog(true)
    void loadCatalog()
      .then(nextCatalog => {
        if (cancelled) return
        setCatalog(nextCatalog)
        if (selectionMode === 'automatic') patchSelectionFromCatalog(nextCatalog)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadCatalog, patchSelectionFromCatalog, selectionMode])

  const selectedProviderId = selection.selectedProvider?.id
  const selectedModelId = selection.selectedModel?.id
  const checkSelectedModelHealth = useCallback(async () => {
    const request = ++healthRequest.current
    if (!checkHealth || !selectedProviderId || !selectedModelId) {
      setHealth(null)
      setIsCheckingHealth(false)
      return
    }

    setIsCheckingHealth(true)
    try {
      const result = await checkHealth(selectedProviderId, selectedModelId, role)
      if (request === healthRequest.current) setHealth(result)
    } catch (error) {
      if (request === healthRequest.current) {
        setHealth(errorHealth({ error, providerId: selectedProviderId, modelId: selectedModelId }))
      }
    } finally {
      if (request === healthRequest.current) setIsCheckingHealth(false)
    }
  }, [checkHealth, role, selectedModelId, selectedProviderId])

  useEffect(() => {
    void checkSelectedModelHealth()
    return () => {
      healthRequest.current += 1
    }
  }, [checkSelectedModelHealth])

  const selectPrimaryModel = useCallback(
    (nextProviderId: string, nextModelId = '') => {
      const { provider, model } = selectCatalogProviderAndModel(
        selection.primaryCatalog,
        nextProviderId,
        nextModelId,
        role
      )
      const patch: AiModelSelectionPatch = { providerId: nextProviderId, modelId: model?.id }
      if (selectionMode === 'automatic') {
        patch.modelId ??= ''
        const vision = selectMatchingVisionPair({
          plannerModel: model,
          plannerProvider: provider,
          visionCatalog: selection.visionCatalog
        })
        if (vision.model && vision.provider) {
          patch.visionProviderId = vision.provider.id
          patch.visionModelId = vision.model.id
        }
      }
      onSelectionChange(patch)
    },
    [onSelectionChange, role, selection.primaryCatalog, selection.visionCatalog, selectionMode]
  )

  const setVisionProviderId = useCallback(
    (nextProviderId: string) => {
      const nextSelection = selectCatalogProviderAndModel(selection.visionCatalog, nextProviderId, '', 'vision')
      onSelectionChange({
        visionProviderId: nextProviderId,
        visionModelId: nextSelection.model?.id
      })
    },
    [onSelectionChange, selection.visionCatalog]
  )

  return {
    ...selection,
    catalog,
    health: health?.providerId === selectedProviderId && health?.modelId === selectedModelId ? health : null,
    isCheckingHealth,
    isLoadingCatalog,
    recheckHealth: checkSelectedModelHealth,
    selectPrimaryModel,
    setVisionModelId: (nextModelId: string) => onSelectionChange({ visionModelId: nextModelId }),
    setVisionProviderId
  }
}

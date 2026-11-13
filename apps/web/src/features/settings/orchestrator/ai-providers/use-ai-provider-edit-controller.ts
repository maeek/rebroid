import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationAiProviderModelAction,
  downloadAutomationAiProviderModelAction,
  getAutomationAiProviderModelDownloadAction,
  listAutomationAiProviderRemoteModelsAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import {
  createProviderModelRows,
  emptyModel,
  normalizeProviderForm,
  setDefaultProviderModelAt,
  updateProviderModelAt,
  type AutomationAiProviderModelRole,
  type ProviderFormState
} from './provider-form-model'
import { normalizeModelDefaults, normalizeModelRoles } from './provider-model-usage'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/shared/contracts/ai-provider'

const controllerPlannerRoles = (): AutomationAiProviderModelRole[] => ['controller', 'planner']

export const useAiProviderEditController = (initialProvider: AutomationAiProvider) => {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderFormState>(() => structuredClone(initialProvider))
  const [savedProvider, setSavedProvider] = useState(initialProvider)
  const saveFeedback = useSaveFeedback(JSON.stringify(provider))
  const isDirty =
    JSON.stringify(normalizeProviderForm(provider)) !== JSON.stringify(normalizeProviderForm(savedProvider))
  const mutationInFlight = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloadingModel, setIsDownloadingModel] = useState(false)
  const [modelDownloads, setModelDownloads] = useState<Record<string, AutomationAiProviderModelDownload>>({})
  const [remoteModels, setRemoteModels] = useState<AutomationAiProviderRemoteModel[]>([])
  const [isLoadingRemoteModels, setIsLoadingRemoteModels] = useState(false)
  const [remoteModelsError, setRemoteModelsError] = useState<string | null>(null)
  const modelRows = useMemo(() => createProviderModelRows(provider.models), [provider.models])

  const updateProvider = (patch: Partial<ProviderFormState>) => setProvider(current => ({ ...current, ...patch }))

  const updateModel = useCallback((index: number, patch: Partial<AutomationAiProviderModel>) => {
    setProvider(current => ({
      ...current,
      models: normalizeModelDefaults(updateProviderModelAt(current.models, index, patch))
    }))
  }, [])

  const removeModel = useCallback(
    (index: number) =>
      setProvider(current => ({
        ...current,
        models: normalizeModelDefaults(current.models.filter((_, modelIndex) => modelIndex !== index))
      })),
    []
  )

  const updateModels = useCallback((indexes: number[], patch: Partial<AutomationAiProviderModel>) => {
    const selectedIndexes = new Set(indexes)
    setProvider(current => ({
      ...current,
      models: normalizeModelDefaults(
        current.models.map((model, modelIndex) => (selectedIndexes.has(modelIndex) ? { ...model, ...patch } : model))
      )
    }))
  }, [])

  const removeModels = useCallback((indexes: number[]) => {
    const selectedIndexes = new Set(indexes)
    setProvider(current => ({
      ...current,
      models: normalizeModelDefaults(current.models.filter((_, modelIndex) => !selectedIndexes.has(modelIndex)))
    }))
  }, [])

  const setDefaultModel = useCallback(
    (index: number, role: AutomationAiProviderModelRole) =>
      setProvider(current => ({
        ...current,
        models: setDefaultProviderModelAt(current.models, index, role)
      })),
    []
  )

  const addModel = useCallback(
    async (modelId: string, label?: string, roles: AutomationAiProviderModelRole[] = controllerPlannerRoles()) => {
      if (isDirty || mutationInFlight.current) return false
      const normalizedModelId = modelId.trim()
      if (!normalizedModelId) {
        toast({
          title: 'Model ID is required',
          description: 'Select or enter a model before adding it.',
          variant: 'danger'
        })
        return false
      }

      if (provider.models.some(model => model.id === normalizedModelId)) {
        toast({
          title: 'Model already exists',
          description: normalizedModelId,
          variant: 'danger'
        })
        return false
      }

      const nextLabel = label?.trim() || normalizedModelId
      const nextModel = {
        ...emptyModel(),
        id: normalizedModelId,
        label: nextLabel,
        roles: normalizeModelRoles(roles),
        defaultFor: provider.models.length === 0 ? normalizeModelRoles(roles) : []
      }

      mutationInFlight.current = true
      try {
        const savedModel = await createAutomationAiProviderModelAction(initialProvider.id, nextModel)
        setProvider(current => ({
          ...current,
          models: normalizeModelDefaults([...current.models, savedModel])
        }))
        setSavedProvider(current => ({ ...current, models: normalizeModelDefaults([...current.models, savedModel]) }))
        toast({ title: 'AI model added', description: normalizedModelId, variant: 'success' })
        router.refresh()
        return true
      } catch (error) {
        toast({
          title: 'Could not add AI model',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
        return false
      } finally {
        mutationInFlight.current = false
      }
    },
    [initialProvider.id, isDirty, provider.models, router]
  )

  const downloadsRef = useRef(modelDownloads)
  useEffect(() => {
    downloadsRef.current = modelDownloads
  }, [modelDownloads])
  const hasActiveDownloads = Object.values(modelDownloads).some(download =>
    ['queued', 'running'].includes(download.status)
  )
  useEffect(() => {
    if (!hasActiveDownloads) return
    let disposed = false
    let inFlight = false
    const interval = window.setInterval(() => {
      if (inFlight) return
      inFlight = true
      const active = Object.values(downloadsRef.current).filter(download =>
        ['queued', 'running'].includes(download.status)
      )
      void Promise.all(
        active.map(async download => {
          try {
            return await getAutomationAiProviderModelDownloadAction(initialProvider.id, download.id)
          } catch {
            return null
          }
        })
      )
        .then(results => {
          if (disposed) return
          const updates = results.filter((download): download is AutomationAiProviderModelDownload => download !== null)
          if (updates.length === 0) return
          setModelDownloads(current => ({
            ...current,
            ...Object.fromEntries(updates.map(download => [download.modelId, download]))
          }))
          for (const next of updates) {
            if (next.status === 'completed') {
              toast({ title: 'AI model downloaded', description: next.modelId, variant: 'success' })
              router.refresh()
            }
            if (next.status === 'failed')
              toast({ title: 'Could not download AI model', description: next.message, variant: 'danger' })
          }
        })
        .finally(() => {
          inFlight = false
        })
    }, 1500)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [hasActiveDownloads, initialProvider.id, router])

  const loadRemoteModels = useCallback(async () => {
    setIsLoadingRemoteModels(true)
    setRemoteModelsError(null)
    try {
      setRemoteModels(await listAutomationAiProviderRemoteModelsAction(initialProvider.id))
    } catch (error) {
      setRemoteModels([])
      setRemoteModelsError(error instanceof Error ? error.message : 'Could not list provider models.')
    } finally {
      setIsLoadingRemoteModels(false)
    }
  }, [initialProvider.id])

  const downloadModel = async (modelId: string, label?: string) => {
    if (isDirty || mutationInFlight.current) throw new Error('Save or discard changes before downloading a model.')
    const normalizedModelId = modelId.trim()
    if (!normalizedModelId) {
      toast({
        title: 'Model ID is required',
        description: 'Enter the Ollama model name to download.',
        variant: 'danger'
      })
      return
    }

    mutationInFlight.current = true
    setIsDownloadingModel(true)
    try {
      const job = await downloadAutomationAiProviderModelAction(initialProvider.id, {
        modelId: normalizedModelId,
        label: label?.trim() || undefined
      })
      setModelDownloads(current => ({ ...current, [job.modelId]: job }))
      const appendDownloadedModel = (current: ProviderFormState): ProviderFormState => {
        if (current.models.some(model => model.id === normalizedModelId)) return current
        return {
          ...current,
          models: normalizeModelDefaults([
            ...current.models,
            {
              ...emptyModel(),
              id: normalizedModelId,
              label: label?.trim() || normalizedModelId
            }
          ])
        }
      }
      setProvider(appendDownloadedModel)
      setSavedProvider(appendDownloadedModel)
      toast({ title: 'AI model download started', description: normalizedModelId, variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not download AI model',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
      throw error
    } finally {
      mutationInFlight.current = false
      setIsDownloadingModel(false)
    }
  }

  const saveProvider = async () => {
    if (mutationInFlight.current) return
    const input = normalizeProviderForm(provider)
    if (!input.id || !input.baseUrl) {
      toast({
        title: 'Provider is incomplete',
        description: 'Provider ID and base URL are required.',
        variant: 'danger'
      })
      return
    }

    mutationInFlight.current = true
    saveFeedback.resetSaveFeedback()
    setIsSaving(true)
    try {
      const saved = await updateAutomationAiProviderAction(initialProvider.id, input)
      const nextProvider = structuredClone(saved)
      setProvider(nextProvider)
      saveFeedback.confirmSaved(JSON.stringify(nextProvider))
      setSavedProvider(saved)
      toast({ title: 'AI provider updated', variant: 'success' })
      if (saved.id !== initialProvider.id) {
        router.replace(`/platform/ai/${encodeURIComponent(saved.id)}`)
      } else {
        router.refresh()
      }
      return saved
    } catch (error) {
      toast({
        title: 'Could not save AI provider',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      mutationInFlight.current = false
      setIsSaving(false)
    }
  }

  return {
    addModel,
    downloadModel,
    isDownloadingModel,
    isLoadingRemoteModels,
    isSaving,
    isDirty,
    savedProvider,
    discardChanges: () => setProvider(structuredClone(savedProvider)),
    loadRemoteModels,
    modelDownloads,
    modelRows,
    provider,
    removeModel,
    removeModels,
    remoteModels,
    remoteModelsError,
    saveProvider,
    saveSucceeded: saveFeedback.saved,
    setDefaultModel,
    updateModel,
    updateModels,
    updateProvider
  }
}

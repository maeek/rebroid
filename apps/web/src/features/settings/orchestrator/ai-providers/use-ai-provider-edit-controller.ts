import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createProviderModelRows,
  emptyModel,
  normalizeProviderForm,
  setDefaultProviderModelAt,
  updateProviderModelAt,
  type AutomationAiProviderModelRole,
  type ProviderFormState
} from '@rebroid/ai-core/provider'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationAiProviderModelAction,
  downloadAutomationAiProviderModelAction,
  getAutomationAiProviderModelDownloadAction,
  listAutomationAiProviderRemoteModelsAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/server/orchestrator/settings/types'

export const useAiProviderEditController = (initialProvider: AutomationAiProvider) => {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderFormState>(
    JSON.parse(JSON.stringify(initialProvider)) as AutomationAiProvider
  )
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
      models: updateProviderModelAt(current.models, index, patch)
    }))
  }, [])

  const removeModel = useCallback(
    (index: number) =>
      setProvider(current => ({ ...current, models: current.models.filter((_, modelIndex) => modelIndex !== index) })),
    []
  )

  const updateModels = useCallback((indexes: number[], patch: Partial<AutomationAiProviderModel>) => {
    const selectedIndexes = new Set(indexes)
    setProvider(current => ({
      ...current,
      models: current.models.map((model, modelIndex) =>
        selectedIndexes.has(modelIndex) ? { ...model, ...patch } : model
      )
    }))
  }, [])

  const removeModels = useCallback((indexes: number[]) => {
    const selectedIndexes = new Set(indexes)
    setProvider(current => ({
      ...current,
      models: current.models.filter((_, modelIndex) => !selectedIndexes.has(modelIndex))
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
    async (modelId: string, label?: string) => {
      const normalizedModelId = modelId.trim()
      if (!normalizedModelId) {
        toast({
          title: 'Model ID is required',
          description: 'Select or enter a model before adding it.',
          variant: 'destructive'
        })
        return false
      }

      if (provider.models.some(model => model.id === normalizedModelId)) {
        toast({
          title: 'Model already exists',
          description: normalizedModelId,
          variant: 'destructive'
        })
        return false
      }

      const nextLabel = label?.trim() || normalizedModelId
      const nextModel = {
        ...emptyModel(),
        id: normalizedModelId,
        label: nextLabel,
        defaultFor: provider.models.length === 0 ? (['planner'] as AutomationAiProviderModelRole[]) : []
      }

      try {
        const savedModel = await createAutomationAiProviderModelAction(initialProvider.id, nextModel)
        setProvider(current => ({
          ...current,
          models: [...current.models, savedModel]
        }))
        toast({ title: 'AI model added', description: normalizedModelId })
        router.refresh()
        return true
      } catch (error) {
        toast({
          title: 'Could not add AI model',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
        return false
      }
    },
    [initialProvider.id, provider.models, router]
  )

  useEffect(() => {
    const activeDownloads = Object.values(modelDownloads).filter(download =>
      ['queued', 'running'].includes(download.status)
    )
    if (activeDownloads.length === 0) return

    const interval = window.setInterval(() => {
      for (const download of activeDownloads) {
        void getAutomationAiProviderModelDownloadAction(initialProvider.id, download.id)
          .then(next => {
            setModelDownloads(current => ({ ...current, [next.modelId]: next }))
            if (next.status === 'completed') {
              toast({ title: 'AI model downloaded', description: next.modelId })
              router.refresh()
            }
            if (next.status === 'failed') {
              toast({
                title: 'Could not download AI model',
                description: next.message,
                variant: 'destructive'
              })
            }
          })
          .catch(error => {
            setModelDownloads(current => ({
              ...current,
              [download.modelId]: {
                ...download,
                status: 'failed',
                message: error instanceof Error ? error.message : 'Could not read download progress.'
              }
            }))
          })
      }
    }, 1500)

    return () => window.clearInterval(interval)
  }, [initialProvider.id, modelDownloads, router])

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
  }, [initialProvider.id, initialProvider.kind])

  const downloadModel = async (modelId: string, label?: string) => {
    const normalizedModelId = modelId.trim()
    if (!normalizedModelId) {
      toast({
        title: 'Model ID is required',
        description: 'Enter the Ollama model name to download.',
        variant: 'destructive'
      })
      return
    }

    setIsDownloadingModel(true)
    try {
      const job = await downloadAutomationAiProviderModelAction(initialProvider.id, {
        modelId: normalizedModelId,
        label: label?.trim() || undefined
      })
      setModelDownloads(current => ({ ...current, [job.modelId]: job }))
      setProvider(current => {
        if (current.models.some(model => model.id === normalizedModelId)) return current
        const nextLabel = label?.trim() || normalizedModelId
        return {
          ...current,
          models: [
            ...current.models,
            {
              ...emptyModel(),
              id: normalizedModelId,
              label: nextLabel,
              defaultFor: current.models.length === 0 ? (['planner'] as AutomationAiProviderModelRole[]) : []
            }
          ]
        }
      })
      toast({ title: 'AI model download started', description: normalizedModelId })
    } catch (error) {
      toast({
        title: 'Could not download AI model',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsDownloadingModel(false)
    }
  }

  const saveProvider = async () => {
    const input = normalizeProviderForm(provider)
    if (!input.id || !input.baseUrl) {
      toast({
        title: 'Provider is incomplete',
        description: 'Provider ID and base URL are required.',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)
    try {
      const saved = await updateAutomationAiProviderAction(initialProvider.id, input)
      setProvider(JSON.parse(JSON.stringify(saved)) as AutomationAiProvider)
      toast({ title: 'AI provider updated' })
      if (saved.id !== initialProvider.id) {
        router.replace(`/orchestrator/ai-providers/${encodeURIComponent(saved.id)}`)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast({
        title: 'Could not save AI provider',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return {
    addModel,
    downloadModel,
    isDownloadingModel,
    isLoadingRemoteModels,
    isSaving,
    loadRemoteModels,
    modelDownloads,
    modelRows,
    provider,
    removeModel,
    removeModels,
    remoteModels,
    remoteModelsError,
    saveProvider,
    setDefaultModel,
    updateModel,
    updateModels,
    updateProvider
  }
}

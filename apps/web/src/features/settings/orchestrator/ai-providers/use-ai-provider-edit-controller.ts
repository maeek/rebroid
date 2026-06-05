import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import {
  downloadAutomationAiProviderModelAction,
  getAutomationAiProviderModelDownloadAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import {
  createProviderModelRows,
  emptyModel,
  normalizeProviderForm,
  setDefaultProviderModelAt,
  updateProviderModelAt,
  type ProviderFormState
} from './provider-utils'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload
} from '@/server/orchestrator/settings/types'

export const useAiProviderEditController = (initialProvider: AutomationAiProvider) => {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderFormState>(
    JSON.parse(JSON.stringify(initialProvider)) as AutomationAiProvider
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloadingModel, setIsDownloadingModel] = useState(false)
  const [modelDownload, setModelDownload] = useState<AutomationAiProviderModelDownload | null>(null)
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
    (index: number) =>
      setProvider(current => ({
        ...current,
        models: setDefaultProviderModelAt(current.models, index)
      })),
    []
  )

  const addModel = () =>
    updateProvider({
      models: [...provider.models, { ...emptyModel(), default: provider.models.length === 0 }]
    })

  useEffect(() => {
    if (!modelDownload || !['queued', 'running'].includes(modelDownload.status)) return

    const interval = window.setInterval(() => {
      void getAutomationAiProviderModelDownloadAction(initialProvider.id, modelDownload.id)
        .then(next => {
          setModelDownload(next)
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
          setModelDownload(current =>
            current
              ? {
                  ...current,
                  status: 'failed',
                  message: error instanceof Error ? error.message : 'Could not read download progress.'
                }
              : current
          )
        })
    }, 1500)

    return () => window.clearInterval(interval)
  }, [initialProvider.id, modelDownload, router])

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
      setModelDownload(job)
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
    isSaving,
    modelDownload,
    modelRows,
    provider,
    removeModel,
    removeModels,
    saveProvider,
    setDefaultModel,
    updateModel,
    updateModels,
    updateProvider
  }
}

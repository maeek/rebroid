'use client'

import { useEffect, useState, useTransition } from 'react'
import { emptyProvider, normalizeProviderForm, type ProviderFormState } from '@rebroid/ai-core/provider'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { PlatformPageRefreshButton } from '@/features/orchestrator/components/platform-page-refresh-button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  checkAutomationAiProviderCandidateHealthAction,
  createAutomationAiProviderAction,
  deleteAutomationAiProviderAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import { ProviderDialog } from './provider-dialog'
import { ProvidersGrid } from './providers-grid'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'

export const OrchestratorAiProvidersPageClient = ({
  initialProviders
}: {
  initialProviders: AutomationAiProvider[]
}) => {
  const router = useRouter()
  const [providers, setProviders] = useState(initialProviders)
  const [editingProvider, setEditingProvider] = useState<ProviderFormState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setProviders(initialProviders)
  }, [initialProviders])

  const refresh = () => {
    startRefreshTransition(() => router.refresh())
  }

  const openCreateDialog = () => {
    setEditingProvider(emptyProvider())
  }

  const openEditDialog = (provider: AutomationAiProvider) => {
    router.push(`/orchestrator/ai-providers/${encodeURIComponent(provider.id)}`)
  }

  const saveProvider = async () => {
    if (!editingProvider) return

    const input = normalizeProviderForm(editingProvider)
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
      const health = await checkAutomationAiProviderCandidateHealthAction(input)
      if (health.status !== 'ok') {
        toast({
          title: 'Provider connection failed',
          description: health.message,
          variant: 'destructive'
        })
        return
      }
      const saved = await createAutomationAiProviderAction(input)
      setProviders(current => {
        const withoutCurrent = current.filter(provider => provider.id !== saved.id)
        return [...withoutCurrent, saved].sort((left, right) => left.label.localeCompare(right.label))
      })
      setEditingProvider(null)
      toast({ title: 'AI provider created' })
      router.push(`/orchestrator/ai-providers/${encodeURIComponent(saved.id)}`)
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

  const updateSelectedProviders = async (enabled: boolean) => {
    const selected = providers.filter(provider => selectedProviderIds.has(provider.id))
    if (selected.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.all(
        selected.map(provider => updateAutomationAiProviderAction(provider.id, { enabled }))
      )
      setProviders(current => current.map(provider => results.find(result => result.id === provider.id) ?? provider))
      setSelectedProviderIds(new Set())
      toast({ title: enabled ? 'AI providers enabled' : 'AI providers disabled' })
    } catch (error) {
      toast({
        title: 'Could not update AI providers',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const deleteSelectedProviders = async () => {
    const selected = providers.filter(provider => selectedProviderIds.has(provider.id))
    if (selected.length === 0) return

    setBusyId('bulk')
    try {
      await Promise.all(selected.map(provider => deleteAutomationAiProviderAction(provider.id)))
      setProviders(current => current.filter(provider => !selectedProviderIds.has(provider.id)))
      setSelectedProviderIds(new Set())
      toast({ title: 'AI providers deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete AI providers',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const deleteProvider = async (provider: AutomationAiProvider) => {
    setBusyId(provider.id)
    try {
      await deleteAutomationAiProviderAction(provider.id)
      setProviders(current => current.filter(item => item.id !== provider.id))
      toast({ title: 'AI provider deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete AI provider',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='AI providers'
        description='Configure OpenAI, Ollama, and OpenAI-compatible providers used by AI automation steps.'
        actions={
          <div className='flex items-center gap-2'>
            <PlatformPageRefreshButton
              isRefreshing={isRefreshing}
              onRefresh={refresh}
            />
            <Button
              type='button'
              onClick={openCreateDialog}
            >
              <IconPlus className='size-4' />
              Add provider
            </Button>
          </div>
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ProvidersGrid
          providers={providers}
          busyId={busyId}
          selectedIds={selectedProviderIds}
          onSelectedIdsChange={setSelectedProviderIds}
          onEnableSelected={() => void updateSelectedProviders(true)}
          onDisableSelected={() => void updateSelectedProviders(false)}
          onDeleteSelected={() => void deleteSelectedProviders()}
          onEdit={openEditDialog}
          onDelete={provider => void deleteProvider(provider)}
        />
      </section>
      <ProviderDialog
        provider={editingProvider}
        isSaving={isSaving}
        onChange={setEditingProvider}
        onClose={() => setEditingProvider(null)}
        onSave={() => void saveProvider()}
      />
    </ProtectedStackPageLayout>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { emptyProvider, normalizeProviderForm, type ProviderFormState } from '@rebroid/ai-core/provider'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  checkAutomationAiProviderCandidateHealthAction,
  createAutomationAiProviderAction,
  deleteAutomationAiProviderAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import { saveAiUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { ProviderDialog } from './provider-dialog'
import { ProvidersGrid } from './providers-grid'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const OrchestratorAiProvidersPageClient = ({
  initialProviders,
  initialSettings
}: {
  initialProviders: AutomationAiProvider[]
  initialSettings: OrchestratorUiSettings
}) => {
  const router = useRouter()
  const [providers, setProviders] = useState(initialProviders)
  const [settings, setSettings] = useState(initialSettings)
  const [editingProvider, setEditingProvider] = useState<ProviderFormState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false)
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setProviders(initialProviders)
  }, [initialProviders])

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  const refresh = () => {
    startRefreshTransition(() => router.refresh())
  }

  const openCreateDialog = () => {
    setEditingProvider(emptyProvider())
  }

  const openEditDialog = (provider: AutomationAiProvider) => {
    router.push(`/platform/ai/${encodeURIComponent(provider.id)}`)
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
      router.push(`/platform/ai/${encodeURIComponent(saved.id)}`)
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
      toast({ title: enabled ? 'AI enabled' : 'AI disabled' })
    } catch (error) {
      toast({
        title: 'Could not update AI',
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
      toast({ title: 'AI deleted' })
    } catch (error) {
      toast({
        title: 'Could not delete AI',
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

  const updateContextualSuggestions = async (aiContextualSuggestionsEnabled: boolean) => {
    const previousValue = settings.aiContextualSuggestionsEnabled
    setSettings(current => ({ ...current, aiContextualSuggestionsEnabled }))
    setIsSavingAiSettings(true)
    try {
      const saved = await saveAiUiSettings({
        aiContextualSuggestionsEnabled
      })
      setSettings(saved)
    } catch (error) {
      setSettings(current => ({ ...current, aiContextualSuggestionsEnabled: previousValue }))
      toast({
        title: 'Could not save AI settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSavingAiSettings(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='AI'
        titlePrefix={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
        description='Configure provider connections and AI-assisted automation behavior.'
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
      <section className='flex w-full flex-col gap-4 px-6 pb-16 max-sm:px-4'>
        <label className='flex w-full items-center justify-between gap-4 rounded-md border border-border/60 bg-surface-panel/35 px-4 py-3 text-sm max-sm:flex-col max-sm:items-start'>
          <div className='min-w-0'>
            <div className='font-medium text-foreground'>Context suggestions</div>
            <div className='mt-1 text-xs text-muted-foreground'>Generate AI prompt chips in app sessions.</div>
          </div>
          <Switch
            checked={settings.aiContextualSuggestionsEnabled}
            disabled={isSavingAiSettings}
            onCheckedChange={value => void updateContextualSuggestions(value)}
          />
        </label>
        <div className='min-w-0'>
          <h2 className='text-base font-semibold text-foreground'>Providers</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Connections and model defaults available to automation and agent workflows.
          </p>
        </div>
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

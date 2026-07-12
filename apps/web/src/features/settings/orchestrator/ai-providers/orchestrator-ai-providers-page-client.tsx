'use client'

import { useEffect, useState, useTransition } from 'react'
import { emptyProvider, normalizeProviderForm, type ProviderFormState } from '@rebroid/ai-core/provider'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  checkAutomationAiProviderCandidateHealthAction,
  createAutomationAiProviderAction,
  deleteAutomationAiProviderAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import { saveAiUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
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
  const [pendingDeleteProviders, setPendingDeleteProviders] = useState<AutomationAiProvider[]>([])

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
        variant: 'danger'
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
          variant: 'danger'
        })
        return
      }
      const saved = await createAutomationAiProviderAction(input)
      setProviders(current => {
        const withoutCurrent = current.filter(provider => provider.id !== saved.id)
        return [...withoutCurrent, saved].sort((left, right) => left.label.localeCompare(right.label))
      })
      setEditingProvider(null)
      toast({ title: 'AI provider created', variant: 'success' })
      router.push(`/platform/ai/${encodeURIComponent(saved.id)}`)
    } catch (error) {
      toast({
        title: 'Could not save AI provider',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  const confirmDeleteProviders = async () => {
    if (pendingDeleteProviders.length === 0) return
    setBusyId(pendingDeleteProviders.length === 1 ? pendingDeleteProviders[0].id : 'bulk')
    try {
      const deletedIds = new Set(pendingDeleteProviders.map(provider => provider.id))
      await Promise.all(pendingDeleteProviders.map(provider => deleteAutomationAiProviderAction(provider.id)))
      setProviders(current => current.filter(provider => !deletedIds.has(provider.id)))
      setSelectedProviderIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
      toast({
        title: pendingDeleteProviders.length === 1 ? 'AI provider deleted' : 'AI providers deleted',
        variant: 'success'
      })
      setPendingDeleteProviders([])
    } catch (error) {
      toast({
        title: pendingDeleteProviders.length === 1 ? 'Could not delete AI provider' : 'Could not delete AI providers',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSavingAiSettings(false)
    }
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='AI'
        leading={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
        description='Configure provider connections and AI-assisted automation behavior.'
        actions={
          <>
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
          </>
        }
      />
      <PageContent className='gap-4'>
        <label
          htmlFor='ai-context-suggestions'
          className='flex w-full items-start justify-between gap-4 rounded-control border border-surface-border/60 bg-surface-panel/35 px-4 py-3 text-sm'
        >
          <div className='min-w-0 flex-1'>
            <div className='font-medium text-foreground'>Context suggestions</div>
            <div className='mt-1 text-xs text-foreground-muted'>Generate AI prompt chips in app sessions.</div>
          </div>
          <Switch
            id='ai-context-suggestions'
            className='shrink-0'
            checked={settings.aiContextualSuggestionsEnabled}
            disabled={isSavingAiSettings}
            onCheckedChange={value => void updateContextualSuggestions(value)}
          />
        </label>
        <div className='min-w-0'>
          <h2 className='text-base font-medium text-foreground'>Providers</h2>
          <p className='mt-1 text-sm text-foreground-muted'>
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
          onDeleteSelected={() =>
            setPendingDeleteProviders(providers.filter(provider => selectedProviderIds.has(provider.id)))
          }
          onEdit={openEditDialog}
          onDelete={provider => setPendingDeleteProviders([provider])}
        />
      </PageContent>
      <ProviderDialog
        provider={editingProvider}
        isSaving={isSaving}
        onChange={setEditingProvider}
        onClose={() => setEditingProvider(null)}
        onSave={() => void saveProvider()}
      />
      <ConfirmMutationDialog
        open={pendingDeleteProviders.length > 0}
        title={
          pendingDeleteProviders.length === 1
            ? 'Delete AI provider?'
            : `Delete ${pendingDeleteProviders.length} AI providers?`
        }
        description='This permanently removes the selected provider configuration and its model assignments.'
        summary={pendingDeleteProviders.length === 1 ? pendingDeleteProviders[0]?.label : undefined}
        consequence='Automations that depend on these providers may stop working until another provider is configured.'
        confirmLabel={pendingDeleteProviders.length === 1 ? 'Delete provider' : 'Delete providers'}
        pendingLabel='Deleting…'
        pending={busyId !== null}
        onOpenChange={open => {
          if (!open) setPendingDeleteProviders([])
        }}
        onConfirm={() => void confirmDeleteProviders()}
      />
    </StandardPage>
  )
}

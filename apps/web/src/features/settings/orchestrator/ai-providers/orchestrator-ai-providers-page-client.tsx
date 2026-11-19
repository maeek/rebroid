'use client'

import { useEffect, useState, useTransition } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationSwitch } from '@/components/ui/mutation-switch'
import { useImmediateSave } from '@/hooks/use-immediate-save'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  checkAutomationAiProviderCandidateHealthAction,
  createAutomationAiProviderAction,
  deleteAutomationAiProviderAction,
  updateAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import { successfulBulkIds, summarizeBulkResults } from '@/shared/actions/bulk-action-results'
import { saveAiUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { AiProvidersPageLayout } from './ai-providers-page-layout'
import { ProviderDialog } from './provider-dialog'
import { createProviderDraft, normalizeProviderForm, type ProviderFormState } from './provider-form-model'
import { ProvidersGrid } from './providers-grid'
import { useAiProviderBillingIssues } from './use-ai-provider-billing-issues'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'
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
  const [creationError, setCreationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const suggestionsFeedback = useImmediateSave()
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(() => new Set())
  const [pendingDeleteProviders, setPendingDeleteProviders] = useState<AutomationAiProvider[]>([])
  const { issues: billingIssues } = useAiProviderBillingIssues(providers.some(provider => provider.kind === 'openai'))

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
    setCreationError(null)
    setEditingProvider(
      createProviderDraft(
        'openai',
        providers.map(provider => provider.id)
      )
    )
  }

  const openEditDialog = (provider: AutomationAiProvider) => {
    router.push(`/platform/ai/${encodeURIComponent(provider.id)}`)
  }

  const saveProvider = async () => {
    if (!editingProvider) return

    const input = normalizeProviderForm(editingProvider)
    if (!input.id || !input.baseUrl || (input.kind === 'openai' && !input.apiKey)) {
      setCreationError('Enter a provider ID, base URL, and an API key for OpenAI.')
      return
    }

    setIsSaving(true)
    setCreationError(null)
    try {
      const health = await checkAutomationAiProviderCandidateHealthAction(input)
      if (health.status !== 'ok') {
        setCreationError(health.message)
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
      setCreationError(getDisplayErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const updateSelectedProviders = async (enabled: boolean) => {
    const selected = providers.filter(provider => selectedProviderIds.has(provider.id))
    if (selected.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.allSettled(
        selected.map(provider => updateAutomationAiProviderAction(provider.id, { enabled }))
      )
      const updated = new Map(
        results.flatMap(result => (result.status === 'fulfilled' ? [[result.value.id, result.value] as const] : []))
      )
      setProviders(current => current.map(provider => updated.get(provider.id) ?? provider))
      setSelectedProviderIds(current => new Set([...current].filter(id => !updated.has(id))))
      toast(
        summarizeBulkResults(
          results,
          enabled ? 'Providers enabled' : 'Providers disabled',
          'Could not update all providers'
        )
      )
    } finally {
      setBusyId(null)
    }
  }

  const confirmDeleteProviders = async () => {
    if (pendingDeleteProviders.length === 0) return
    setBusyId(pendingDeleteProviders.length === 1 ? pendingDeleteProviders[0].id : 'bulk')
    try {
      const results = await Promise.allSettled(
        pendingDeleteProviders.map(provider => deleteAutomationAiProviderAction(provider.id))
      )
      const deletedIds = successfulBulkIds(pendingDeleteProviders, results)
      setProviders(current => current.filter(provider => !deletedIds.has(provider.id)))
      setSelectedProviderIds(current => new Set([...current].filter(id => !deletedIds.has(id))))
      toast(
        summarizeBulkResults(
          results,
          pendingDeleteProviders.length === 1 ? 'AI provider deleted' : 'AI providers deleted',
          pendingDeleteProviders.length === 1 ? 'Could not delete AI provider' : 'Could not delete all AI providers'
        )
      )
      if (pendingDeleteProviders.length > 1 || deletedIds.size) setPendingDeleteProviders([])
    } finally {
      setBusyId(null)
    }
  }

  const updateContextualSuggestions = async (aiContextualSuggestionsEnabled: boolean) => {
    try {
      await suggestionsFeedback.save('suggestions', async () => {
        const saved = await saveAiUiSettings({
          aiContextualSuggestionsEnabled
        })
        setSettings(saved)
      })
    } catch (error) {
      toast({
        title: 'Could not save AI settings',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  return (
    <>
      <AiProvidersPageLayout
        breadcrumbRefresh={
          <PlatformPageRefreshButton
            refreshResult={{ version: initialProviders, succeeded: true }}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
        actions={
          <Button
            type='button'
            onClick={openCreateDialog}
          >
            <IconPlus className='size-4' />
            Add provider
          </Button>
        }
        providers={
          <ProvidersGrid
            providers={providers}
            billingIssues={billingIssues}
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
        }
        suggestions={
          <FormField
            controlId='ai-context-suggestions'
            label='Context suggestions'
            description='Generate prompt suggestions in app sessions. Changes save immediately.'
            layout='vertical'
          >
            <MutationSwitch
              checked={settings.aiContextualSuggestionsEnabled}
              pending={suggestionsFeedback.pendingId !== null}
              success={suggestionsFeedback.savedId === 'suggestions'}
              onCheckedChange={value => void updateContextualSuggestions(value)}
            />
          </FormField>
        }
      />

      <ProviderDialog
        provider={editingProvider}
        existingIds={providers.map(provider => provider.id)}
        error={creationError}
        isSaving={isSaving}
        onChange={provider => {
          setEditingProvider(provider)
          setCreationError(null)
        }}
        onClose={() => setEditingProvider(null)}
        onSave={() => void saveProvider()}
      />
      <ConfirmMutationDialog
        open={pendingDeleteProviders.length > 0}
        title={
          pendingDeleteProviders.length === 1
            ? `Delete “${pendingDeleteProviders[0]?.label}”?`
            : `Delete ${pendingDeleteProviders.length} AI providers?`
        }
        description='Rebroid deletes the provider settings and model assignments. Dependent automations may stop working until you configure another provider.'
        confirmLabel={pendingDeleteProviders.length === 1 ? 'Delete provider' : 'Delete providers'}
        pendingLabel='Deleting…'
        pending={busyId !== null}
        onOpenChange={open => {
          if (!open) setPendingDeleteProviders([])
        }}
        onConfirm={() => void confirmDeleteProviders()}
      />
    </>
  )
}

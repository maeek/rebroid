'use client'

import { useEffect, useState, useTransition } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { PlatformPageRefreshButton } from '@/features/orchestrator/components/platform-page-refresh-button'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import {
  createAutomationAiProviderAction,
  deleteAutomationAiProviderAction
} from '@/server/orchestrator/settings/actions'
import { ProviderDialog } from './provider-dialog'
import { emptyProvider, normalizeProviderForm, type ProviderFormState } from './provider-utils'
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

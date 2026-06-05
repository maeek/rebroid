'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { updateAutomationAiProviderAction } from '@/server/orchestrator/settings/actions'
import { ProviderHealthBadge, ProviderHealthBanner } from './provider-health-badge'
import { emptyModel, inferModelCapabilities, normalizeProviderForm, type ProviderFormState } from './provider-utils'
import type { AutomationAiProvider, AutomationAiProviderModel } from '@/server/orchestrator/settings/types'
import type { ColumnDef } from '@tanstack/react-table'

type ModelRow = AutomationAiProviderModel & {
  rowId: string
  index: number
}

export const OrchestratorAiProviderEditPageClient = ({
  initialProvider
}: {
  initialProvider: AutomationAiProvider
}) => {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderFormState>(
    JSON.parse(JSON.stringify(initialProvider)) as AutomationAiProvider
  )
  const [isSaving, setIsSaving] = useState(false)
  const modelRows = useMemo<ModelRow[]>(
    () =>
      provider.models.map((model, index) => ({
        ...model,
        index,
        rowId: `${index}:${model.id || 'new'}`
      })),
    [provider.models]
  )

  const updateProvider = (patch: Partial<ProviderFormState>) => setProvider(current => ({ ...current, ...patch }))
  const updateModel = useCallback((index: number, patch: Partial<AutomationAiProviderModel>) => {
    setProvider(current => ({
      ...current,
      models: current.models.map((model, modelIndex) => {
        if (patch.default && modelIndex !== index) return { ...model, default: false }
        return modelIndex === index ? { ...model, ...patch } : model
      })
    }))
  }, [])
  const removeModel = useCallback(
    (index: number) =>
      setProvider(current => ({ ...current, models: current.models.filter((_, modelIndex) => modelIndex !== index) })),
    []
  )
  const setDefaultModel = useCallback(
    (index: number) =>
      setProvider(current => ({
        ...current,
        models: current.models.map((model, modelIndex) => ({ ...model, default: modelIndex === index }))
      })),
    []
  )

  const columns = useMemo<ColumnDef<ModelRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Model ID',
        size: 260,
        meta: { label: 'Model ID' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <Input
              value={row.original.id}
              placeholder='qwen2.5vl:7b'
              onChange={event => updateModel(row.original.index, { id: event.target.value })}
            />
          </div>
        )
      },
      {
        accessorKey: 'label',
        header: 'Label',
        size: 260,
        meta: { label: 'Label' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <Input
              value={row.original.label}
              placeholder='Qwen 2.5 VL 7B'
              onChange={event => updateModel(row.original.index, { label: event.target.value })}
            />
          </div>
        )
      },
      {
        id: 'capabilities',
        header: 'Capabilities',
        size: 260,
        meta: { label: 'Capabilities' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <CapabilityBadges model={row.original} />
          </div>
        )
      },
      {
        id: 'state',
        header: 'State',
        size: 220,
        meta: { label: 'State' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center gap-3'>
            <Switch
              checked={row.original.enabled}
              onCheckedChange={enabled => updateModel(row.original.index, { enabled })}
            />
            <span className='text-sm text-secondary-foreground'>{row.original.enabled ? 'Enabled' : 'Disabled'}</span>
            {row.original.default ? <Badge variant='outline'>Default</Badge> : null}
          </div>
        )
      },
      {
        id: 'health',
        header: 'Health',
        size: 150,
        meta: { label: 'Health' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <ProviderHealthBadge
              provider={initialProvider}
              modelId={row.original.id}
            />
          </div>
        )
      }
    ],
    [initialProvider, updateModel]
  )

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

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title={initialProvider.label}
        parent={{ label: 'AI providers', href: '/orchestrator/ai-providers' }}
        description='Edit provider connection details and the models exposed to AI automation steps.'
        actions={
          <Button
            type='button'
            disabled={isSaving}
            onClick={() => void saveProvider()}
          >
            <IconDeviceFloppy className='size-4' />
            Save
          </Button>
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        {provider.enabled ? <ProviderHealthBanner provider={initialProvider} /> : null}
        <Section
          boxed
          contentClassName='gap-5'
        >
          <div className='flex items-center justify-between gap-4'>
            <div>
              <Label>Enabled</Label>
              <p className='text-xs text-secondary-foreground'>
                Enabled providers with enabled models appear in automation editors.
              </p>
            </div>
            <Switch
              checked={provider.enabled}
              onCheckedChange={enabled => updateProvider({ enabled })}
            />
          </div>
        </Section>
        <Section
          boxed
          contentClassName='gap-5'
        >
          <div>
            <h3 className='text-sm font-semibold'>Provider</h3>
            <p className='text-xs text-secondary-foreground'>
              Local providers can use Ollama or any OpenAI-compatible /v1 endpoint.
            </p>
          </div>
          <div className='grid gap-4'>
            <Field
              label='Provider ID'
              description='Stable identifier used by automation steps and model selectors.'
            >
              <Input
                value={provider.id}
                placeholder='local-ollama'
                onChange={event => updateProvider({ id: event.target.value })}
              />
            </Field>
            <Field
              label='Label'
              description='Human-readable name shown in tables, editors, and viewer controls.'
            >
              <Input
                value={provider.label}
                placeholder='Local Ollama'
                onChange={event => updateProvider({ label: event.target.value })}
              />
            </Field>
            <Field
              label='Kind'
              description='Select the API protocol used by this provider.'
            >
              <Select
                value={provider.kind}
                onValueChange={kind => updateProvider({ kind: kind as ProviderFormState['kind'] })}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ollama'>Ollama</SelectItem>
                  <SelectItem value='openai'>OpenAI</SelectItem>
                  <SelectItem value='openai-compatible'>OpenAI-compatible</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label='Base URL'
              description='Use the provider root URL. OpenAI-compatible providers should include their /v1 endpoint.'
            >
              <Input
                value={provider.baseUrl}
                placeholder='http://localhost:11434'
                onChange={event => updateProvider({ baseUrl: event.target.value })}
              />
            </Field>
            <Field
              label='API key'
              description='Stored as a secret. Leave the masked value unchanged to keep the existing key.'
            >
              <Input
                value={provider.apiKey ?? ''}
                placeholder='Leave blank for local providers'
                type='password'
                onChange={event => updateProvider({ apiKey: event.target.value || null })}
              />
            </Field>
          </div>
        </Section>
        <Section contentClassName='gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h3 className='text-sm font-semibold'>Models</h3>
              <p className='text-xs text-secondary-foreground'>
                Good local starting points: Qwen2.5-VL 7B/32B or Llama 3.1/3.2 tool-capable variants.
              </p>
            </div>
            <Button
              type='button'
              variant='secondary'
              onClick={() =>
                updateProvider({
                  models: [...provider.models, { ...emptyModel(), default: provider.models.length === 0 }]
                })
              }
            >
              <IconPlus className='size-4' />
              Add model
            </Button>
          </div>
          <DataGrid
            columns={columns}
            data={modelRows}
            totalItems={modelRows.length}
            pageIndex={0}
            pageSize={Math.max(modelRows.length, 1)}
            getRowId={model => model.rowId}
            minWidth='74rem'
            emptyState={<div className='text-center text-secondary-foreground'>No models configured.</div>}
            mobileCard={row => (
              <div className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4 pr-12'>
                <div>
                  <div className='font-medium'>{row.original.label || 'Untitled model'}</div>
                  <div className='font-mono text-xs text-secondary-foreground'>{row.original.id || 'No model ID'}</div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <CapabilityBadges model={row.original} />
                  <Badge variant={row.original.enabled ? 'status' : 'secondary'}>
                    {row.original.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  {row.original.default ? <Badge variant='outline'>Default</Badge> : null}
                </div>
                <ProviderHealthBadge
                  provider={initialProvider}
                  modelId={row.original.id}
                  compact
                />
              </div>
            )}
            rowContextMenu={row => (
              <>
                <ContextMenuItem
                  disabled={row.original.default || !row.original.enabled}
                  onSelect={() => setDefaultModel(row.original.index)}
                >
                  Set as default
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => removeModel(row.original.index)}>
                  <IconTrash className='mr-2 size-4' />
                  Delete
                </ContextMenuItem>
              </>
            )}
          />
        </Section>
      </section>
    </ProtectedStackPageLayout>
  )
}

const Field = ({ label, description, children }: { label: string; description: string; children: ReactNode }) => (
  <div className='grid gap-2'>
    <div className='grid gap-1'>
      <Label>{label}</Label>
      <p className='text-xs text-secondary-foreground'>{description}</p>
    </div>
    {children}
  </div>
)

const CapabilityBadges = ({ model }: { model: Pick<AutomationAiProviderModel, 'id' | 'label'> }) => {
  const capabilities = inferModelCapabilities(model)
  return (
    <div className='flex flex-wrap gap-2'>
      {capabilities.supportsVision ? <Badge variant='outline'>Vision</Badge> : null}
      {capabilities.supportsTools ? <Badge variant='outline'>Tools</Badge> : null}
      {!capabilities.supportsVision && !capabilities.supportsTools ? (
        <span className='text-sm text-secondary-foreground'>-</span>
      ) : null}
    </div>
  )
}

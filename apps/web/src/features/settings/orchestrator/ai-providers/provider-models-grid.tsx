import { useMemo, useState, type ReactNode } from 'react'
import { IconDownload, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProviderHealthBadge } from './provider-health-badge'
import { inferModelCapabilities, type ProviderModelRow } from './provider-utils'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload
} from '@/server/orchestrator/settings/types'
import type { ColumnDef } from '@tanstack/react-table'

export const ProviderModelsGrid = ({
  initialProvider,
  modelRows,
  onAddModel,
  onBulkRemoveModels,
  onBulkUpdateModels,
  onDownloadModel,
  onRemoveModel,
  onSetDefaultModel,
  onUpdateModel,
  isDownloadingModel,
  modelDownload
}: {
  initialProvider: AutomationAiProvider
  modelRows: ProviderModelRow[]
  onAddModel: () => void
  onBulkRemoveModels: (indexes: number[]) => void
  onBulkUpdateModels: (indexes: number[], patch: Partial<AutomationAiProviderModel>) => void
  onDownloadModel: (modelId: string, label?: string) => Promise<void>
  onRemoveModel: (index: number) => void
  onSetDefaultModel: (index: number) => void
  onUpdateModel: (index: number, patch: Partial<AutomationAiProviderModel>) => void
  isDownloadingModel: boolean
  modelDownload: AutomationAiProviderModelDownload | null
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [settingsRow, setSettingsRow] = useState<ProviderModelRow | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadModelId, setDownloadModelId] = useState('')
  const [downloadLabel, setDownloadLabel] = useState('')
  const selectedIndexes = modelRows.filter(model => selectedIds.has(model.rowId)).map(model => model.index)

  const openDownload = (model?: ProviderModelRow) => {
    setDownloadModelId(model?.id ?? '')
    setDownloadLabel(model?.label ?? '')
    setDownloadOpen(true)
  }

  const submitDownload = async () => {
    try {
      await onDownloadModel(downloadModelId, downloadLabel)
      setDownloadOpen(false)
      setDownloadModelId('')
      setDownloadLabel('')
    } catch {
      // The controller owns the toast. Keep the dialog open so the model ID can be corrected.
    }
  }

  const columns = useMemo<ColumnDef<ProviderModelRow>[]>(
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
              onChange={event => onUpdateModel(row.original.index, { id: event.target.value })}
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
              onChange={event => onUpdateModel(row.original.index, { label: event.target.value })}
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
              onCheckedChange={enabled => onUpdateModel(row.original.index, { enabled })}
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
    [initialProvider, onUpdateModel]
  )

  return (
    <Section contentClassName='gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-sm font-semibold'>Models</h3>
          <p className='text-xs text-secondary-foreground'>
            Good local starting points: Qwen2.5-VL 7B/32B or Llama 3.1/3.2 tool-capable variants.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {initialProvider.kind === 'ollama' ? (
            <Button
              type='button'
              variant='secondary'
              onClick={() => openDownload()}
            >
              <IconDownload className='size-4' />
              Download model
            </Button>
          ) : null}
          <Button
            type='button'
            variant='secondary'
            onClick={onAddModel}
          >
            <IconPlus className='size-4' />
            Add model
          </Button>
        </div>
      </div>
      {modelDownload ? <ModelDownloadProgress download={modelDownload} /> : null}
      {selectedIds.size > 0 ? (
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-sm text-secondary-foreground'>{selectedIds.size} selected</span>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                onBulkUpdateModels(selectedIndexes, { enabled: true })
                setSelectedIds(new Set())
              }}
            >
              Enable selected
            </Button>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                onBulkUpdateModels(selectedIndexes, { enabled: false })
                setSelectedIds(new Set())
              }}
            >
              Disable selected
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={() => {
                onBulkRemoveModels(selectedIndexes)
                setSelectedIds(new Set())
              }}
            >
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}
      <DataGrid
        columns={columns}
        data={modelRows}
        totalItems={modelRows.length}
        pageIndex={0}
        pageSize={Math.max(modelRows.length, 1)}
        getRowId={model => model.rowId}
        selection={{ selectedIds, onSelectedIdsChange: setSelectedIds }}
        minWidth='74rem'
        emptyState={<div className='text-center text-secondary-foreground'>No models configured.</div>}
        rowContextMenu={row => (
          <>
            <ContextMenuItem onSelect={() => setSettingsRow(row.original)}>
              <IconSettings className='mr-2 size-4' />
              Settings
            </ContextMenuItem>
            {initialProvider.kind === 'ollama' ? (
              <ContextMenuItem onSelect={() => openDownload(row.original)}>
                <IconDownload className='mr-2 size-4' />
                Download model
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              disabled={row.original.default || !row.original.enabled}
              onSelect={() => onSetDefaultModel(row.original.index)}
            >
              Set as default
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onRemoveModel(row.original.index)}>
              <IconTrash className='mr-2 size-4' />
              Delete
            </ContextMenuItem>
          </>
        )}
      />
      <ModelSettingsDialog
        model={settingsRow}
        onClose={() => setSettingsRow(null)}
        onChange={(index, patch) => onUpdateModel(index, patch)}
      />
      <Dialog
        open={downloadOpen}
        onOpenChange={open => {
          if (!open && !isDownloadingModel) setDownloadOpen(false)
        }}
      >
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>Download Ollama model</DialogTitle>
            <DialogDescription>
              Pull a model into the configured Ollama server and add it to this provider when the download completes.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <Field
              label='Model ID'
              description='Use the Ollama model name, for example qwen3.5:latest.'
            >
              <Input
                value={downloadModelId}
                placeholder='qwen3.5:latest'
                onChange={event => setDownloadModelId(event.target.value)}
              />
            </Field>
            <Field
              label='Label'
              description='Optional display name shown in tables and model selectors.'
            >
              <Input
                value={downloadLabel}
                placeholder='Qwen 3.5 Latest'
                onChange={event => setDownloadLabel(event.target.value)}
              />
            </Field>
            <p className='text-sm text-secondary-foreground'>
              The download runs in the background after it starts. Progress is shown in the Models section.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type='button'
                variant='secondary'
                disabled={isDownloadingModel}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type='button'
              disabled={isDownloadingModel || !downloadModelId.trim()}
              onClick={() => void submitDownload()}
            >
              <IconDownload className={isDownloadingModel ? 'size-4 animate-pulse' : 'size-4'} />
              {isDownloadingModel ? 'Starting' : 'Start download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}

export const CapabilityBadges = ({ model }: { model: Pick<AutomationAiProviderModel, 'id' | 'label'> }) => {
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

const ModelSettingsDialog = ({
  model,
  onClose,
  onChange
}: {
  model: ProviderModelRow | null
  onClose: () => void
  onChange: (index: number, patch: Partial<AutomationAiProviderModel>) => void
}) => {
  const settings = model?.settings ?? {}
  const updateSettings = (patch: Partial<AutomationAiProviderModel['settings']>) => {
    if (!model) return
    onChange(model.index, { settings: { ...settings, ...patch } })
  }

  return (
    <Dialog
      open={Boolean(model)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Model settings</DialogTitle>
          <DialogDescription>Configure optional model-level prompt and Ollama generation settings.</DialogDescription>
        </DialogHeader>
        {model ? (
          <div className='grid gap-4'>
            <Field
              label='System prompt'
              description='Additional system instructions appended to AI automation runs for this model.'
            >
              <Textarea
                value={settings.systemPrompt ?? ''}
                rows={5}
                onChange={event => updateSettings({ systemPrompt: event.target.value || null })}
              />
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label='Temperature'
                description='Sampling randomness from 0 to 2.'
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={temperature => updateSettings({ temperature })}
              />
              <NumberField
                label='Top P'
                description='Nucleus sampling value from 0 to 1.'
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                onChange={topP => updateSettings({ topP })}
              />
              <NumberField
                label='Top K'
                description='Ollama top-k sampling limit.'
                value={settings.topK}
                min={0}
                max={500}
                step={1}
                onChange={topK => updateSettings({ topK })}
              />
              <NumberField
                label='Context length'
                description='Ollama num_ctx option.'
                value={settings.numCtx}
                min={128}
                max={262144}
                step={128}
                onChange={numCtx => updateSettings({ numCtx })}
              />
              <NumberField
                label='Repeat penalty'
                description='Ollama repeat_penalty option.'
                value={settings.repeatPenalty}
                min={0}
                max={4}
                step={0.05}
                onChange={repeatPenalty => updateSettings({ repeatPenalty })}
              />
              <NumberField
                label='Seed'
                description='Optional deterministic seed.'
                value={settings.seed}
                step={1}
                onChange={seed => updateSettings({ seed })}
              />
            </div>
            <Field
              label='Keep alive'
              description='Ollama keep_alive value such as 5m, 1h, or -1.'
            >
              <Input
                value={settings.keepAlive ?? ''}
                placeholder='5m'
                onChange={event => updateSettings({ keepAlive: event.target.value || null })}
              />
            </Field>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type='button'>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

const ModelDownloadProgress = ({ download }: { download: AutomationAiProviderModelDownload }) => {
  const isActive = download.status === 'queued' || download.status === 'running'
  const percent = typeof download.percent === 'number' ? download.percent : null
  return (
    <div className='rounded-md border border-border/70 bg-background/35 px-4 py-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant={
                download.status === 'completed' ? 'status' : download.status === 'failed' ? 'destructive' : 'secondary'
              }
            >
              {download.status === 'completed' ? 'Downloaded' : download.status === 'failed' ? 'Error' : 'Downloading'}
            </Badge>
            <span className='font-medium'>{download.modelId}</span>
          </div>
          <p className='mt-1 break-words text-sm text-secondary-foreground'>{download.message}</p>
        </div>
        {percent !== null ? <span className='text-sm text-secondary-foreground'>{percent}%</span> : null}
      </div>
      {isActive ? (
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${percent ?? 8}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

const NumberField = ({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  description: string
  value?: number | null
  min?: number
  max?: number
  step?: number
  onChange: (value: number | null) => void
}) => (
  <Field
    label={label}
    description={description}
  >
    <Input
      type='number'
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  </Field>
)

import { useMemo, useState } from 'react'
import { inferModelCapabilities, type ProviderModelRow } from '@rebroid/ai-core/provider'
import { IconDownload, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderModelDownloadDialog, ProviderModelDownloadProgress } from './provider-model-download'
import { ProviderModelSettingsDialog } from './provider-model-settings-dialog'
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
      {modelDownload ? <ProviderModelDownloadProgress download={modelDownload} /> : null}
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
      <ProviderModelSettingsDialog
        model={settingsRow}
        onClose={() => setSettingsRow(null)}
        onChange={(index, patch) => onUpdateModel(index, patch)}
      />
      <ProviderModelDownloadDialog
        open={downloadOpen}
        isDownloading={isDownloadingModel}
        modelId={downloadModelId}
        label={downloadLabel}
        onOpenChange={setDownloadOpen}
        onModelIdChange={setDownloadModelId}
        onLabelChange={setDownloadLabel}
        onSubmit={() => void submitDownload()}
      />
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

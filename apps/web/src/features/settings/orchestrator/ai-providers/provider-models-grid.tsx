import { useMemo, useState } from 'react'
import { IconDownload, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderModelAddDialog, ProviderModelDownloadStatus } from './provider-model-download'
import { ProviderModelSettingsDialog } from './provider-model-settings-dialog'
import { modelPurposeText } from './provider-model-usage'
import { findProviderModelSettingsRow, selectedProviderModelIndexes } from './provider-models-grid-model'
import type { AutomationAiProviderModelRole, ProviderModelRow } from './provider-form-model'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/shared/contracts/ai-provider'
import type { ColumnDef } from '@tanstack/react-table'

export type ProviderModelsGridProps = {
  initialProvider: AutomationAiProvider
  modelRows: ProviderModelRow[]
  onAddModel: (modelId: string, label?: string, roles?: AutomationAiProviderModelRole[]) => boolean | Promise<boolean>
  onBulkRemoveModels: (indexes: number[]) => void
  onBulkUpdateModels: (indexes: number[], patch: Partial<AutomationAiProviderModel>) => void
  onDownloadModel: (modelId: string, label?: string) => Promise<void>
  onRemoveModel: (index: number) => void
  onUpdateModel: (index: number, patch: Partial<AutomationAiProviderModel>) => void
  isDownloadingModel: boolean
  isLoadingRemoteModels: boolean
  modelDownloads: Record<string, AutomationAiProviderModelDownload>
  remoteModels: AutomationAiProviderRemoteModel[]
  remoteModelsError: string | null
  onLoadRemoteModels: () => void | Promise<void>
  disabled?: boolean
  hasUnsavedChanges?: boolean
  loading?: boolean
}

export const ProviderModelsGrid = ({
  initialProvider,
  modelRows,
  onAddModel,
  onBulkRemoveModels,
  onBulkUpdateModels,
  onDownloadModel,
  onRemoveModel,
  onUpdateModel,
  isDownloadingModel,
  isLoadingRemoteModels,
  modelDownloads,
  remoteModels,
  remoteModelsError,
  onLoadRemoteModels,
  disabled = false,
  hasUnsavedChanges = false,
  loading = false
}: ProviderModelsGridProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const selectedIndexes = selectedProviderModelIndexes(modelRows, selectedIds)
  const settingsRow = findProviderModelSettingsRow(modelRows, settingsRowId)
  const columns = useMemo<ColumnDef<ProviderModelRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Model',
        size: 320,
        meta: { label: 'Model', skeleton: { kind: 'stacked' } },
        cell: ({ row: { original: model } }) => (
          <div className='grid min-w-0 gap-1'>
            <Button
              type='button'
              variant='link'
              className='h-auto justify-start whitespace-normal p-0 text-left'
              disabled={disabled}
              onClick={() => setSettingsRowId(model.rowId)}
            >
              {model.label || model.id}
            </Button>
            <span
              className='truncate font-mono text-xs text-foreground-muted'
              title={model.id}
            >
              {model.id}
            </span>
          </div>
        )
      },
      {
        id: 'purposes',
        header: 'Used for',
        size: 260,
        meta: { label: 'Used for', skeleton: { kind: 'text', width: 'w-44' } },
        cell: ({ row }) => <span className='text-sm'>{modelPurposeText(row.original.roles)}</span>
      },
      {
        accessorKey: 'enabled',
        header: 'Enabled',
        size: 88,
        meta: { label: 'Enabled', skeleton: { kind: 'text', width: 'w-10' } },
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={disabled}
            aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.label || row.original.id}`}
            onCheckedChange={enabled => onUpdateModel(row.original.index, { enabled })}
          />
        )
      },
      {
        id: 'health',
        header: 'Health',
        size: 180,
        meta: { label: 'Health', skeleton: { kind: 'badge' } },
        cell: ({ row }) =>
          modelDownloads[row.original.id] ? (
            <ProviderModelDownloadStatus download={modelDownloads[row.original.id]} />
          ) : (
            <ProviderHealthBadge
              provider={initialProvider}
              modelId={row.original.id}
              disabled={disabled || hasUnsavedChanges}
            />
          )
      }
    ],
    [disabled, hasUnsavedChanges, initialProvider, modelDownloads, onUpdateModel]
  )
  const visibleRows = modelRows.filter(model =>
    `${model.id} ${model.label} ${modelPurposeText(model.roles)}`.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <Section
      surface='plain'
      title='Models'
      description='Choose a model name to manage its purposes and generation settings. Enable, disable, and remove changes apply when you save.'
      actions={
        <Button
          type='button'
          variant='secondary'
          disabled={disabled || hasUnsavedChanges || loading}
          onClick={() => setAddOpen(true)}
        >
          <IconPlus className='size-4' /> Add model
        </Button>
      }
    >
      {hasUnsavedChanges ? (
        <p className='text-sm text-foreground-muted'>
          Save or discard changes before adding a model or checking health.
        </p>
      ) : null}
      <DataGridWorkspace
        search={searchDraft}
        searchPlaceholder='Search models or purposes'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        selectedCount={selectedIndexes.length}
        bulkActions={
          <>
            <Button
              type='button'
              variant='ghost'
              disabled={disabled}
              onClick={() => {
                onBulkUpdateModels(selectedIndexes, { enabled: true })
                setSelectedIds(new Set())
              }}
            >
              Enable selected
            </Button>
            <Button
              type='button'
              variant='ghost'
              disabled={disabled}
              onClick={() => {
                onBulkUpdateModels(selectedIndexes, { enabled: false })
                setSelectedIds(new Set())
              }}
            >
              Disable selected
            </Button>
            <Button
              type='button'
              variant='danger-ghost'
              disabled={disabled}
              onClick={() => {
                onBulkRemoveModels(selectedIndexes)
                setSelectedIds(new Set())
              }}
            >
              Remove selected
            </Button>
          </>
        }
      >
        <DataGrid
          columns={columns}
          data={visibleRows}
          totalItems={visibleRows.length}
          pageIndex={0}
          pageSize={Math.max(visibleRows.length, 1)}
          getRowId={model => model.rowId}
          selection={{ selectedIds, onSelectedIdsChange: setSelectedIds }}
          minWidth='54rem'
          loading={loading ? { rowCount: 4 } : false}
          emptyState={
            <DataGridEmptyState
              title='No models added'
              description='Add a model from this provider to make it available for automation.'
            />
          }
          rowContextMenu={row => (
            <>
              <ContextMenuItem
                disabled={disabled}
                onSelect={() => setSettingsRowId(row.original.rowId)}
              >
                <IconSettings className='mr-2 size-4' /> Edit model
              </ContextMenuItem>
              {initialProvider.kind === 'ollama' ? (
                <ContextMenuItem
                  disabled={
                    disabled ||
                    hasUnsavedChanges ||
                    isDownloadingModel ||
                    ['queued', 'running'].includes(modelDownloads[row.original.id]?.status)
                  }
                  onSelect={() => {
                    void onDownloadModel(row.original.id, row.original.label).catch(() => undefined)
                  }}
                >
                  <IconDownload className='mr-2 size-4' />
                  {modelDownloads[row.original.id]?.status === 'failed' ? 'Retry download' : 'Download or update model'}
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                disabled={disabled}
                onSelect={() => onRemoveModel(row.original.index)}
              >
                <IconTrash className='mr-2 size-4' /> Remove from provider
              </ContextMenuItem>
            </>
          )}
        />
      </DataGridWorkspace>
      <ProviderModelSettingsDialog
        model={settingsRow}
        onClose={() => setSettingsRowId(null)}
        onChange={onUpdateModel}
      />
      <ProviderModelAddDialog
        open={addOpen}
        isSubmitting={isDownloadingModel}
        isLoadingRemoteModels={isLoadingRemoteModels}
        providerKind={initialProvider.kind}
        configuredModelIds={modelRows.map(model => model.id)}
        remoteModels={remoteModels}
        remoteModelsError={remoteModelsError}
        onLoadRemoteModels={onLoadRemoteModels}
        onOpenChange={setAddOpen}
        onAddExisting={onAddModel}
        onDownload={onDownloadModel}
      />
    </Section>
  )
}

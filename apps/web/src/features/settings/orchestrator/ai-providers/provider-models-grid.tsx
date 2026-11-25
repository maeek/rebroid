import { useMemo, useState } from 'react'
import { IconDownload, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { EditorFormContext } from '@/components/ui/editor-form-context'
import { fieldValuesEqual } from '@/components/ui/field-changes'
import { DraftFieldLabel } from '@/components/ui/modified-indicator'
import { Notice } from '@/components/ui/notice'
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
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

type ProviderModelsGridProps = {
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
  downloadLookup?: 'loading' | 'failed' | 'ready'
  onRetryDownloadLookup?: () => void
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
  downloadLookup,
  onRetryDownloadLookup,
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
        enableHiding: false,
        meta: { compactSlot: 'title', label: 'Model', skeleton: { kind: 'stacked' } },
        cell: ({ row: { original: model } }) => (
          <div className={`grid min-w-0 gap-1 ${styles.settingsStack}`}>
            <Button
              type='button'
              variant='link'
              className='h-auto justify-start whitespace-normal p-0 text-left'
              disabled={disabled}
              onClick={() => setSettingsRowId(model.rowId)}
            >
              <DraftFieldLabel
                modified={
                  !fieldValuesEqual(
                    editableModelSettings(model),
                    editableModelSettings(initialProvider.models.find(saved => saved.id === model.id))
                  )
                }
              >
                {model.label || model.id}
              </DraftFieldLabel>
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
        meta: { compactSlot: 'details', label: 'Used for', skeleton: { kind: 'text', width: 'w-44' } },
        cell: ({ row }) => <span className='text-sm'>{modelPurposeText(row.original.roles)}</span>
      },
      {
        accessorKey: 'enabled',
        header: 'Enabled',
        size: 88,
        meta: { compactSlot: 'control', label: 'Enabled', skeleton: { kind: 'text', width: 'w-10' } },
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
        meta: { compactSlot: 'details', label: 'Health', skeleton: { kind: 'badge' } },
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

  const unconfiguredDownloads = Object.values(modelDownloads).filter(
    download => !modelRows.some(model => model.id === download.modelId)
  )

  const section = (
    <Section
      surface='plain'
      title='Models'
      description='Choose a model to edit its name or purposes.'
      contentClassName='gap-4'
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
      {downloadLookup === 'loading' ? (
        <p
          role='status'
          className='text-sm text-foreground-muted'
        >
          Checking model downloads…
        </p>
      ) : null}
      {downloadLookup === 'failed' ? (
        <Notice
          tone='warning'
          title='Could not check for active downloads'
          actions={
            <Button
              variant='ghost'
              onClick={onRetryDownloadLookup}
            >
              Try again
            </Button>
          }
        />
      ) : null}
      {unconfiguredDownloads.length ? (
        <ul
          aria-label='Model downloads'
          className='grid gap-2'
        >
          {unconfiguredDownloads.map(download => (
            <li
              key={download.id}
              className='flex flex-wrap items-start justify-between gap-3 py-2'
            >
              <p className='min-w-0 break-all text-sm font-medium'>{download.modelId}</p>
              <ProviderModelDownloadStatus download={download} />
            </li>
          ))}
        </ul>
      ) : null}
      <DataGridWorkspace
        disabled={loading}
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
              artwork='models'
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
                <IconSettings className='size-4' /> Edit model
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
                  <IconDownload className='size-4' />
                  {modelDownloads[row.original.id]?.status === 'failed' ? 'Retry download' : 'Download or update model'}
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                disabled={disabled}
                onSelect={() => onRemoveModel(row.original.index)}
              >
                <IconTrash className='size-4' /> Remove from provider
              </ContextMenuItem>
            </>
          )}
        />
      </DataGridWorkspace>
      <ProviderModelSettingsDialog
        baseline={initialProvider.models.find(model => model.id === settingsRow?.id)}
        model={settingsRow}
        provider={initialProvider}
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

  return <EditorFormContext.Provider value={false}>{section}</EditorFormContext.Provider>
}

const editableModelSettings = (model?: AutomationAiProviderModel) =>
  model && {
    label: model.label.trim() || model.id,
    enabled: model.enabled,
    roles: model.roles,
    defaultFor: model.defaultFor,
    settings: model.settings ?? {}
  }

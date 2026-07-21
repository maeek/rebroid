import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconCheck, IconDownload, IconPencil, IconPlus, IconSettings, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { recommendAiModelForAutomation } from '@/shared/model/ai-model-recommendation'
import { AiModelStateBadges } from '@/shared/ui/ai/ai-model-badges'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderModelAddDialog, ProviderModelDownloadStatus } from './provider-model-download'
import { ProviderModelSettingsDialog } from './provider-model-settings-dialog'
import {
  findProviderModelSettingsRow,
  nextProviderModelRoles,
  selectedProviderModelIndexes,
  type ProviderModelRole
} from './provider-models-grid-model'
import type { ProviderModelRow } from './provider-form-model'
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/shared/contracts/ai-provider'
import type { ColumnDef } from '@tanstack/react-table'

const ProviderModelLabelCell = ({
  model,
  onUpdateModel
}: {
  model: ProviderModelRow
  onUpdateModel: (index: number, patch: Partial<AutomationAiProviderModel>) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(model.label)

  useEffect(() => {
    if (!isEditing) setDraftLabel(model.label)
  }, [isEditing, model.label])

  const startEditing = () => {
    setDraftLabel(model.label)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraftLabel(model.label)
    setIsEditing(false)
  }

  const saveLabel = () => {
    onUpdateModel(model.index, { label: draftLabel })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className='flex min-h-10 min-w-0 items-center gap-2'>
        <Input
          value={draftLabel}
          placeholder='Qwen 2.5 VL 7B'
          onChange={event => setDraftLabel(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') saveLabel()
            if (event.key === 'Escape') cancelEditing()
          }}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          className='size-8'
          aria-label='Save label'
          onClick={saveLabel}
        >
          <IconCheck className='size-4' />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          className='size-8'
          aria-label='Cancel label edit'
          onClick={cancelEditing}
        >
          <IconX className='size-4' />
        </Button>
      </div>
    )
  }

  return (
    <div className='flex min-h-10 min-w-0 items-center gap-2'>
      <span
        className='min-w-0 truncate text-sm font-medium text-foreground'
        title={model.label || model.id}
      >
        {model.label || model.id}
      </span>
      <Button
        type='button'
        variant='ghost'
        size='icon-md'
        className='size-8'
        aria-label={`Edit label for ${model.id}`}
        onClick={startEditing}
      >
        <IconPencil className='size-4' />
      </Button>
    </div>
  )
}

const recommendationClassName = {
  good: 'border-success/35 bg-success/10 text-success',
  warning: 'border-warning/35 bg-warning/10 text-warning',
  neutral: 'border-surface-border bg-surface-subtle text-foreground-muted'
} as const

const ProviderModelRecommendation = ({ model }: { model: ProviderModelRow }) => {
  const recommendation = recommendAiModelForAutomation(model)

  return (
    <div className='flex min-h-10 min-w-0 items-center'>
      <span
        className={[
          'max-w-full truncate rounded-control border px-2 py-1 text-xs',
          recommendationClassName[recommendation.level]
        ].join(' ')}
        title={recommendation.message}
      >
        {recommendation.title}
      </span>
    </div>
  )
}

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
  isLoadingRemoteModels,
  modelDownloads,
  remoteModels,
  remoteModelsError,
  onLoadRemoteModels
}: {
  initialProvider: AutomationAiProvider
  modelRows: ProviderModelRow[]
  onAddModel: (modelId: string, label?: string) => boolean | Promise<boolean>
  onBulkRemoveModels: (indexes: number[]) => void
  onBulkUpdateModels: (indexes: number[], patch: Partial<AutomationAiProviderModel>) => void
  onDownloadModel: (modelId: string, label?: string) => Promise<void>
  onRemoveModel: (index: number) => void
  onSetDefaultModel: (index: number, role: ProviderModelRole) => void
  onUpdateModel: (index: number, patch: Partial<AutomationAiProviderModel>) => void
  isDownloadingModel: boolean
  isLoadingRemoteModels: boolean
  modelDownloads: Record<string, AutomationAiProviderModelDownload>
  remoteModels: AutomationAiProviderRemoteModel[]
  remoteModelsError: string | null
  onLoadRemoteModels: () => void | Promise<void>
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const selectedIndexes = selectedProviderModelIndexes(modelRows, selectedIds)
  const settingsRow = findProviderModelSettingsRow(modelRows, settingsRowId)
  const visibleModelRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return modelRows
    return modelRows.filter(model => `${model.id} ${model.label}`.toLowerCase().includes(query))
  }, [modelRows, search])
  const toggleRole = useCallback(
    (model: ProviderModelRow, role: ProviderModelRole, enabled: boolean) => {
      onUpdateModel(model.index, { roles: nextProviderModelRoles(model.roles, role, enabled) })
    },
    [onUpdateModel]
  )

  const columns = useMemo<ColumnDef<ProviderModelRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Model ID',
        size: 260,
        meta: { label: 'Model ID' },
        cell: ({ row }) => (
          <div className='flex min-h-10 min-w-0 items-center'>
            <span
              className='min-w-0 truncate font-mono text-sm font-medium text-foreground'
              title={row.original.id}
            >
              {row.original.id}
            </span>
          </div>
        )
      },
      {
        accessorKey: 'label',
        header: 'Label',
        size: 260,
        meta: { label: 'Label' },
        cell: ({ row }) => (
          <ProviderModelLabelCell
            model={row.original}
            onUpdateModel={onUpdateModel}
          />
        )
      },
      {
        id: 'recommendation',
        header: 'Recommendation',
        size: 220,
        meta: { label: 'Recommendation' },
        cell: ({ row }) => <ProviderModelRecommendation model={row.original} />
      },
      {
        id: 'roles',
        header: 'Roles',
        size: 340,
        meta: { label: 'Roles' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center gap-4'>
            <label
              htmlFor={`provider-model-${row.original.index}-controller`}
              className='flex items-center gap-2 text-sm'
            >
              <Checkbox
                id={`provider-model-${row.original.index}-controller`}
                checked={(row.original.roles ?? []).includes('controller')}
                onCheckedChange={value => toggleRole(row.original, 'controller', value === true)}
              />
              Controller
            </label>
            <label
              htmlFor={`provider-model-${row.original.index}-planner`}
              className='flex items-center gap-2 text-sm'
            >
              <Checkbox
                id={`provider-model-${row.original.index}-planner`}
                checked={(row.original.roles ?? []).includes('planner')}
                onCheckedChange={value => toggleRole(row.original, 'planner', value === true)}
              />
              Planner
            </label>
            <label
              htmlFor={`provider-model-${row.original.index}-vision`}
              className='flex items-center gap-2 text-sm'
            >
              <Checkbox
                id={`provider-model-${row.original.index}-vision`}
                checked={(row.original.roles ?? []).includes('vision')}
                onCheckedChange={value => toggleRole(row.original, 'vision', value === true)}
              />
              Vision
            </label>
          </div>
        )
      },
      {
        id: 'state',
        header: 'State',
        size: 330,
        meta: { label: 'State' },
        cell: ({ row }) => {
          const model = row.original
          const defaultRoles = model.defaultFor ?? []
          return (
            <div className='flex min-h-10 flex-wrap items-center gap-3'>
              <Switch
                checked={model.enabled}
                onCheckedChange={enabled => onUpdateModel(model.index, { enabled })}
              />
              <AiModelStateBadges
                enabled={model.enabled}
                defaultFor={defaultRoles}
              />
            </div>
          )
        }
      },
      {
        id: 'health',
        header: 'Health',
        size: 260,
        meta: { label: 'Health' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            {modelDownloads[row.original.id] ? (
              <ProviderModelDownloadStatus download={modelDownloads[row.original.id]} />
            ) : (
              <div className='flex min-h-10 items-center gap-2'>
                <ProviderHealthBadge
                  provider={initialProvider}
                  modelId={row.original.id}
                />
                {initialProvider.kind === 'ollama' ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={isDownloadingModel}
                    onClick={() => void onDownloadModel(row.original.id, row.original.label)}
                  >
                    <IconDownload className='size-4' />
                    Pull
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        )
      }
    ],
    [initialProvider, isDownloadingModel, modelDownloads, onDownloadModel, onUpdateModel, toggleRole]
  )

  return (
    <Section
      surface='plain'
      contentClassName='gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-sm font-medium'>Models</h3>
          <p className='text-xs text-foreground-muted'>
            Good GUI-control starting points: Qwen2.5/3-VL, UI-TARS, GUI-Owl/GUI-Actor, or a tool-capable planner paired
            with a GUI-oriented vision model.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='secondary'
            onClick={() => setAddOpen(true)}
          >
            <IconPlus className='size-4' />
            Add model
          </Button>
        </div>
      </div>
      <DataGridWorkspace
        search={searchDraft}
        searchPlaceholder='Search models'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        selectedCount={selectedIds.size}
        bulkActions={
          <>
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
          </>
        }
      >
        <DataGrid
          columns={columns}
          data={visibleModelRows}
          totalItems={visibleModelRows.length}
          pageIndex={0}
          pageSize={Math.max(visibleModelRows.length, 1)}
          getRowId={model => model.rowId}
          selection={{ selectedIds, onSelectedIdsChange: setSelectedIds }}
          minWidth='86rem'
          emptyState={<div className='text-center text-foreground-muted'>No models configured.</div>}
          rowContextMenu={row => (
            <>
              <ContextMenuItem onSelect={() => setSettingsRowId(row.original.rowId)}>
                <IconSettings className='mr-2 size-4' />
                Settings
              </ContextMenuItem>
              {initialProvider.kind === 'ollama' ? (
                <ContextMenuItem onSelect={() => void onDownloadModel(row.original.id, row.original.label)}>
                  <IconDownload className='mr-2 size-4' />
                  Pull model
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                disabled={
                  !row.original.enabled ||
                  !row.original.roles.includes('controller') ||
                  row.original.defaultFor.includes('controller')
                }
                onSelect={() => onSetDefaultModel(row.original.index, 'controller')}
              >
                Set as controller default
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !row.original.enabled ||
                  !row.original.roles.includes('planner') ||
                  row.original.defaultFor.includes('planner')
                }
                onSelect={() => onSetDefaultModel(row.original.index, 'planner')}
              >
                Set as planner default
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !row.original.enabled ||
                  !row.original.roles.includes('vision') ||
                  row.original.defaultFor.includes('vision')
                }
                onSelect={() => onSetDefaultModel(row.original.index, 'vision')}
              >
                Set as vision default
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onRemoveModel(row.original.index)}>
                <IconTrash className='mr-2 size-4' />
                Delete
              </ContextMenuItem>
            </>
          )}
        />
      </DataGridWorkspace>
      <ProviderModelSettingsDialog
        model={settingsRow}
        onClose={() => setSettingsRowId(null)}
        onChange={(index, patch) => onUpdateModel(index, patch)}
      />
      <ProviderModelAddDialog
        open={addOpen}
        isSubmitting={isDownloadingModel}
        isLoadingRemoteModels={isLoadingRemoteModels}
        providerKind={initialProvider.kind}
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

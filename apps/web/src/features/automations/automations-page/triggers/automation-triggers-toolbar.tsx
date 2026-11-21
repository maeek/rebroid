import { type ReactNode } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { AutomationGridFilterControls, automationGridFilterSummary } from '../shared/automation-grid-filter-controls'
import { allFilterValue } from '../shared/grid-query-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationTriggersGridQuery } from '@/shared/contracts/automation'

export const AutomationTriggersToolbar = ({
  applications,
  tags,
  gridQuery,
  search,
  selectedCount,
  pending,
  disabled,
  onSearchChange,
  onSearchSubmit,
  onUpdateGrid,
  onDelete,
  onDisable,
  onEnable,
  children
}: {
  applications: AndroidApplication[]
  tags: string[]
  gridQuery: AutomationTriggersGridQuery
  search: string
  selectedCount: number
  pending?: 'enable' | 'disable' | 'delete' | null
  disabled?: boolean
  onSearchChange: (search: string) => void
  onSearchSubmit: (value: string) => void
  onUpdateGrid: (patch: Partial<AutomationTriggersGridQuery>) => void
  onDelete: () => void
  onDisable: () => void
  onEnable: () => void
  children: ReactNode
}) => (
  <DataGridWorkspace
    disabled={disabled}
    search={search}
    searchPlaceholder='Search triggers'
    onSearchChange={onSearchChange}
    onSearch={onSearchSubmit}
    activeFilters={automationGridFilterSummary({ applications, gridQuery, onUpdateGrid })}
    onResetFilters={() =>
      onUpdateGrid({
        tag: undefined,
        targetApplicationId: undefined,
        enabled: undefined,
        status: undefined,
        lastRun: undefined,
        page: 1
      })
    }
    selectedCount={selectedCount}
    bulkActions={
      <>
        <MutationButton
          size='sm'
          variant='ghost'
          disabled={disabled}
          pending={pending === 'enable'}
          pendingLabel='Enabling…'
          onClick={onEnable}
        >
          Enable
        </MutationButton>
        <MutationButton
          size='sm'
          variant='ghost'
          disabled={disabled}
          pending={pending === 'disable'}
          pendingLabel='Disabling…'
          onClick={onDisable}
        >
          Disable
        </MutationButton>
        <Button
          size='sm'
          variant='danger-ghost'
          disabled={disabled}
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </>
    }
    filters={
      <AutomationGridFilterControls
        applications={applications}
        gridQuery={gridQuery}
        onUpdateGrid={onUpdateGrid}
        tags={tags}
      >
        <FormField
          label='State'
          layout='vertical'
        >
          <Select
            value={gridQuery.enabled ?? allFilterValue}
            onValueChange={value =>
              onUpdateGrid({
                enabled: value === allFilterValue ? undefined : value,
                page: 1
              })
            }
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allFilterValue}>Any state</SelectItem>
              <SelectItem value='true'>Enabled</SelectItem>
              <SelectItem value='false'>Disabled</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </AutomationGridFilterControls>
    }
  >
    {children}
  </DataGridWorkspace>
)

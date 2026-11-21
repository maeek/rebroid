import type { ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { allFilterValue } from './grid-query-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationTriggersGridQuery } from '@/shared/contracts/automation'
import type { DataGridFilterEntry } from '@/shared/ui/data-grid/data-grid-workspace'

type FilterProps = {
  applications: AndroidApplication[]
  gridQuery: AutomationTriggersGridQuery
  onUpdateGrid: (patch: Partial<AutomationTriggersGridQuery>) => void
}

export const automationGridFilterSummary = ({ applications, gridQuery, onUpdateGrid }: FilterProps) => {
  const entries: DataGridFilterEntry[] = []
  const add = (
    key: 'tag' | 'targetApplicationId' | 'enabled' | 'status' | 'lastRun',
    label: string,
    value = gridQuery[key]
  ) => {
    if (value)
      entries.push({
        id: key === 'targetApplicationId' ? 'target' : key,
        label,
        value,
        onRemove: () => onUpdateGrid({ [key]: undefined, page: 1 })
      })
  }
  add('tag', 'Tag')
  add(
    'targetApplicationId',
    'Target',
    applications.find(app => app.id === gridQuery.targetApplicationId)?.name ?? gridQuery.targetApplicationId
  )
  if (gridQuery.enabled) add('enabled', 'State', gridQuery.enabled === 'true' ? 'Enabled' : 'Disabled')
  add('status', 'Status')
  add('lastRun', 'Last run')
  return entries
}

export const AutomationGridFilterControls = ({
  applications,
  gridQuery,
  onUpdateGrid,
  tags,
  children
}: FilterProps & { tags: string[]; children?: ReactNode }) => (
  <>
    <FormField
      label='Tag'
      layout='vertical'
    >
      <Select
        value={gridQuery.tag ?? allFilterValue}
        onValueChange={nextValue =>
          onUpdateGrid({ tag: nextValue === allFilterValue ? undefined : nextValue, page: 1 })
        }
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Tag' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>All tags</SelectItem>
          {tags.map(tag => (
            <SelectItem
              key={tag}
              value={tag}
            >
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
    <FormField
      label='Target app'
      layout='vertical'
    >
      <SingleSelectCombobox
        value={gridQuery.targetApplicationId ?? allFilterValue}
        onValueChange={nextValue =>
          onUpdateGrid({ targetApplicationId: nextValue === allFilterValue ? undefined : nextValue, page: 1 })
        }
        options={[
          { value: allFilterValue, label: 'All apps' },
          ...applications.map(app => ({ value: app.id, label: app.name, description: app.id }))
        ]}
        placeholder='Search apps'
      />
    </FormField>
    {children}
    <FormField
      label='Last result'
      layout='vertical'
    >
      <Select
        value={gridQuery.status ?? allFilterValue}
        onValueChange={nextValue =>
          onUpdateGrid({ status: nextValue === allFilterValue ? undefined : nextValue, page: 1 })
        }
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Status' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>Any result</SelectItem>
          <SelectItem value='never_run'>Never run</SelectItem>
          <SelectItem value='running'>Running</SelectItem>
          <SelectItem value='success'>Success</SelectItem>
          <SelectItem value='failed'>Failed</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField
      label='Last run'
      layout='vertical'
    >
      <Select
        value={gridQuery.lastRun ?? allFilterValue}
        onValueChange={nextValue =>
          onUpdateGrid({ lastRun: nextValue === allFilterValue ? undefined : nextValue, page: 1 })
        }
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Last run' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>Any run</SelectItem>
          <SelectItem value='never'>Never run</SelectItem>
          <SelectItem value='7d'>Last 7 days</SelectItem>
          <SelectItem value='30d'>Last 30 days</SelectItem>
          <SelectItem value='90d'>Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
  </>
)

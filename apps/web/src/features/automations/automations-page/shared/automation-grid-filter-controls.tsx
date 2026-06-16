import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { allFilterValue } from './grid-query-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { AutomationLastStatus, AutomationsGridLastRunFilter } from '@/server/orchestrator/automations/types'

export const AutomationTagFilter = ({
  onChange,
  tags,
  value
}: {
  onChange: (value: string | undefined) => void
  tags: string[]
  value?: string
}) => (
  <Select
    value={value ?? allFilterValue}
    onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : nextValue)}
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
)

export const AutomationTargetApplicationFilter = ({
  applications,
  onChange,
  value
}: {
  applications: AndroidApplication[]
  onChange: (value: string | undefined) => void
  value?: string
}) => (
  <Select
    value={value ?? allFilterValue}
    onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : nextValue)}
  >
    <SelectTrigger className='w-full'>
      <SelectValue placeholder='App' />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={allFilterValue}>All apps</SelectItem>
      {applications.map(app => (
        <SelectItem
          key={app.id}
          value={app.id}
        >
          {app.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

export const AutomationLastStatusFilter = ({
  onChange,
  value
}: {
  onChange: (value: AutomationLastStatus | undefined) => void
  value?: AutomationLastStatus
}) => (
  <Select
    value={value ?? allFilterValue}
    onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : (nextValue as AutomationLastStatus))}
  >
    <SelectTrigger className='w-full'>
      <SelectValue placeholder='Status' />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={allFilterValue}>All status</SelectItem>
      <SelectItem value='never_run'>Never run</SelectItem>
      <SelectItem value='running'>Running</SelectItem>
      <SelectItem value='success'>Success</SelectItem>
      <SelectItem value='failed'>Failed</SelectItem>
    </SelectContent>
  </Select>
)

export const AutomationLastRunFilter = ({
  onChange,
  value
}: {
  onChange: (value: AutomationsGridLastRunFilter | undefined) => void
  value?: AutomationsGridLastRunFilter
}) => (
  <Select
    value={value ?? allFilterValue}
    onValueChange={nextValue =>
      onChange(nextValue === allFilterValue ? undefined : (nextValue as AutomationsGridLastRunFilter))
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
)

import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { allFilterValue } from './grid-query-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { AutomationLastStatus, AutomationsGridLastRunFilter } from '@/shared/contracts/automation'

export const AutomationTagFilter = ({
  onChange,
  tags,
  value
}: {
  onChange: (value: string | undefined) => void
  tags: string[]
  value?: string
}) => (
  <FormField
    label='Tag'
    layout='vertical'
  >
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
  </FormField>
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
  <FormField
    label='Target app'
    layout='vertical'
  >
    <SingleSelectCombobox
      value={value ?? allFilterValue}
      onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : nextValue)}
      options={[
        { value: allFilterValue, label: 'All apps' },
        ...applications.map(app => ({ value: app.id, label: app.name, description: app.id }))
      ]}
      placeholder='Search apps'
    />
  </FormField>
)

export const AutomationLastStatusFilter = ({
  onChange,
  value
}: {
  onChange: (value: AutomationLastStatus | undefined) => void
  value?: AutomationLastStatus
}) => (
  <FormField
    label='Last result'
    layout='vertical'
  >
    <Select
      value={value ?? allFilterValue}
      onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : nextValue)}
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
)

export const AutomationLastRunFilter = ({
  onChange,
  value
}: {
  onChange: (value: AutomationsGridLastRunFilter | undefined) => void
  value?: AutomationsGridLastRunFilter
}) => (
  <FormField
    label='Last run'
    layout='vertical'
  >
    <Select
      value={value ?? allFilterValue}
      onValueChange={nextValue => onChange(nextValue === allFilterValue ? undefined : nextValue)}
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
)

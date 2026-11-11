import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { auditActionLabel, auditValueLabel } from '@/shared/model/audit-event-presentation'
import { useActivityController, useActivityData } from '../activity-context'
import { allActivityFilterValue, dateInputValue } from '../activity-format'
import { ActivityFilterField } from './activity-filter-field'

export const ActivityFilterPanel = () => {
  const { facets } = useActivityData()
  const controller = useActivityController()
  const update = (key: 'actor' | 'resourceType' | 'category' | 'action' | 'outcome', value: string) =>
    controller.setFilterValue(key, value === allActivityFilterValue ? undefined : value)

  return (
    <div className='grid gap-5'>
      <ActivityFilterField label='Actor'>
        <SingleSelectCombobox
          value={controller.localFilters.actor ?? allActivityFilterValue}
          onValueChange={value => update('actor', value)}
          options={[
            { value: allActivityFilterValue, label: 'All actors' },
            ...facets.actors.map(actor => ({ value: actor.id, label: actor.label }))
          ]}
          placeholder='Search actors'
        />
      </ActivityFilterField>
      <ActivityFilterField label='Resource type'>
        <Select
          value={controller.localFilters.resourceType ?? allActivityFilterValue}
          onValueChange={value => update('resourceType', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allActivityFilterValue}>All resources</SelectItem>
            {facets.resourceTypes.map(value => (
              <SelectItem
                key={value}
                value={value}
              >
                {auditValueLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ActivityFilterField>
      <ActivityFilterField label='Category'>
        <Select
          value={controller.localFilters.category ?? allActivityFilterValue}
          onValueChange={value => update('category', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allActivityFilterValue}>All categories</SelectItem>
            {facets.categories.map(value => (
              <SelectItem
                key={value}
                value={value}
              >
                {auditValueLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ActivityFilterField>
      <ActivityFilterField label='Action'>
        <SingleSelectCombobox
          value={controller.localFilters.action ?? allActivityFilterValue}
          onValueChange={value => update('action', value)}
          options={[
            { value: allActivityFilterValue, label: 'All actions' },
            ...facets.actions.map(value => ({ value, label: auditActionLabel(value), description: value }))
          ]}
          placeholder='Search actions'
        />
      </ActivityFilterField>
      <ActivityFilterField label='Outcome'>
        <Select
          value={controller.localFilters.outcome ?? allActivityFilterValue}
          onValueChange={value => update('outcome', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allActivityFilterValue}>All outcomes</SelectItem>
            <SelectItem value='success'>Success</SelectItem>
            <SelectItem value='failure'>Failure</SelectItem>
          </SelectContent>
        </Select>
      </ActivityFilterField>
      <div className='grid gap-x-form-column gap-y-3 sm:grid-cols-2 lg:grid-cols-1'>
        <ActivityFilterField label='From (UTC)'>
          <Input
            type='date'
            value={dateInputValue(controller.localFilters.from)}
            onChange={event => controller.setFilterValue('from', event.target.value || undefined)}
          />
        </ActivityFilterField>
        <ActivityFilterField label='To (UTC)'>
          <Input
            type='date'
            value={dateInputValue(controller.localFilters.to)}
            onChange={event => controller.setFilterValue('to', event.target.value || undefined)}
          />
        </ActivityFilterField>
      </div>
    </div>
  )
}

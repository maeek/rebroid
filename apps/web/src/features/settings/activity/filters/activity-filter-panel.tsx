import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActivityController, useActivityData } from '../activity-context'
import { allActivityFilterValue, dateInputValue, formatAction } from '../activity-format'
import { ActivityFilterField } from './activity-filter-field'

export const ActivityFilterPanel = () => {
  const { facets } = useActivityData()
  const controller = useActivityController()
  const update = (key: 'actor' | 'resourceType' | 'category' | 'action' | 'outcome', value: string) =>
    controller.setFilterValue(key, value === allActivityFilterValue ? undefined : value)

  return (
    <div className='grid gap-5'>
      <ActivityFilterField label='Actor'>
        <Select
          value={controller.localFilters.actor ?? allActivityFilterValue}
          onValueChange={value => update('actor', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allActivityFilterValue}>All actors</SelectItem>
            {facets.actors.map(actor => (
              <SelectItem
                key={actor.id}
                value={actor.id}
              >
                {actor.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                {value}
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
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ActivityFilterField>
      <ActivityFilterField label='Action'>
        <Select
          value={controller.localFilters.action ?? allActivityFilterValue}
          onValueChange={value => update('action', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allActivityFilterValue}>All actions</SelectItem>
            {facets.actions.map(value => (
              <SelectItem
                key={value}
                value={value}
              >
                {formatAction(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1'>
        <ActivityFilterField label='From'>
          <Input
            type='date'
            value={dateInputValue(controller.localFilters.from)}
            onChange={event => controller.setFilterValue('from', event.target.value || undefined)}
          />
        </ActivityFilterField>
        <ActivityFilterField label='To'>
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

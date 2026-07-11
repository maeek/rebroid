import { IconFilter, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useActivityController, useActivityData } from '../activity-context'
import { allActivityFilterValue, dateInputValue, formatAction } from '../activity-format'
import { ActivityFilterField } from './activity-filter-field'

export const ActivityFilterSheet = () => {
  const { facets } = useActivityData()
  const controller = useActivityController()

  return (
    <Sheet
      open={controller.filterPanelOpen}
      onOpenChange={controller.setFilterPanelOpen}
    >
      <SheetContent className='grid h-full w-[min(32rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-none'>
        <SheetHeader className='border-b border-surface-border/70 p-6 pb-5'>
          <SheetTitle>Filter activity</SheetTitle>
          <SheetDescription>
            Build a focused audit view by actor, event type, target, outcome, or time range.
          </SheetDescription>
        </SheetHeader>

        <div className='scrollbar-thin min-h-0 overflow-x-hidden overflow-y-auto p-6'>
          <div className='grid gap-6'>
            <section className='grid gap-3'>
              <div>
                <h4 className='font-medium'>Who and what</h4>
                <p className='text-sm text-foreground-muted'>Narrow events by the user and affected resource.</p>
              </div>
              <ActivityFilterField label='Actor'>
                <Select
                  value={controller.localFilters.actor || allActivityFilterValue}
                  onValueChange={value =>
                    controller.setLocalFilters(current => ({
                      ...current,
                      actor: value === allActivityFilterValue ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Actor' />
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
                  value={controller.localFilters.resourceType || allActivityFilterValue}
                  onValueChange={value =>
                    controller.setLocalFilters(current => ({
                      ...current,
                      resourceType: value === allActivityFilterValue ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Resource' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allActivityFilterValue}>All resources</SelectItem>
                    {facets.resourceTypes.map(resourceType => (
                      <SelectItem
                        key={resourceType}
                        value={resourceType}
                      >
                        {resourceType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ActivityFilterField>
            </section>

            <section className='grid gap-3 border-t border-surface-border/60 pt-5'>
              <div>
                <h4 className='font-medium'>Event classification</h4>
                <p className='text-sm text-foreground-muted'>Use category, action, and outcome for review workflows.</p>
              </div>
              <ActivityFilterField label='Category'>
                <Select
                  value={controller.localFilters.category || allActivityFilterValue}
                  onValueChange={value =>
                    controller.setLocalFilters(current => ({
                      ...current,
                      category: value === allActivityFilterValue ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Category' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allActivityFilterValue}>All categories</SelectItem>
                    {facets.categories.map(category => (
                      <SelectItem
                        key={category}
                        value={category}
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ActivityFilterField>
              <ActivityFilterField label='Action'>
                <Select
                  value={controller.localFilters.action || allActivityFilterValue}
                  onValueChange={value =>
                    controller.setLocalFilters(current => ({
                      ...current,
                      action: value === allActivityFilterValue ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Action' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allActivityFilterValue}>All actions</SelectItem>
                    {facets.actions.map(action => (
                      <SelectItem
                        key={action}
                        value={action}
                      >
                        {formatAction(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ActivityFilterField>
              <ActivityFilterField label='Outcome'>
                <Select
                  value={controller.localFilters.outcome || allActivityFilterValue}
                  onValueChange={value =>
                    controller.setLocalFilters(current => ({
                      ...current,
                      outcome: value === allActivityFilterValue ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Outcome' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allActivityFilterValue}>All outcomes</SelectItem>
                    <SelectItem value='success'>Success</SelectItem>
                    <SelectItem value='failure'>Failure</SelectItem>
                  </SelectContent>
                </Select>
              </ActivityFilterField>
            </section>

            <section className='grid gap-3 border-t border-surface-border/60 pt-5'>
              <div>
                <h4 className='font-medium'>Time range</h4>
                <p className='text-sm text-foreground-muted'>Pick a preset or choose exact calendar dates.</p>
              </div>
              <div className='grid grid-cols-3 gap-2'>
                {[1, 7, 30].map(days => (
                  <Button
                    key={days}
                    type='button'
                    variant='secondary'
                    onClick={() => controller.setRange(days)}
                  >
                    {days === 1 ? '24h' : `${days}d`}
                  </Button>
                ))}
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <ActivityFilterField label='From'>
                  <Input
                    id='activity-from'
                    type='date'
                    value={dateInputValue(controller.localFilters.from)}
                    onChange={event =>
                      controller.setLocalFilters(current => ({ ...current, from: event.target.value || undefined }))
                    }
                  />
                </ActivityFilterField>
                <ActivityFilterField label='To'>
                  <Input
                    id='activity-to'
                    type='date'
                    value={dateInputValue(controller.localFilters.to)}
                    onChange={event =>
                      controller.setLocalFilters(current => ({ ...current, to: event.target.value || undefined }))
                    }
                  />
                </ActivityFilterField>
              </div>
            </section>
          </div>
        </div>

        <div className='flex flex-col-reverse gap-2 border-t border-surface-border/70 bg-background/80 p-4 sm:flex-row sm:justify-end'>
          <Button
            variant='secondary'
            disabled={!controller.hasLocalFilters}
            onClick={controller.resetFilters}
          >
            <IconRestore className='size-4' />
            Reset
          </Button>
          <Button onClick={controller.applyFilters}>
            <IconFilter className='size-4' />
            Apply filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

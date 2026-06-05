'use client'

import { useMemo, useState } from 'react'
import { IconCheck, IconChevronDown, IconSearch } from '@tabler/icons-react'
import classNames from 'classnames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AutomationCommandIcon,
  getAutomationCommandCategories,
  getAutomationCommandCategory
} from './automation-command-catalog'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export function AutomationActionPicker({
  commands,
  value,
  onChange
}: {
  commands: AutomationCommand[]
  value: string
  onChange: (uses: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedCommand = commands.find(command => command.uses === value)
  const normalizedQuery = query.trim().toLowerCase()
  const groupedCommands = useMemo(
    () =>
      getAutomationCommandCategories()
        .map(category => ({
          category,
          commands: commands.filter(command => {
            if (getAutomationCommandCategory(command.uses) !== category) return false
            if (!normalizedQuery) return true

            return [command.label, command.uses, command.description, category].some(item =>
              item.toLowerCase().includes(normalizedQuery)
            )
          })
        }))
        .filter(group => group.commands.length > 0),
    [commands, normalizedQuery]
  )

  const selectAction = (uses: string) => {
    onChange(uses)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='input'
          className='h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left'
        >
          <span className='flex min-w-0 items-center gap-3'>
            <span className='flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-primary'>
              <AutomationCommandIcon
                uses={value}
                className='size-5'
              />
            </span>
            <span className='min-w-0'>
              <span className='block truncate text-sm font-medium'>{selectedCommand?.label ?? value}</span>
              <span className='block truncate text-xs text-secondary-foreground'>
                {selectedCommand?.description ?? value}
              </span>
            </span>
          </span>
          <IconChevronDown className='size-4 shrink-0 text-secondary-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(34rem,calc(100vw-2rem))] p-2'
      >
        <div className='grid gap-2'>
          <div className='relative'>
            <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground' />
            <Input
              value={query}
              placeholder='Search actions'
              className='pl-9'
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <div className='max-h-[24rem] overflow-y-auto pr-1'>
            {groupedCommands.length > 0 ? (
              groupedCommands.map(group => (
                <div
                  key={group.category}
                  className='grid gap-1 py-2 first:pt-0'
                >
                  <div className='px-2 text-xs font-medium uppercase text-secondary-foreground'>{group.category}</div>
                  {group.commands.map(command => {
                    const selected = command.uses === value

                    return (
                      <button
                        key={command.uses}
                        type='button'
                        className={classNames(
                          'grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition',
                          selected ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary/60'
                        )}
                        onClick={() => selectAction(command.uses)}
                      >
                        <span className='flex size-8 items-center justify-center rounded-md bg-background/70 text-primary'>
                          <AutomationCommandIcon
                            uses={command.uses}
                            className='size-5'
                          />
                        </span>
                        <span className='min-w-0'>
                          <span className='block truncate text-sm font-medium'>{command.label || command.uses}</span>
                          <span className='block truncate text-xs text-secondary-foreground'>
                            {command.description || command.uses}
                          </span>
                        </span>
                        {selected ? <IconCheck className='size-4 text-primary' /> : null}
                      </button>
                    )
                  })}
                </div>
              ))
            ) : (
              <p className='px-2 py-6 text-center text-sm text-secondary-foreground'>No actions found.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

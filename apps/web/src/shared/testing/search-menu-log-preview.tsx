'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const SearchMenuLogPreview = () => {
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('All resources')
  const completeSearch = useRef<() => void>(() => undefined)
  const [filtered, setFiltered] = useState(false)
  const [lines, setLines] = useState(80)
  const [selected, setSelected] = useState('first')
  return (
    <TooltipProvider>
      <StandardPage>
        <PageHeader title='Search, menus and logs' />
        <PageContent>
          <DataGridWorkspace
            search={search}
            searchPlaceholder='Search preview resources'
            onSearchChange={setSearch}
            onSearch={async value => {
              await new Promise<void>(resolve => {
                completeSearch.current = resolve
              })
              setAppliedSearch(value || 'All resources')
            }}
            filters={
              <label className='flex items-center gap-2'>
                <Checkbox
                  checked={filtered}
                  onCheckedChange={setFiltered}
                />{' '}
                Running resources
              </label>
            }
            activeFilters={
              filtered
                ? [
                    { id: 'state', label: 'State', value: 'Running', onRemove: () => setFiltered(false) },
                    {
                      id: 'owner',
                      label: 'Owner',
                      value: 'Operations and device testing team',
                      onRemove: () => setFiltered(false)
                    },
                    { id: 'image', label: 'Image', value: 'redroid:latest', onRemove: () => setFiltered(false) }
                  ]
                : []
            }
            onResetFilters={() => setFiltered(false)}
          >
            <div
              data-testid='stable-results'
              className='h-16'
            >
              {appliedSearch}
            </div>
          </DataGridWorkspace>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='secondary'
              onClick={() => completeSearch.current()}
            >
              Complete search
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='secondary'>Resource actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Inspect resource</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select
              value={selected}
              onValueChange={value => {
                if (value) setSelected(value)
              }}
            >
              <SelectTrigger
                aria-label='Preview choice'
                className='w-40'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='first'>First</SelectItem>
                <SelectItem value='second'>Second</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Section
            title='Live logs'
            surface='plain'
          >
            <LogsConsole
              followOutput
              log={{
                collectedAt: '2026-11-14',
                output: Array.from({ length: lines }, (_, index) => `Output line ${index + 1}`).join('\n')
              }}
              outputClassName='h-72'
              showCollectedAt={false}
              emptyMessage='Waiting for output'
              controls={
                <Button
                  variant='secondary'
                  onClick={() => setLines(value => value + 20)}
                >
                  Append output
                </Button>
              }
            />
          </Section>
        </PageContent>
      </StandardPage>
    </TooltipProvider>
  )
}

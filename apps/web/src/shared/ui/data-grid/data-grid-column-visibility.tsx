import { IconColumns3 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Table } from '@tanstack/react-table'

export const DataGridColumnVisibilityMenu = <TData,>({
  table,
  disabled = false
}: {
  table: Table<TData>
  disabled?: boolean
}) => {
  'use no memo'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          className='size-8'
          aria-label='Toggle columns'
          disabled={disabled}
        >
          <IconColumns3 className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='scrollbar-thin max-h-(--available-height) overflow-y-auto transform-gpu overscroll-contain'
      >
        {table
          .getAllLeafColumns()
          .filter(column => column.getCanHide())
          .map(column => (
            <DropdownMenuItem
              key={column.id}
              role='menuitemcheckbox'
              aria-checked={column.getIsVisible()}
              onSelect={event => {
                event.preventDefault()
                column.toggleVisibility(!column.getIsVisible())
              }}
            >
              <Checkbox
                checked={column.getIsVisible()}
                aria-hidden='true'
                tabIndex={-1}
                style={{ pointerEvents: 'none' }}
              />
              {column.columnDef.meta?.label ?? column.id}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

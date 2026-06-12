import { IconColumns3 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Table } from '@tanstack/react-table'

export const DataGridColumnVisibilityMenu = <TData,>({ table }: { table: Table<TData> }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type='button'
        variant='secondary'
        size='icon'
        className='size-8'
        aria-label='Toggle columns'
      >
        <IconColumns3 className='size-4' />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align='end'>
      {table
        .getAllLeafColumns()
        .filter(column => column.getCanHide())
        .map(column => (
          <DropdownMenuItem
            key={column.id}
            onSelect={event => {
              event.preventDefault()
              column.toggleVisibility(!column.getIsVisible())
            }}
          >
            <Checkbox
              checked={column.getIsVisible()}
              className='mr-2'
              onClick={event => event.stopPropagation()}
              onCheckedChange={checked => column.toggleVisibility(checked === true)}
            />
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuItem>
        ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

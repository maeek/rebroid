'use client'

import { IconClipboard, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { AutomationStepForm } from '../../editor/builder-utils'

export function AutomationStepAddRow({
  label = 'Add step',
  onAdd,
  onPaste
}: {
  label?: string
  onAdd: (kind: AutomationStepForm['kind']) => void
  onPaste: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='secondary'
          className='w-full justify-start'
        >
          <IconPlus className='size-4' />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        className='min-w-44 p-2'
      >
        <DropdownMenuItem onSelect={() => onAdd('action')}>Action</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAdd('condition')}>Condition</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAdd('switch')}>Switch</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAdd('repeat')}>Repeat</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='gap-2'
          onSelect={onPaste}
        >
          <IconClipboard className='size-4' />
          Paste block
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

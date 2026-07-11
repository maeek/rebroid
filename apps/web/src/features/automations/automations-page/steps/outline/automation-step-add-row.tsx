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
          variant='outline'
          className='h-9 w-full justify-start gap-2 rounded-control border border-dashed border-surface-border/60 bg-background/15 px-3 text-foreground-muted hover:bg-surface-band/40 hover:text-foreground'
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

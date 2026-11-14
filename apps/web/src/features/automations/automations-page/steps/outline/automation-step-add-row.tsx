'use client'

import { useId, useState } from 'react'
import { IconClipboard, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AutomationActionPicker } from '../catalog/automation-action-picker'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationStepAddRow({
  dropping = false,
  commands,
  onAdd,
  onPaste
}: {
  dropping?: boolean
  commands: AutomationCommand[]
  onAdd: (choice: string) => void
  onPaste: () => void
}) {
  const [open, setOpen] = useState(false)
  const searchId = useId()
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='secondary'
          className='w-full justify-start'
        >
          <IconPlus
            aria-hidden
            className='size-4'
          />
          {dropping ? 'Drop step here' : 'Add step'}
        </Button>
      </DialogTrigger>
      <DialogContent
        className='max-w-full gap-4 sm:max-w-lg'
        initialFocus={() => document.getElementById(searchId)}
      >
        <DialogTitle>Add step</DialogTitle>
        <DialogDescription className='sr-only'>Choose an action or a control block to insert.</DialogDescription>
        <div className='grid min-w-0 gap-2'>
          <AutomationActionPicker
            id={searchId}
            aria-label='Search steps'
            commands={commands}
            includeBlocks
            inline
            value=''
            onChange={choice => {
              setOpen(false)
              onAdd(choice)
            }}
          />
        </div>
        <div className='border-t border-surface-border/60 pt-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              setOpen(false)
              onPaste()
            }}
          >
            <IconClipboard
              aria-hidden
              className='size-4'
            />
            Paste block
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

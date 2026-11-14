'use client'

import { useId, useRef, useState } from 'react'
import { IconArrowsExchange, IconDotsVertical } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AutomationActionPicker } from './automation-action-picker'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationReplaceBlockMenu({
  commands,
  value,
  onReplace
}: {
  commands: AutomationCommand[]
  value: string
  onReplace: (uses: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const searchId = useId()
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const replaceOnClose = useRef(false)

  return (
    <>
      <DropdownMenu
        onOpenChangeComplete={open => {
          if (open || !replaceOnClose.current) return
          replaceOnClose.current = false
          setDialogOpen(true)
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label='More step actions'
          >
            <IconDotsVertical
              aria-hidden
              className='size-4'
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            className='gap-2'
            onSelect={() => {
              replaceOnClose.current = true
            }}
          >
            <IconArrowsExchange
              aria-hidden
              className='size-4'
            />
            Replace block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent
          className='max-w-full gap-4 sm:max-w-lg'
          initialFocus={() => document.getElementById(searchId)}
          finalFocus={menuTriggerRef}
        >
          <DialogTitle>Replace block</DialogTitle>
          <DialogDescription>The replacement starts with its default settings.</DialogDescription>
          <div className='grid min-w-0 gap-2'>
            <AutomationActionPicker
              inline
              id={searchId}
              aria-label='Search actions'
              commands={commands}
              value={value}
              onChange={uses => {
                setDialogOpen(false)
                if (uses !== value) onReplace(uses)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

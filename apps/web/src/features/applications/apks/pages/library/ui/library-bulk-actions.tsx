'use client'

import { useRef, useState } from 'react'
import { IconBan, IconLockOpen, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { availableBlockScopes, getActionExclusion } from '../model/library-grid'
import type { ApkLibraryAction, ApkLibraryEntry } from '@/shared/contracts/apk-library'

export const ApkLibraryBulkActions = ({
  selected,
  canBlock,
  canDelete,
  disabled,
  onAction,
  clear
}: {
  selected: ApkLibraryEntry[]
  canBlock: boolean
  canDelete: boolean
  disabled: boolean
  onAction: (action: ApkLibraryAction) => void
  clear: () => void
}) => {
  const [open, setOpen] = useState(false)
  const mobileAction = useRef<ApkLibraryAction | null>(null)
  const actions = [
    {
      id: 'block',
      label: 'Block APKs',
      icon: IconBan,
      available: canBlock && availableBlockScopes(selected, 'block').length > 0
    },
    {
      id: 'unblock',
      label: 'Unblock APKs',
      icon: IconLockOpen,
      available: canBlock && availableBlockScopes(selected, 'unblock').length > 0
    },
    {
      id: 'delete',
      label: 'Delete files',
      icon: IconTrash,
      available: canDelete && selected.some(entry => !getActionExclusion(entry, 'delete', 'sha256'))
    }
  ] as const
  const available = actions.filter(action => action.available)
  return (
    <>
      <div className='hidden shrink-0 items-center gap-2 sm:flex'>
        {available.map(({ id, label }) => (
          <Button
            key={id}
            type='button'
            variant={id === 'unblock' ? 'ghost' : 'danger-ghost'}
            disabled={disabled}
            onClick={() => onAction(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {available.length ? (
        <div className='shrink-0 sm:hidden'>
          <Sheet
            open={open}
            onOpenChange={setOpen}
            onOpenChangeComplete={next => {
              if (next || !mobileAction.current) return
              const action = mobileAction.current
              mobileAction.current = null
              onAction(action)
            }}
          >
            <SheetTrigger
              render={
                <Button
                  variant='ghost'
                  disabled={disabled}
                />
              }
            >
              Actions
            </SheetTrigger>
            <SheetContent
              side='bottom'
              className='grid max-h-[100dvh] gap-3 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]'
            >
              <SheetHeader className='pr-10 text-left'>
                <SheetTitle>APK actions</SheetTitle>
                <SheetDescription>{selected.length} selected</SheetDescription>
              </SheetHeader>
              <div className='grid gap-1'>
                {available.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type='button'
                    variant={id === 'unblock' ? 'ghost' : 'danger-ghost'}
                    disabled={disabled}
                    className='min-h-11 justify-start px-3'
                    onClick={() => {
                      mobileAction.current = id
                      setOpen(false)
                    }}
                  >
                    <Icon aria-hidden />
                    {label}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      ) : selected.length ? (
        <span className='min-w-0 text-xs text-foreground-muted'>No actions available</span>
      ) : null}
      <Button
        type='button'
        variant='ghost'
        aria-label='Clear selection'
        disabled={disabled}
        onClick={clear}
      >
        Done
      </Button>
    </>
  )
}

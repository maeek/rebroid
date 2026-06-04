'use client'

import { IconChevronDown, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Visible } from '@/components/ui/visible'
import type { RuntimePowerControlsProps } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

export const RuntimePowerControls = ({
  app,
  canRunPrimary,
  isBusy,
  isRunningAction,
  menuActions,
  menuDisabled,
  primaryVariant,
  primaryLabel,
  primaryIcon,
  onPrimaryAction
}: RuntimePowerControlsProps) => (
  <div className='inline-flex items-center'>
    <Button
      variant={primaryVariant}
      disabled={!app || !canRunPrimary || isBusy || isRunningAction}
      className='rounded-r-none border-r-0'
      onClick={onPrimaryAction}
    >
      <Visible
        when={isRunningAction}
        fallback={primaryIcon}
      >
        <IconLoader2 className='size-4 animate-spin' />
      </Visible>
      {primaryLabel}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={primaryVariant}
          size='icon'
          disabled={menuDisabled}
          className='rounded-l-none px-2'
          aria-label='Runtime actions'
        >
          <IconChevronDown className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='min-w-48'
      >
        {menuActions.map(action => (
          <DropdownMenuItem
            key={action.key}
            className='gap-2'
            disabled={action.disabled}
            onSelect={action.onSelect}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)

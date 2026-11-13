'use client'

import { IconChevronDown, IconLoader2, IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import { ActionStateContent } from '@/components/ui/action-state-content'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { runtimeActionLabels } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import { useRuntimePowerActionContext } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'
import motion from '@/components/ui/action-motion.module.css'

export const RuntimePowerControls = () => {
  const {
    app,
    canRunPrimary,
    isBusy,
    isRunningAction,
    menuActions,
    menuDisabled,
    primaryLabel,
    primaryVariant,
    onPrimaryAction
  } = useRuntimePowerActionContext()

  return (
    <div className='inline-flex items-center'>
      <Button
        aria-busy={isBusy || isRunningAction || undefined}
        variant={primaryVariant}
        disabled={!app || !canRunPrimary || isBusy || isRunningAction}
        className={`${motion.control} rounded-r-none border-r-0`}
        onClick={onPrimaryAction}
      >
        <ActionStateContent
          state={primaryLabel}
          states={Object.values(runtimeActionLabels).map(label => {
            let icon = (
              <IconLoader2
                aria-hidden
                className={label === primaryLabel ? 'size-4 motion-safe:animate-spin' : 'size-4'}
              />
            )
            if (label === runtimeActionLabels.idle)
              icon = (
                <IconPlayerPlayFilled
                  aria-hidden
                  className='size-4'
                />
              )
            if (label === runtimeActionLabels.running)
              icon = (
                <IconPlayerStopFilled
                  aria-hidden
                  className='size-4'
                />
              )
            return {
              key: label,
              content: (
                <>
                  {icon}
                  {label}
                </>
              )
            }
          })}
        />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={primaryVariant}
            size='icon-md'
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
}

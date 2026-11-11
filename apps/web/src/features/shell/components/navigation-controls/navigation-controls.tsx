import { cn } from '@/lib/utils'
import { NavigationAccount } from './account'
import { NavigationNotifications } from './notifications'
import { OrchestratorStatus } from './orchestrator-status'
import { navigationPopupPositions } from './popup-position'
import type { ShellUser } from '../shell-user'

export const NavigationControls = ({
  user,
  placement,
  polling
}: {
  user: ShellUser
  placement: keyof typeof navigationPopupPositions
  polling: boolean
}) => {
  const compact = placement === 'rail'
  const inHeader = placement === 'header'
  const popupPosition = navigationPopupPositions[placement]
  const account = (
    <NavigationAccount
      initialUser={user}
      popupPosition={popupPosition}
    />
  )
  return (
    <div
      role='group'
      aria-label='Navigation controls'
      className={cn(
        'flex shrink-0 items-center gap-2',
        inHeader ? 'sm:gap-4' : 'py-3',
        placement === 'sidebar' && 'justify-between px-3',
        compact && 'w-16 flex-col px-2'
      )}
    >
      {placement === 'sidebar' ? account : null}
      <div className={cn('flex items-center gap-1', compact && 'flex-col gap-2')}>
        <OrchestratorStatus
          compact={compact}
          popupPosition={popupPosition}
          polling={polling}
        />
        <NavigationNotifications
          popupPosition={popupPosition}
          polling={polling}
        />
      </div>
      {placement !== 'sidebar' ? account : null}
    </div>
  )
}

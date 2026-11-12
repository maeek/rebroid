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
  const inSidebar = placement === 'sidebar'
  const popupPosition = navigationPopupPositions[placement]
  return (
    <div
      role='group'
      aria-label='Navigation controls'
      className={cn(
        'flex shrink-0 items-center gap-2',
        inHeader ? 'sm:gap-4' : 'py-3',
        inSidebar && 'flex-col items-stretch gap-1 border-t border-surface-border/60 px-3',
        compact && 'w-16 flex-col px-2'
      )}
    >
      <div className={cn('flex items-center gap-1', inSidebar && 'justify-between', compact && 'flex-col gap-2')}>
        <OrchestratorStatus
          compact={compact}
          showSystemLabel={inSidebar}
          popupPosition={popupPosition}
          polling={polling}
        />
        <NavigationNotifications
          popupPosition={popupPosition}
          polling={polling}
        />
      </div>
      <NavigationAccount
        initialUser={user}
        popupPosition={popupPosition}
        showName={inSidebar}
      />
    </div>
  )
}

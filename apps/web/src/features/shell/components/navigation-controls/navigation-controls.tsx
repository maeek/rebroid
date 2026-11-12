import { cn } from '@/lib/utils'
import { NavigationAccount } from './account'
import { NavigationNotifications } from './notifications'
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
  const account = (
    <NavigationAccount
      initialUser={user}
      popupPosition={popupPosition}
      showName={inSidebar}
    />
  )
  return (
    <div
      role='group'
      aria-label='Navigation controls'
      className={cn(
        'flex shrink-0 items-center gap-2',
        inHeader ? 'sm:gap-4' : 'py-3',
        inSidebar && 'gap-1 border-t border-surface-border/60 px-3',
        compact && 'w-16 flex-col px-2'
      )}
    >
      {inSidebar ? <div className='min-w-0 flex-1'>{account}</div> : null}
      <NavigationNotifications
        popupPosition={inSidebar ? { ...popupPosition, align: 'end' } : popupPosition}
        polling={polling}
      />
      {inSidebar ? null : account}
    </div>
  )
}

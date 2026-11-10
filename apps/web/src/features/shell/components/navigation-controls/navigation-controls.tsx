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
  const popupPosition = navigationPopupPositions[placement]
  const account = (
    <NavigationAccount
      initialUser={user}
      popupPosition={popupPosition}
    />
  )
  const notifications = (
    <NavigationNotifications
      popupPosition={popupPosition}
      polling={polling}
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
        compact && 'w-16 flex-col-reverse px-2'
      )}
    >
      {inHeader ? notifications : account}
      {inHeader ? account : notifications}
    </div>
  )
}

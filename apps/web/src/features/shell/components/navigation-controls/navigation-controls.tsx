import { cn } from '@/lib/utils'
import { NavigationAccount } from './account'
import { navigationPopupPositions } from './popup-position'
import type { ShellUser } from '../shell-user'

export const NavigationControls = ({
  user,
  placement
}: {
  user: ShellUser
  placement: keyof typeof navigationPopupPositions
}) => {
  const compact = placement === 'rail'
  return (
    <div
      role='group'
      aria-label='Navigation controls'
      className={cn(
        'flex shrink-0 items-center',
        compact ? 'w-16 justify-center py-3' : 'border-t border-surface-border/60 px-3 py-3'
      )}
    >
      <NavigationAccount
        initialUser={user}
        popupPosition={navigationPopupPositions[placement]}
        showName={!compact}
      />
    </div>
  )
}

import { IconCirclePlus } from '@tabler/icons-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { usePlatformHealth } from './platform-health-context'
import {
  hasChildWithSameHealth,
  variantStyles,
  type NavigationGroup,
  type NavigationItem
} from './protected-navigation-config'
import { NavigationHealthDot, NavLink } from './protected-navigation-parts'

export const NavigationRail = ({
  entries,
  isActivePath
}: {
  entries: (NavigationItem | NavigationGroup)[]
  isActivePath: (href: string) => boolean
}) => {
  const styles = variantStyles.rail
  const statuses = usePlatformHealth()

  return (
    <DropdownMenu<NavigationGroup> modal={false}>
      {({ payload }) => (
        <>
          <ul className={cn(styles.list, 'pointer-events-auto')}>
            {entries.map(entry => {
              const { Icon } = entry
              if (!('items' in entry)) {
                return (
                  <NavLink
                    key={entry.href}
                    href={entry.href}
                    label={entry.name}
                    healthId={entry.healthId}
                    Icon={Icon}
                    isActive={isActivePath(entry.href)}
                    variant='rail'
                  />
                )
              }
              if (!entry.items.length) return null
              const containsActive =
                (entry.href && isActivePath(entry.href)) || entry.items.some(item => isActivePath(item.href))
              const status = entry.healthId ? statuses[entry.healthId] : undefined
              return (
                <li key={entry.label}>
                  <DropdownMenuTrigger
                    asChild
                    payload={entry}
                    openOnHover
                    delay={0}
                    closeDelay={120}
                  >
                    <button
                      type='button'
                      aria-label={entry.label}
                      title={status?.label}
                      className={cn(
                        styles.item,
                        containsActive && styles.activeItem,
                        status && 'relative',
                        status &&
                          hasChildWithSameHealth(entry.healthId, entry.items) &&
                          'aria-expanded:[&>[data-slot=navigation-health-dot]]:hidden'
                      )}
                    >
                      <Icon className={styles.icon} />
                      <NavigationHealthDot
                        status={status}
                        compact
                      />
                    </button>
                  </DropdownMenuTrigger>
                </li>
              )
            })}
          </ul>
          <DropdownMenuContent
            aria-label={payload?.label}
            side='right'
            sideOffset={22}
            className='w-56 max-w-(--available-width) animate-none! rounded-panel border-surface-border/60 bg-surface-editor'
          >
            {payload ? (
              <NavigationRailItems
                group={payload}
                isActivePath={isActivePath}
              />
            ) : null}
          </DropdownMenuContent>
        </>
      )}
    </DropdownMenu>
  )
}

const NavigationRailItems = ({
  group,
  isActivePath
}: {
  group: NavigationGroup
  isActivePath: (href: string) => boolean
}) => {
  const styles = variantStyles.rail
  const overviewHealthId = hasChildWithSameHealth(group.healthId, group.items) ? undefined : group.healthId
  const items = group.href
    ? [{ name: 'Overview', href: group.href, Icon: group.Icon, healthId: overviewHealthId }, ...group.items]
    : group.items
  const shortcuts = items.flatMap(item => (item.shortcut ? [item.shortcut] : []))
  const statuses = usePlatformHealth()
  return (
    <>
      {items.map(({ name, href, Icon: ItemIcon, healthId }) => {
        const active = isActivePath(href)
        const status = healthId ? statuses[healthId] : undefined
        return (
          <DropdownMenuItem
            asChild
            key={href}
            className={cn('gap-2', active && styles.activeItem)}
          >
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              title={status?.label}
            >
              <ItemIcon className={styles.icon} />
              {name}
              <NavigationHealthDot status={status} />
            </Link>
          </DropdownMenuItem>
        )
      })}
      {shortcuts.length ? <DropdownMenuSeparator /> : null}
      {shortcuts.map(({ href, label: shortcutLabel }) => (
        <DropdownMenuItem
          asChild
          key={href}
          className='gap-2'
        >
          <Link href={href}>
            <IconCirclePlus className={styles.sectionActionIcon} />
            {shortcutLabel}
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  )
}

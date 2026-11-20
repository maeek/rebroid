import { useId } from 'react'
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
import { NavigationHealth, NavigationHealthDetails } from './navigation-health'
import { usePlatformHealth } from './platform-health-context'
import {
  hasChildWithSameHealth,
  variantStyles,
  type NavigationGroup,
  type NavigationItem
} from './protected-navigation-config'
import { NavLink } from './protected-navigation-parts'

export const NavigationRail = ({
  entries,
  isActivePath
}: {
  entries: (NavigationItem | NavigationGroup)[]
  isActivePath: (href: string) => boolean
}) => {
  const railId = useId()
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
                      aria-describedby={status ? `${railId}-${entry.healthId}` : undefined}
                      className={cn(
                        styles.item,
                        'relative',
                        containsActive && styles.activeItem,
                        status &&
                          hasChildWithSameHealth(entry.healthId, entry.items) &&
                          'aria-expanded:[&>[data-slot=navigation-health]]:hidden'
                      )}
                    >
                      <Icon className={styles.icon} />
                      <NavigationHealth
                        status={status}
                        compact
                      />
                    </button>
                  </DropdownMenuTrigger>
                  {status ? (
                    <span
                      hidden
                      id={`${railId}-${entry.healthId}`}
                    >
                      {status.label}. {status.description}
                    </span>
                  ) : null}
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
  const statuses = usePlatformHealth()
  const issue = group.healthId ? statuses[group.healthId] : undefined
  const overviewHealthId = hasChildWithSameHealth(group.healthId, group.items) ? undefined : group.healthId
  const items = group.href
    ? [{ name: 'Overview', href: group.href, Icon: group.Icon, healthId: overviewHealthId }, ...group.items]
    : group.items
  const shortcuts = items.flatMap(item => (item.shortcut ? [item.shortcut] : []))
  return (
    <>
      {issue ? (
        <div className='border-b border-surface-border/60 px-2.5 py-2 touch:hidden'>
          <NavigationHealthDetails
            label={group.label}
            status={issue}
          />
        </div>
      ) : null}
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
              aria-description={status?.label}
            >
              <ItemIcon className={styles.icon} />
              {name}
              <NavigationHealth status={status} />
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

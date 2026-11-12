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
import { variantStyles, type NavigationGroup, type NavigationItem } from './protected-navigation-config'
import { NavLink } from './protected-navigation-parts'

export const NavigationRail = ({
  entries,
  isActivePath
}: {
  entries: (NavigationItem | NavigationGroup)[]
  isActivePath: (href: string) => boolean
}) => {
  const styles = variantStyles.rail

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
                    Icon={Icon}
                    isActive={isActivePath(entry.href)}
                    variant='rail'
                  />
                )
              }
              if (!entry.items.length) return null
              const containsActive = entry.items.some(item => isActivePath(item.href))
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
                      className={cn(styles.item, containsActive && styles.activeItem)}
                    >
                      <Icon className={styles.icon} />
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
                items={payload.items}
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
  items,
  isActivePath
}: {
  items: NavigationItem[]
  isActivePath: (href: string) => boolean
}) => {
  const styles = variantStyles.rail
  const shortcuts = items.flatMap(item => (item.shortcut ? [item.shortcut] : []))
  return (
    <>
      {items.map(({ name, href, Icon: ItemIcon }) => {
        const active = isActivePath(href)
        return (
          <DropdownMenuItem
            asChild
            key={href}
            className={cn('gap-2', active && styles.activeItem)}
          >
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
            >
              <ItemIcon className={styles.icon} />
              {name}
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

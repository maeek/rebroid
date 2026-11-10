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
import { variantStyles, type NavigationItem } from './protected-navigation-config'

type NavigationGroup = { label: string; items: NavigationItem[] }

export const NavigationRailGroups = ({
  groups,
  isActivePath
}: {
  groups: NavigationGroup[]
  isActivePath: (href: string) => boolean
}) => {
  const styles = variantStyles.rail

  return (
    <DropdownMenu<NavigationGroup> modal={false}>
      {({ payload }) => (
        <>
          <ul className={cn(styles.list, 'pointer-events-auto')}>
            {groups.map(group => {
              const first = group.items[0]
              if (!first) return null
              const { Icon } = first
              const containsActive = group.items.some(item => isActivePath(item.href))
              return (
                <li key={group.label}>
                  <DropdownMenuTrigger
                    asChild
                    payload={group}
                    openOnHover
                    delay={0}
                    closeDelay={120}
                  >
                    <button
                      type='button'
                      aria-label={group.label}
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

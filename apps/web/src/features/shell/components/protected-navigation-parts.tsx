import { useId } from 'react'
import { IconChevronRight, IconCirclePlus, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { variantStyles, type NavigationItem, type NavigationVariant } from './protected-navigation-config'

type NavLinkProps = {
  href: string
  label: string
  Icon: NavigationItem['Icon']
  isActive: boolean
  variant: NavigationVariant
  onNavigate?: () => void
}

type SectionHeaderProps = {
  title: string
  variant: NavigationVariant
  actionHref?: string
  actionLabel?: string
  onNavigate?: () => void
}

export const SectionHeader = ({ title, variant, actionHref, actionLabel, onNavigate }: SectionHeaderProps) => {
  const styles = variantStyles[variant]
  const action =
    actionHref && actionLabel ? (
      <Link
        href={actionHref}
        className={styles.sectionAction}
        aria-label={actionLabel}
        title={actionLabel}
        onClick={onNavigate}
      >
        <IconCirclePlus className={styles.sectionActionIcon} />
      </Link>
    ) : null

  return (
    <div className={styles.sectionHeader}>
      <h6 className={styles.sectionTitle}>{title}</h6>
      {action}
    </div>
  )
}

export const NavLink = ({ href, label, Icon, isActive, variant, onNavigate }: NavLinkProps) => {
  const styles = variantStyles[variant]

  return (
    <li>
      <Link
        href={href}
        className={cn(styles.item, isActive && styles.activeItem)}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className={styles.iconWrap}>
          <Icon className={styles.icon} />
        </div>
        <span className={styles.label}>{label}</span>
      </Link>
    </li>
  )
}

export const NestedNavigationMenu = ({
  label,
  variant,
  items,
  isOpen,
  Icon: ParentIcon,
  isActivePath,
  onNavigate,
  onToggle
}: {
  label: string
  variant: NavigationVariant
  items: NavigationItem[]
  isOpen: boolean
  Icon: NavigationItem['Icon']
  isActivePath: (href: string) => boolean
  onNavigate?: () => void
  onToggle: () => void
}) => {
  const styles = variantStyles[variant]
  const listId = useId()
  const containsActive = items.some(item => isActivePath(item.href))

  return (
    <li>
      <button
        type='button'
        onClick={onToggle}
        aria-label={isOpen ? `Collapse ${label} menu` : `Expand ${label} menu`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        className={cn(styles.item, 'w-full min-w-0 text-left', containsActive && !isOpen && styles.activeItem)}
      >
        <div className={styles.iconWrap}>
          <ParentIcon className={styles.icon} />
        </div>
        <span className={cn(styles.label, 'min-w-0 flex-1 truncate')}>{label}</span>
        <IconChevronRight
          className={cn('mr-1 size-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')}
        />
      </button>
      <Visible when={isOpen}>
        <ul
          id={listId}
          className={styles.nestedList}
        >
          {items.map(({ name, Icon, href: itemHref, shortcut }) => (
            <li
              key={itemHref}
              className='relative flex items-center'
            >
              <Link
                href={itemHref}
                className={cn(
                  styles.nestedItem,
                  'flex-1',
                  shortcut && 'pr-9',
                  isActivePath(itemHref) && styles.nestedActiveItem
                )}
                onClick={onNavigate}
                aria-current={isActivePath(itemHref) ? 'page' : undefined}
              >
                <div className={styles.nestedIconWrap}>
                  <Icon className={styles.nestedIcon} />
                </div>
                <span className='truncate'>{name}</span>
              </Link>
              {shortcut ? (
                <Link
                  href={shortcut.href}
                  className={cn(styles.sectionAction, 'absolute right-2 size-6')}
                  aria-label={shortcut.label}
                  title={shortcut.label}
                  onClick={onNavigate}
                >
                  <IconPlus className='size-4' />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </Visible>
    </li>
  )
}

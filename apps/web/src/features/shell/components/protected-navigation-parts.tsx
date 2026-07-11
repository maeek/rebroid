import { IconChevronDown, IconCirclePlus } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Visible } from '@/components/ui/visible'
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
  href,
  label,
  variant,
  items,
  isOpen,
  Icon: ParentIcon,
  isActivePath,
  onNavigate,
  onToggle
}: {
  href: string
  label: string
  variant: NavigationVariant
  items: NavigationItem[]
  isOpen: boolean
  Icon: NavigationItem['Icon']
  isActivePath: (href: string, exact?: boolean) => boolean
  onNavigate?: () => void
  onToggle: () => void
}) => {
  const styles = variantStyles[variant]

  return (
    <li>
      <div className='flex items-center rounded-control text-foreground dark:hover:text-white'>
        <Link
          href={href}
          className={cn(styles.item, 'min-w-0 flex-1 rounded-none bg-transparent')}
          onClick={onNavigate}
        >
          <div className={styles.iconWrap}>
            <ParentIcon className={styles.icon} />
          </div>
          <span className={cn(styles.label, 'truncate')}>{label}</span>
        </Link>
        <button
          type='button'
          className={styles.toggleButton}
          aria-label={isOpen ? `Collapse ${label} menu` : `Expand ${label} menu`}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <IconChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>
      <Visible when={isOpen}>
        <ul className={styles.nestedList}>
          {items.map(({ name, Icon, href: itemHref }) => (
            <li key={itemHref}>
              <Link
                href={itemHref}
                className={cn(styles.nestedItem, isActivePath(itemHref, itemHref === href) && styles.nestedActiveItem)}
                onClick={onNavigate}
              >
                <div className={styles.nestedIconWrap}>
                  <Icon className={styles.nestedIcon} />
                </div>
                <span className='truncate'>{name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Visible>
    </li>
  )
}

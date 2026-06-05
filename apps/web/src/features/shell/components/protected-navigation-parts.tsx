import { IconChevronDown, IconCirclePlus } from '@tabler/icons-react'
import classNames from 'classnames'
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
    <Link
      href={href}
      onClick={onNavigate}
    >
      <li className={classNames(styles.item, isActive && styles.activeItem)}>
        <div className={styles.iconWrap}>
          <Icon className={styles.icon} />
        </div>
        <span className={styles.label}>{label}</span>
      </li>
    </Link>
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
      <div className='flex items-center rounded-sm text-foreground dark:hover:text-white'>
        <Link
          href={href}
          className={classNames(styles.item, 'min-w-0 flex-1 rounded-none bg-transparent')}
          onClick={onNavigate}
        >
          <div className={styles.iconWrap}>
            <ParentIcon className={styles.icon} />
          </div>
          <span className={classNames(styles.label, 'truncate')}>{label}</span>
        </Link>
        <button
          type='button'
          className={styles.toggleButton}
          aria-label={isOpen ? `Collapse ${label} menu` : `Expand ${label} menu`}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <IconChevronDown className={classNames('size-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>
      <Visible when={isOpen}>
        <ul className={styles.nestedList}>
          {items.map(({ name, Icon, href: itemHref }) => (
            <Link
              key={itemHref}
              href={itemHref}
              onClick={onNavigate}
            >
              <li
                className={classNames(
                  styles.nestedItem,
                  isActivePath(itemHref, itemHref === href) && styles.nestedActiveItem
                )}
              >
                <div className={styles.nestedIconWrap}>
                  <Icon className={styles.nestedIcon} />
                </div>
                <span className='truncate'>{name}</span>
              </li>
            </Link>
          ))}
        </ul>
      </Visible>
    </li>
  )
}

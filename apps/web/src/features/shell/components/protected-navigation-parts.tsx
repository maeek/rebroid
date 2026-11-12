import { useId } from 'react'
import { IconChevronRight, IconCirclePlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { NavigationHint } from './navigation-hint'
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

const NavigationAddLink = ({
  href,
  label,
  variant,
  className,
  onNavigate
}: {
  href: string
  label: string
  variant: NavigationVariant
  className?: string
  onNavigate?: () => void
}) => {
  const styles = variantStyles[variant]
  return (
    <NavigationHint label={label}>
      <Link
        href={href}
        className={cn(styles.sectionAction, className)}
        aria-label={label}
        onClick={onNavigate}
      >
        <IconCirclePlus className={styles.sectionActionIcon} />
      </Link>
    </NavigationHint>
  )
}

export const SectionHeader = ({ title, variant, actionHref, actionLabel, onNavigate }: SectionHeaderProps) => {
  const styles = variantStyles[variant]
  const action =
    actionHref && actionLabel ? (
      <NavigationAddLink
        href={actionHref}
        label={actionLabel}
        variant={variant}
        onNavigate={onNavigate}
      />
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
  const link = (
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
  )

  return <li>{variant === 'rail' ? <NavigationHint label={label}>{link}</NavigationHint> : link}</li>
}

export const NestedNavigationMenu = ({
  label,
  href,
  variant,
  items,
  isOpen,
  Icon: ParentIcon,
  isActivePath,
  onNavigate,
  onToggle
}: {
  label: string
  href?: string
  variant: Exclude<NavigationVariant, 'rail'>
  items: NavigationItem[]
  isOpen: boolean
  Icon: NavigationItem['Icon']
  isActivePath: (href: string) => boolean
  onNavigate?: () => void
  onToggle: () => void
}) => {
  const listId = useId()
  const styles = variantStyles[variant]
  const containsActive = items.some(item => isActivePath(item.href))
  const toggleActive = containsActive && !isOpen && styles.activeItem
  const linkActive = href !== undefined && isActivePath(href)
  const toggleProps = {
    type: 'button',
    onClick: onToggle,
    'aria-label': isOpen ? `Collapse ${label} menu` : `Expand ${label} menu`,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? listId : undefined
  } as const
  const labelContent = (
    <>
      <div className={styles.iconWrap}>
        <ParentIcon className={styles.icon} />
      </div>
      <span className={cn(styles.label, 'min-w-0 flex-1 truncate')}>{label}</span>
    </>
  )
  const chevron = (
    <IconChevronRight
      aria-hidden='true'
      className={cn('size-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')}
    />
  )

  return (
    <li>
      {href ? (
        <div className='flex min-w-0'>
          <Link
            href={href}
            className={cn(styles.item, 'min-w-0 flex-1', linkActive && styles.activeItem)}
            onClick={onNavigate}
            aria-current={linkActive ? 'page' : undefined}
          >
            {labelContent}
          </Link>
          <button
            {...toggleProps}
            className={cn(styles.toggleButton, toggleActive)}
          >
            {chevron}
          </button>
        </div>
      ) : (
        <button
          {...toggleProps}
          className={cn(styles.item, 'w-full min-w-0 pr-3 text-left', toggleActive)}
        >
          {labelContent}
          {chevron}
        </button>
      )}
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
                  shortcut && 'pr-9 touch:pr-2',
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
                <NavigationAddLink
                  href={shortcut.href}
                  label={shortcut.label}
                  variant={variant}
                  className='absolute right-2 size-6 touch:static'
                  onNavigate={onNavigate}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Visible>
    </li>
  )
}

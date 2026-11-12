import { useId } from 'react'
import { IconChevronRight, IconCirclePlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { NavigationHint } from './navigation-hint'
import { usePlatformHealth, type NavigationHealthStatus } from './platform-health-context'
import {
  hasChildWithSameHealth,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'

type NavLinkProps = {
  href: string
  label: string
  Icon: NavigationItem['Icon']
  healthId?: NavigationItem['healthId']
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

export const NavigationHealthDot = ({
  status,
  compact = false
}: {
  status?: NavigationHealthStatus
  compact?: boolean
}) =>
  status ? (
    <span
      aria-hidden='true'
      data-slot='navigation-health-dot'
      className={cn(
        'size-2 shrink-0 rounded-full',
        compact ? 'absolute right-0.5 top-0.5' : 'ml-auto mr-1',
        status.dot
      )}
    />
  ) : null

export const NavLink = ({ href, label, Icon, healthId, isActive, variant, onNavigate }: NavLinkProps) => {
  const styles = variantStyles[variant]
  const statuses = usePlatformHealth()
  const status = healthId ? statuses[healthId] : undefined
  const compact = variant === 'rail'
  const link = (
    <Link
      href={href}
      className={cn(styles.item, isActive && styles.activeItem, compact && status && 'relative')}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      title={status?.label}
    >
      <div className={styles.iconWrap}>
        <Icon className={styles.icon} />
      </div>
      <span className={styles.label}>{label}</span>
      <NavigationHealthDot
        status={status}
        compact={compact}
      />
    </Link>
  )

  return (
    <li>
      {compact ? <NavigationHint label={status ? `${label} · ${status.label}` : label}>{link}</NavigationHint> : link}
    </li>
  )
}

export const NestedNavigationMenu = ({
  label,
  href,
  healthId,
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
  healthId?: NavigationItem['healthId']
  variant: Exclude<NavigationVariant, 'rail'>
  items: NavigationItem[]
  isOpen: boolean
  Icon: NavigationItem['Icon']
  isActivePath: (href: string) => boolean
  onNavigate?: () => void
  onToggle: () => void
}) => {
  const listId = useId()
  const statuses = usePlatformHealth()
  const status = healthId && !(isOpen && hasChildWithSameHealth(healthId, items)) ? statuses[healthId] : undefined
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
            title={status?.label}
          >
            {labelContent}
            <NavigationHealthDot status={status} />
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
          {items.map(({ name, Icon, href: itemHref, shortcut, healthId: itemHealthId }) => {
            const itemStatus = itemHealthId ? statuses[itemHealthId] : undefined
            return (
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
                  title={itemStatus?.label}
                >
                  <div className={styles.nestedIconWrap}>
                    <Icon className={styles.nestedIcon} />
                  </div>
                  <span className='truncate'>{name}</span>
                  <NavigationHealthDot status={itemStatus} />
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
            )
          })}
        </ul>
      </Visible>
    </li>
  )
}

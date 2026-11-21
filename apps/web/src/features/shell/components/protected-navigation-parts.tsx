import { useId } from 'react'
import { IconCirclePlus } from '@tabler/icons-react'
import Link from 'next/link'
import { DisclosureChevron } from '@/components/ui/disclosure'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { NavigationHealth, NavigationHealthHint } from './navigation-health'
import { NavigationHint } from './navigation-hint'
import { usePlatformHealth } from './platform-health-context'
import {
  hasChildWithSameHealth,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'
import { handleShellLink, type ShellNavigationHandler } from './shell-navigation-handler'

type NavLinkProps = {
  href: string
  label: string
  Icon: NavigationItem['Icon']
  healthId?: NavigationItem['healthId']
  shortcut?: NavigationItem['shortcut']
  isActive: boolean
  variant: NavigationVariant
  onNavigate?: ShellNavigationHandler
}

type SectionHeaderProps = {
  title: string
  variant: NavigationVariant
  actionHref?: string
  actionLabel?: string
  onNavigate?: ShellNavigationHandler
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
  onNavigate?: ShellNavigationHandler
}) => {
  const styles = variantStyles[variant]
  return (
    <NavigationHint label={label}>
      <Link
        href={href}
        className={cn(styles.sectionAction, className)}
        aria-label={label}
        onNavigate={handleShellLink(onNavigate, href, label)}
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

export const NavLink = ({ href, label, Icon, healthId, isActive, shortcut, variant, onNavigate }: NavLinkProps) => {
  const styles = variantStyles[variant]
  const statuses = usePlatformHealth()
  const status = healthId ? statuses[healthId] : undefined
  const compact = variant === 'rail'
  const link = (
    <Link
      href={href}
      className={cn(
        styles.item,
        compact && 'relative',
        isActive && styles.activeItem,
        shortcut && !compact && 'min-w-0 flex-1 pr-9 touch:pr-2'
      )}
      onNavigate={handleShellLink(onNavigate, href, label)}
      aria-current={isActive ? 'page' : undefined}
      aria-description={status?.label}
    >
      <div className={styles.iconWrap}>
        <Icon className={styles.icon} />
      </div>
      <span className={cn(styles.label, shortcut && !compact && 'truncate')}>{label}</span>
      <NavigationHealth
        status={status}
        compact={compact}
      />
    </Link>
  )

  return (
    <li className={shortcut ? cn('relative flex items-center', compact && 'flex-col') : undefined}>
      <NavigationHealthHint
        label={label}
        status={status}
        variant={variant}
      >
        {link}
      </NavigationHealthHint>
      {shortcut ? (
        <NavigationAddLink
          href={shortcut.href}
          label={shortcut.label}
          variant={variant}
          className={compact ? undefined : 'touch-control absolute right-2 size-6 touch:static'}
          onNavigate={onNavigate}
        />
      ) : null}
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
  onNavigate?: ShellNavigationHandler
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
    <DisclosureChevron
      open={isOpen}
      direction='right'
      className='size-3.5 shrink-0 text-foreground-muted'
    />
  )

  return (
    <li>
      {href ? (
        <div className='flex min-w-0'>
          <NavigationHealthHint
            label={label}
            status={status}
            variant={variant}
          >
            <Link
              href={href}
              className={cn(styles.item, 'min-w-0 flex-1', linkActive && styles.activeItem)}
              onNavigate={handleShellLink(onNavigate, href, label)}
              aria-current={linkActive ? 'page' : undefined}
              aria-description={status?.label}
            >
              {labelContent}
              <NavigationHealth status={status} />
            </Link>
          </NavigationHealthHint>
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
                <NavigationHealthHint
                  label={name}
                  status={itemStatus}
                  variant={variant}
                >
                  <Link
                    href={itemHref}
                    className={cn(
                      styles.nestedItem,
                      'flex-1',
                      shortcut && 'pr-9 touch:pr-2',
                      isActivePath(itemHref) && styles.nestedActiveItem
                    )}
                    onNavigate={handleShellLink(onNavigate, itemHref, name)}
                    aria-current={isActivePath(itemHref) ? 'page' : undefined}
                    aria-description={itemStatus?.label}
                  >
                    <div className={styles.nestedIconWrap}>
                      <Icon className={styles.nestedIcon} />
                    </div>
                    <span className='truncate'>{name}</span>
                    <NavigationHealth status={itemStatus} />
                  </Link>
                </NavigationHealthHint>
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

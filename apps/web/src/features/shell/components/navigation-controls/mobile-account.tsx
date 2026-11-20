'use client'

import { useId } from 'react'
import { IconCheck, IconChevronRight, IconLogout } from '@tabler/icons-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { variantStyles } from '../protected-navigation-config'
import { AccountAvatar, accountDestinations } from './account-details'
import { AccountThemeSwatch, accountThemeOptions } from './account-theme'
import type { ShellUser } from '../shell-user'

const styles = variantStyles.drawer

export const MobileAccount = ({
  user,
  pathname,
  onNavigate
}: {
  user: ShellUser
  pathname: string
  onNavigate: () => void
}) => {
  const { setTheme, theme } = useTheme()
  const themeInputName = useId()

  return (
    <section
      aria-label='Account'
      className='px-4 pt-1 pb-4'
    >
      <p className='flex min-h-12 min-w-0 items-center gap-2 px-2 pb-1 text-sm font-medium'>
        <span className={styles.iconWrap}>
          <AccountAvatar user={user} />
        </span>
        <span className='min-w-0 truncate'>{user.name || 'Account'}</span>
      </p>
      <ul className='flex flex-col'>
        {accountDestinations.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(styles.item, focusRingClassName, pathname === href && styles.activeItem)}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={onNavigate}
            >
              <span className={cn(styles.iconWrap, 'text-foreground-muted')}>
                <Icon
                  className={styles.icon}
                  aria-hidden='true'
                />
              </span>
              {label}
              <IconChevronRight
                aria-hidden='true'
                className='ml-auto size-4 shrink-0 text-foreground-muted'
              />
            </Link>
          </li>
        ))}
        <li className='px-1 pt-2 pb-3'>
          <fieldset className='min-w-0'>
            <legend className='px-1 pb-2 text-sm font-medium'>Theme</legend>
            <div className='grid grid-cols-2 gap-1'>
              {accountThemeOptions.map(({ value, label }) => (
                <label
                  key={value}
                  className='group flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-control bg-control px-2.5 text-sm text-foreground hover:bg-control-hover has-checked:bg-primary/14 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40'
                >
                  <input
                    className='sr-only'
                    type='radio'
                    name={themeInputName}
                    value={value}
                    checked={(theme ?? 'dark') === value}
                    onChange={() => setTheme(value)}
                  />
                  <AccountThemeSwatch theme={value} />
                  {label}
                  <IconCheck
                    aria-hidden='true'
                    className='invisible ml-auto size-4 shrink-0 text-primary group-has-checked:visible'
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </li>
        <li className='border-t border-surface-border/50 pt-1'>
          <button
            type='button'
            className={cn(styles.item, focusRingClassName, 'w-full text-left')}
            onClick={() => void signOut({ redirect: true })}
          >
            <span className={cn(styles.iconWrap, 'text-foreground-muted')}>
              <IconLogout
                aria-hidden='true'
                className={styles.icon}
              />
            </span>
            Log out
          </button>
        </li>
      </ul>
    </section>
  )
}

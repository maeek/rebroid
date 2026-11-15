'use client'

import { useId } from 'react'
import { IconLogout, IconSunMoon } from '@tabler/icons-react'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { focusRingClassName } from '@/components/ui/surface'
import { appThemeOptions } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'
import { variantStyles } from '../protected-navigation-config'
import { NavLink } from '../protected-navigation-parts'
import { AccountAvatar, accountDestinations } from './account-details'
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
      className='px-4 pb-4'
    >
      <h3 className='flex min-w-0 items-center gap-2 px-2 pb-2 text-sm font-medium'>
        <span className={styles.iconWrap}>
          <AccountAvatar user={user} />
        </span>
        <span className='min-w-0 truncate'>{user.name || 'Account'}</span>
      </h3>
      <ul className='flex flex-col'>
        {accountDestinations.map(destination => (
          <NavLink
            key={destination.href}
            {...destination}
            isActive={pathname === destination.href}
            variant='drawer'
            onNavigate={onNavigate}
          />
        ))}
        <li className='px-2 pb-2'>
          <fieldset className='min-w-0'>
            <legend className='py-2'>
              <span className='flex items-center gap-2'>
                <span className={styles.iconWrap}>
                  <IconSunMoon
                    aria-hidden='true'
                    className={styles.icon}
                  />
                </span>
                Appearance
              </span>
            </legend>
            <div className='grid grid-cols-4 gap-0.5 rounded-control bg-surface-editor p-1'>
              {appThemeOptions.map(({ value, label, Icon }) => (
                <label
                  key={value}
                  className='flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control text-xs text-foreground-muted hover:bg-control-hover has-checked:bg-control has-checked:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40'
                >
                  <input
                    className='sr-only'
                    type='radio'
                    name={themeInputName}
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <Icon
                    aria-hidden='true'
                    className='size-4'
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </li>
        <li>
          <button
            type='button'
            className={cn(styles.item, focusRingClassName, 'w-full text-left')}
            onClick={() => void signOut({ redirect: true })}
          >
            <span className={styles.iconWrap}>
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

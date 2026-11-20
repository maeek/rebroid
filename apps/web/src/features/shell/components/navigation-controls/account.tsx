'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { IconArrowLeft, IconChevronDown, IconChevronRight, IconLogout, IconSunMoon } from '@tabler/icons-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AccountAvatar, accountDestinations } from './account-details'
import { AccountThemeSwatch, accountThemeOptions } from './account-theme'
import type { NavigationPopupPosition } from './popup-position'
import type { ShellUser } from '../shell-user'

export const NavigationAccount = ({
  initialUser,
  popupPosition,
  showName = false
}: {
  initialUser: ShellUser
  popupPosition: NavigationPopupPosition
  showName?: boolean
}) => {
  const { theme, setTheme } = useTheme()
  const selectedTheme = accountThemeOptions.find(option => option.value === (theme ?? 'dark'))
  const [showTheme, setShowTheme] = useState(false)
  const accountTrigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const themeItem = useRef<HTMLDivElement>(null)
  const returnToThemeItem = useRef(false)
  const returnToAccountTrigger = useRef(false)

  const showAccountMenu = () => {
    returnToThemeItem.current = true
    setShowTheme(false)
  }

  useLayoutEffect(() => {
    if (!showTheme && !returnToThemeItem.current) return
    returnToThemeItem.current = false
    // Base UI registers the new items before focus can update its arrow-key position.
    const focusFrame = requestAnimationFrame(() => {
      const focusItem = showTheme
        ? (popup.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ??
          popup.current?.querySelector<HTMLElement>('[role="menuitemradio"]'))
        : themeItem.current
      focusItem?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [showTheme])

  return (
    <DropdownMenu
      onOpenChange={(open, details) => {
        if (open) {
          returnToAccountTrigger.current = false
          setShowTheme(false)
        } else if (details.reason === 'escape-key') {
          if (showTheme) {
            details.cancel()
            showAccountMenu()
          } else {
            returnToAccountTrigger.current = true
          }
        }
      }}
      onOpenChangeComplete={open => {
        if (!open && returnToAccountTrigger.current) {
          returnToAccountTrigger.current = false
          accountTrigger.current?.focus({ preventScroll: true })
        }
      }}
    >
      <DropdownMenuTrigger
        ref={accountTrigger}
        aria-label={showName && initialUser.name ? `Account: ${initialUser.name}` : 'Account'}
        className={cn(
          'group/account touch-control inline-flex h-10 shrink-0 items-center rounded-control text-foreground hover:bg-control-hover hover:text-foreground data-[popup-open]:bg-control-hover',
          showName ? 'w-full min-w-0 gap-2 px-2 text-left text-sm' : 'w-10 justify-center',
          focusRingClassName
        )}
      >
        <AccountAvatar user={initialUser} />
        {showName ? (
          <>
            <span className='min-w-0 flex-1 truncate'>{initialUser.name || 'Account'}</span>
            <IconChevronDown
              aria-hidden='true'
              className='size-3.5 shrink-0 text-foreground-muted motion-safe:transition-transform group-data-[popup-open]/account:rotate-180'
            />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        {...popupPosition}
        ref={popup}
        className={cn(
          'scrollbar-thin max-h-(--available-height) overflow-y-auto transform-gpu overscroll-contain border-0 bg-surface-elevated',
          showName ? 'w-(--anchor-width) min-w-0' : 'w-48'
        )}
        onKeyDown={event => {
          if (showTheme && event.key === 'ArrowLeft') {
            event.preventDefault()
            showAccountMenu()
          }
        }}
      >
        {showTheme ? (
          <>
            <DropdownMenuItem
              aria-label='Back to account menu'
              className='min-h-8'
              closeOnClick={false}
              onClick={showAccountMenu}
            >
              <IconArrowLeft className='size-3.5 text-foreground-muted' /> Theme
            </DropdownMenuItem>
            <DropdownMenuRadioGroup
              aria-label='Theme'
              value={selectedTheme?.value}
              onValueChange={value => {
                const pickedTheme = accountThemeOptions.find(option => option.value === value)
                if (pickedTheme) setTheme(pickedTheme.value)
              }}
            >
              {accountThemeOptions.map(({ value, label }) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  closeOnClick={false}
                  className='min-h-8'
                >
                  <AccountThemeSwatch theme={value} /> {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : (
          <>
            {accountDestinations.map(({ href, label, Icon }) => (
              <DropdownMenuItem
                asChild
                key={href}
              >
                <Link href={href}>
                  <Icon className='size-3.5 text-foreground-muted' /> {label}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              ref={themeItem}
              label='Theme'
              closeOnClick={false}
              onClick={() => setShowTheme(true)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  setShowTheme(true)
                }
              }}
            >
              <IconSunMoon className='size-3.5 text-foreground-muted' /> Theme
              <span className='ml-auto text-foreground-muted'>{selectedTheme?.label}</span>
              <IconChevronRight className='size-3.5 text-foreground-muted' />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ redirect: true })}>
              <IconLogout className='size-3.5 text-foreground-muted' /> Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

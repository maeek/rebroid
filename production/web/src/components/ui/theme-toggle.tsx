'use client'

import * as React from 'react'
import { IconMoon, IconSun, IconSunMoon } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {theme === 'light' ? (
          <IconSun className='mr-2 h-4 w-4' />
        ) : theme === 'dark' ? (
          <IconMoon className='mr-2 h-4 w-4' />
        ) : (
          <IconSunMoon className='mr-2 h-4 w-4' />
        )}
        <span>Theme</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <IconSun className='h-4 mr-2' /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <IconMoon className='h-4 mr-2' /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <IconSunMoon className='h-4 mr-2' /> System
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}

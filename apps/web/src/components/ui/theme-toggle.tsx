'use client'

import * as React from 'react'
import { IconDeviceMobile, IconMoon, IconSun, IconSunMoon } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Visible } from '@/components/ui/visible'

export type AppTheme = 'light' | 'dark' | 'oled' | 'system'

export const ThemeMenuItems = ({ onSelect }: { onSelect: (theme: AppTheme) => void }) => (
  <>
    <DropdownMenuItem onClick={() => onSelect('light')}>
      <IconSun className='h-4 mr-2' /> Light
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onSelect('dark')}>
      <IconMoon className='h-4 mr-2' /> Dark
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onSelect('oled')}>
      <IconDeviceMobile className='h-4 mr-2' /> OLED
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onSelect('system')}>
      <IconSunMoon className='h-4 mr-2' /> System
    </DropdownMenuItem>
  </>
)

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Visible when={theme === 'light'}>
          <IconSun className='mr-2 size-4' />
        </Visible>
        <Visible when={theme === 'dark'}>
          <IconMoon className='mr-2 size-4' />
        </Visible>
        <Visible when={theme === 'oled'}>
          <IconDeviceMobile className='mr-2 size-4' />
        </Visible>
        <Visible when={theme !== 'light' && theme !== 'dark' && theme !== 'oled'}>
          <IconSunMoon className='mr-2 size-4' />
        </Visible>
        <span>Theme</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <ThemeMenuItems onSelect={setTheme} />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}

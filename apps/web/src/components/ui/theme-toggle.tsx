'use client'

import { IconDeviceMobile, IconMoon, IconSun, IconSunMoon } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Visible } from '@/components/ui/visible'

export const appThemeOptions = [
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
  { value: 'oled', label: 'OLED', Icon: IconDeviceMobile },
  { value: 'system', label: 'System', Icon: IconSunMoon }
] as const

export const ThemeMenuItems = () => {
  const { setTheme, theme } = useTheme()
  return (
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={value => {
        const option = appThemeOptions.find(item => item.value === value)
        if (option) setTheme(option.value)
      }}
    >
      {appThemeOptions.map(({ value, label, Icon }) => (
        <DropdownMenuRadioItem
          key={value}
          value={value}
        >
          <Icon className='size-4' /> {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

export function ThemeToggle({ side }: { side?: 'left' | 'right' }) {
  const { theme } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger indicatorSide={side}>
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
        <DropdownMenuSubContent
          side={side}
          sideOffset={12}
          collisionPadding={8}
        >
          <ThemeMenuItems />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}

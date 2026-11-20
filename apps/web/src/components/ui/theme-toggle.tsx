'use client'

import { IconDeviceMobile, IconMoon, IconSun, IconSunMoon } from '@tabler/icons-react'
import { useTheme } from 'next-themes'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'

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
          <Icon className='size-3.5' /> {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

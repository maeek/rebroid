'use client'

import { useRef } from 'react'
import { IconSettings } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AppsListSortMode } from '@/shared/model/applications/app-sort'

const sortOptions = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'running-name', label: 'Running first' }
] as const

export const AppsGallerySortMenu = ({
  mode,
  onChange,
  disabled
}: {
  mode: AppsListSortMode
  onChange: (value: AppsListSortMode) => void
  disabled: boolean
}) => {
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            ref={trigger}
            asChild
          >
            <Button
              type='button'
              size='icon-md'
              variant='ghost'
              aria-label='Sort apps'
              disabled={disabled}
            >
              <IconSettings className='size-4' />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side='bottom'>Sort apps</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align='end'
        aria-label='Sort apps'
        finalFocus={trigger}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={value => {
              const choice = sortOptions.find(option => option.value === value)
              if (!choice) return
              onChange(choice.value)
              window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
            }}
          >
            {sortOptions.map(({ value, label }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
              >
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

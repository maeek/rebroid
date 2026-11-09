import { useRef } from 'react'
import { Menu } from '@base-ui/react/menu'
import { IconCheck, IconLayoutNavbar, IconLayoutSidebarRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { interactiveItemClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import {
  isViewerPlacement,
  viewerPlacementOptions,
  type ViewerPlacement
} from '@/shared/model/settings/viewer-placement'

const placementIcons = { right: IconLayoutSidebarRight, top: IconLayoutNavbar }

export const AppViewerPlacementMenu = ({
  placement,
  onPlacementChange,
  disabled
}: {
  placement: ViewerPlacement
  onPlacementChange: (placement: ViewerPlacement) => void
  disabled: boolean
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const initialScrollTop = useRef(0)
  const PlacementIcon = placementIcons[placement]

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={open => {
        if (open) initialScrollTop.current = window.scrollY
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type='button'
          size='icon-sm'
          variant='ghost'
          disabled={disabled}
          aria-label='Viewer layout'
          title='Viewer layout'
          className='size-7 shrink-0 translate-y-1'
        >
          <PlacementIcon className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <Menu.RadioGroup
          value={placement}
          onValueChange={(value: unknown) => {
            if (isViewerPlacement(value)) {
              onPlacementChange(value)
              window.requestAnimationFrame(() => {
                triggerRef.current?.focus({ preventScroll: true })
                window.scrollTo({ top: initialScrollTop.current, behavior: 'instant' })
              })
            }
          }}
        >
          {viewerPlacementOptions.map(({ value, label }) => (
            <Menu.RadioItem
              key={value}
              value={value}
              closeOnClick
              className={cn('flex cursor-default items-center gap-2 px-2 py-1.5 text-sm', interactiveItemClassName)}
            >
              {value === 'top' ? (
                <IconLayoutNavbar className='size-4' />
              ) : (
                <IconLayoutSidebarRight className='size-4' />
              )}
              <span className='flex-1'>{label}</span>
              <Menu.RadioItemIndicator
                keepMounted
                className='size-4 data-[unchecked]:invisible'
              >
                <IconCheck className='size-4' />
              </Menu.RadioItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

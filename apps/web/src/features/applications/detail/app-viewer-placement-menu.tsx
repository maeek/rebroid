import { useEffect, useEffectEvent, useRef } from 'react'
import { IconLayoutNavbar, IconLayoutSidebarRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  isViewerPlacement,
  viewerPlacementOptions,
  type ViewerPlacement
} from '@/shared/model/settings/viewer-placement'

const placementIcons = { right: IconLayoutSidebarRight, top: IconLayoutNavbar }
const shortcutKeys = ['Alt', 'Shift', 'L'] as const
const shortcutBlockedTargets =
  'input, textarea, select, iframe, [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"]'
const shortcutBlockingOverlay = ':is([role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"])[data-open]'

const isViewerLayoutShortcut = (event: KeyboardEvent) =>
  !event.defaultPrevented &&
  !event.repeat &&
  !event.isComposing &&
  event.altKey &&
  event.shiftKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.getModifierState('AltGraph') &&
  (event.key.toLowerCase() === 'l' || event.code === 'KeyL')

const LayoutShortcutKeys = () => {
  const isAppleKeyboard = /Mac|iPad|iPhone/.test(navigator.platform)
  return (
    <span className='flex items-center gap-1'>
      {shortcutKeys.map(key => (
        <kbd
          key={key}
          className='rounded-control border border-control-border bg-surface-band px-1.5 py-0.5 text-xs leading-none text-foreground-muted'
        >
          {key === 'Alt' && isAppleKeyboard ? 'Option' : key}
        </kbd>
      ))}
    </span>
  )
}

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

  const applyPlacement = (value: ViewerPlacement, scrollTop: number, restoreTriggerFocus = false) => {
    onPlacementChange(value)
    window.requestAnimationFrame(() => {
      if (restoreTriggerFocus) triggerRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: scrollTop, behavior: 'instant' })
    })
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || document.fullscreenElement || !isViewerLayoutShortcut(event)) return
    if (!window.matchMedia('(min-width: 64rem)').matches) return
    if (document.querySelector(shortcutBlockingOverlay)) return
    if (
      event
        .composedPath()
        .some(
          target =>
            target instanceof HTMLElement && (target.isContentEditable || target.matches(shortcutBlockedTargets))
        )
    ) {
      return
    }
    event.preventDefault()
    applyPlacement(placement === 'right' ? 'top' : 'right', window.scrollY)
  })

  useEffect(() => {
    if (disabled) return
    // Android keyboard capture gets first refusal in the capture phase.
    const onKeyDown = (event: KeyboardEvent) => handleShortcut(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled])

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={open => {
        if (open) initialScrollTop.current = window.scrollY
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              type='button'
              size='icon-sm'
              variant='ghost'
              disabled={disabled}
              aria-label='Viewer layout'
              aria-keyshortcuts={disabled ? undefined : shortcutKeys.join('+')}
              className='hidden size-7 shrink-0 lg:inline-flex'
            >
              <PlacementIcon className='size-4' />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side='bottom'
          align='end'
          className='hidden items-center gap-2.5 lg:flex'
        >
          <span>Switch viewer layout</span>
          <LayoutShortcutKeys />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align='end'
        className='max-lg:hidden'
      >
        <DropdownMenuRadioGroup
          value={placement}
          onValueChange={(value: unknown) => {
            if (isViewerPlacement(value)) {
              applyPlacement(value, initialScrollTop.current, true)
            }
          }}
        >
          {viewerPlacementOptions.map(({ value, label }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
            >
              {value === 'top' ? (
                <IconLayoutNavbar className='size-4' />
              ) : (
                <IconLayoutSidebarRight className='size-4' />
              )}
              <span className='flex-1'>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

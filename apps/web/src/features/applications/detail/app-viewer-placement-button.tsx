import { useEffect, useEffectEvent, useRef } from 'react'
import { IconLayoutNavbar, IconLayoutSidebarRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ViewerPlacement } from '@/shared/model/settings/viewer-placement'

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

export const AppViewerPlacementButton = ({
  placement,
  onPlacementChange,
  disabled
}: {
  placement: ViewerPlacement
  onPlacementChange: (placement: ViewerPlacement) => void
  disabled: boolean
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const PlacementIcon = placementIcons[placement]
  const nextPlacement = placement === 'right' ? 'top' : 'right'
  const label = nextPlacement === 'top' ? 'Move viewer to top' : 'Move viewer to the right'

  const switchPlacement = (restoreTriggerFocus = false) => {
    const scrollTop = window.scrollY
    onPlacementChange(nextPlacement)
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
    switchPlacement()
  })

  useEffect(() => {
    if (disabled) return
    // Android keyboard capture gets first refusal in the capture phase.
    const onKeyDown = (event: KeyboardEvent) => handleShortcut(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={triggerRef}
          type='button'
          size='icon-sm'
          variant='ghost'
          disabled={disabled}
          aria-label={label}
          aria-keyshortcuts={disabled ? undefined : shortcutKeys.join('+')}
          onClick={() => switchPlacement(true)}
          className='hidden size-7 shrink-0 lg:inline-flex'
        >
          <PlacementIcon className='size-4' />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        role='tooltip'
        side='bottom'
        align='end'
        className='hidden items-center gap-2.5 lg:flex'
      >
        <span>{label}</span>
        <LayoutShortcutKeys />
      </TooltipContent>
    </Tooltip>
  )
}

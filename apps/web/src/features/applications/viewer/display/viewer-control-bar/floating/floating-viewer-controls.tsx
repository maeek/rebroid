'use client'

import { useState } from 'react'
import { IconChevronDown, IconChevronUp, IconGripVertical } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { FullscreenButton } from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'
import { IconButtonTooltip } from '@/features/applications/viewer/display/viewer-control-bar/controls/icon-button-tooltip'
import { useViewerControlContext } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'
import { FloatingPrimaryControls } from './floating-primary-controls'
import { useFloatingToolbarDrag } from './use-floating-toolbar-drag'

const toolbarButtonClassName = 'size-(--viewer-chrome-height)'

export const FloatingViewerControls = () => {
  const { fullscreen, onToggleFullscreen } = useViewerControlContext()
  const [expanded, setExpanded] = useState(true)
  const { boundsRef, toolbarRef, position, dragHandle } = useFloatingToolbarDrag()
  const ToggleIcon = expanded ? IconChevronUp : IconChevronDown
  const toggleLabel = expanded ? 'Hide toolbar' : 'Show toolbar'

  return (
    <div
      ref={boundsRef}
      className='pointer-events-none absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-[calc(0.5rem+env(safe-area-inset-right))] bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-[calc(0.5rem+env(safe-area-inset-left))] z-30'
    >
      <Surface
        ref={toolbarRef}
        level='floating'
        role='group'
        aria-label='Fullscreen viewer controls'
        className='pointer-events-auto absolute flex max-h-full flex-col rounded-panel bg-surface-floating-control shadow-floating-control'
        style={{ left: position.x, top: position.y }}
      >
        <div className='flex shrink-0 items-center gap-1 p-1'>
          <IconButtonTooltip label='Move viewer toolbar'>
            <Button
              {...dragHandle}
              type='button'
              size='icon-md'
              variant='ghost'
              aria-label='Move viewer toolbar'
              aria-keyshortcuts='ArrowLeft ArrowRight ArrowUp ArrowDown'
              className={`${toolbarButtonClassName} touch-none cursor-grab select-none active:cursor-grabbing`}
              onContextMenu={event => event.preventDefault()}
            >
              <IconGripVertical aria-hidden />
            </Button>
          </IconButtonTooltip>
          <IconButtonTooltip label={toggleLabel}>
            <Button
              type='button'
              size='icon-md'
              variant='ghost'
              aria-label={toggleLabel}
              aria-expanded={expanded}
              className={toolbarButtonClassName}
              onClick={() => setExpanded(current => !current)}
            >
              <ToggleIcon aria-hidden />
            </Button>
          </IconButtonTooltip>
          <FullscreenButton
            className={toolbarButtonClassName}
            fullscreen={fullscreen}
            onToggleFullscreen={onToggleFullscreen}
          />
        </div>
        {expanded && <FloatingPrimaryControls buttonClassName={toolbarButtonClassName} />}
      </Surface>
    </div>
  )
}

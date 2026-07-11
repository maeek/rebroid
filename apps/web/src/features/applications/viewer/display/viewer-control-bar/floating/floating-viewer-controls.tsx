'use client'

import type { PointerEvent, ReactNode } from 'react'
import { IconChevronLeft, IconChevronRight, IconGripVertical, IconLayoutSidebarRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import {
  IconCommandGroup,
  navigationControls
} from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { IconButtonTooltip } from '@/features/applications/viewer/display/viewer-control-bar/controls/icon-button-tooltip'
import { FloatingPrimaryControls } from '@/features/applications/viewer/display/viewer-control-bar/floating/floating-primary-controls'
import { useViewerControlContext } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'
import { cn } from '@/lib/utils'
import type { FloatingPosition } from '@/features/applications/viewer/display/viewer-control-bar/types'

const FloatingToolbarHandle = ({
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu
}: {
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <button
    type='button'
    className='flex size-9 touch-none select-none items-center justify-center rounded-panel text-foreground-muted hover:bg-surface-band active:cursor-grabbing'
    aria-label='Move viewer toolbar'
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onContextMenu={onContextMenu}
  >
    <IconGripVertical className='size-4' />
  </button>
)

const FloatingToolbarToggle = ({
  label,
  variant,
  collapseTowardLeft,
  isCollapsing,
  onClick
}: {
  label: string
  variant: 'ghost' | 'secondary'
  collapseTowardLeft: boolean
  isCollapsing: boolean
  onClick: () => void
}) => {
  const Icon = collapseTowardLeft === isCollapsing ? IconChevronLeft : IconChevronRight

  return (
    <IconButtonTooltip label={label}>
      <Button
        size='icon-md'
        variant={variant}
        onClick={onClick}
        aria-label={label}
        className='size-9'
      >
        <Icon className='size-4' />
      </Button>
    </IconButtonTooltip>
  )
}

const FloatingToolbarShell = ({
  expanded = false,
  position,
  preventContextMenu,
  children
}: {
  expanded?: boolean
  position: FloatingPosition
  preventContextMenu: (event: { preventDefault: () => void }) => void
  children: ReactNode
}) => (
  <div
    className='absolute z-30'
    style={{ left: position.x, top: position.y }}
    onContextMenu={preventContextMenu}
  >
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-panel border border-surface-border/70 bg-surface-elevated/92 p-1 shadow-emphasis backdrop-blur-xl',
        expanded && 'scrollbar-thin max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto'
      )}
    >
      {children}
    </div>
  </div>
)

const FloatingNavigationToggle = ({
  floatingOpen,
  setFloatingOpen
}: {
  floatingOpen: boolean
  setFloatingOpen: (open: (current: boolean) => boolean) => void
}) => (
  <Button
    size='icon-md'
    variant={floatingOpen ? 'primary' : 'secondary'}
    onClick={() => setFloatingOpen(current => !current)}
    aria-label='Navigation controls'
    className='size-9'
  >
    <IconLayoutSidebarRight className='size-4' />
  </Button>
)

const CollapsedFloatingViewerControls = ({
  collapseTowardLeft,
  handle,
  preventContextMenu
}: {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => {
  const { floatingPosition, setFloatingCollapsed } = useViewerControlContext()

  return (
    <FloatingToolbarShell
      position={floatingPosition}
      preventContextMenu={preventContextMenu}
    >
      {handle}
      <FloatingToolbarToggle
        label='Show toolbar'
        variant='secondary'
        collapseTowardLeft={collapseTowardLeft}
        isCollapsing={false}
        onClick={() => setFloatingCollapsed(false)}
      />
    </FloatingToolbarShell>
  )
}

const ExpandedFloatingViewerControls = ({
  collapseTowardLeft,
  handle,
  preventContextMenu
}: {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => {
  const {
    controlsDisabled,
    controlIcon,
    floatingOpen,
    floatingPosition,
    sendControl,
    setFloatingCollapsed,
    setFloatingOpen
  } = useViewerControlContext()

  return (
    <FloatingToolbarShell
      expanded
      position={floatingPosition}
      preventContextMenu={preventContextMenu}
    >
      {handle}
      <FloatingToolbarToggle
        label='Hide toolbar'
        variant='ghost'
        collapseTowardLeft={collapseTowardLeft}
        isCollapsing
        onClick={() => setFloatingCollapsed(true)}
      />
      <FloatingPrimaryControls />
      <FloatingNavigationToggle
        floatingOpen={floatingOpen}
        setFloatingOpen={setFloatingOpen}
      />
      <Visible when={floatingOpen}>
        <IconCommandGroup
          className='mt-1 flex flex-col items-center gap-1 border-t border-surface-border/60 pt-1'
          controls={navigationControls}
          controlsDisabled={controlsDisabled}
          controlIcon={controlIcon}
          sendControl={sendControl}
        />
      </Visible>
    </FloatingToolbarShell>
  )
}

export const FloatingViewerControls = () => {
  const { floatingCollapsed, floatingPosition, onFloatingPointerDown, onFloatingPointerMove, onFloatingPointerUp } =
    useViewerControlContext()
  const collapseTowardLeft = floatingPosition.x < 160
  const preventContextMenu = (event: { preventDefault: () => void }) => event.preventDefault()
  const handle = (
    <FloatingToolbarHandle
      onPointerDown={onFloatingPointerDown}
      onPointerMove={onFloatingPointerMove}
      onPointerUp={onFloatingPointerUp}
      onPointerCancel={onFloatingPointerUp}
      onContextMenu={preventContextMenu}
    />
  )

  if (floatingCollapsed) {
    return (
      <CollapsedFloatingViewerControls
        collapseTowardLeft={collapseTowardLeft}
        handle={handle}
        preventContextMenu={preventContextMenu}
      />
    )
  }

  return (
    <ExpandedFloatingViewerControls
      collapseTowardLeft={collapseTowardLeft}
      handle={handle}
      preventContextMenu={preventContextMenu}
    />
  )
}

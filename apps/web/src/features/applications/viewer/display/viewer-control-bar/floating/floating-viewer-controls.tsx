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
import { cn } from '@/lib/utils'
import type {
  FloatingToolbarRenderProps,
  FloatingViewerControlsProps,
  FloatingPosition
} from '@/features/applications/viewer/display/viewer-control-bar/types'

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
    className='flex size-9 touch-none select-none items-center justify-center rounded-lg text-secondary-foreground hover:bg-secondary active:cursor-grabbing'
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
        size='icon'
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
        'flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/90 p-1 shadow-2xl backdrop-blur-xl',
        expanded && 'max-h-[calc(100dvh-1rem)] overflow-y-auto'
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
    size='icon'
    variant={floatingOpen ? 'default' : 'secondary'}
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
  position,
  preventContextMenu,
  setCollapsed
}: Pick<FloatingToolbarRenderProps, 'position' | 'setCollapsed'> & {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <FloatingToolbarShell
    position={position}
    preventContextMenu={preventContextMenu}
  >
    {handle}
    <FloatingToolbarToggle
      label='Show toolbar'
      variant='secondary'
      collapseTowardLeft={collapseTowardLeft}
      isCollapsing={false}
      onClick={() => setCollapsed(false)}
    />
  </FloatingToolbarShell>
)

const ExpandedFloatingViewerControls = ({
  collapseTowardLeft,
  controlIcon,
  controlsDisabled,
  floatingOpen,
  handle,
  position,
  preventContextMenu,
  renderPrimaryControls,
  sendControl,
  setCollapsed,
  setFloatingOpen
}: FloatingToolbarRenderProps & {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <FloatingToolbarShell
    expanded
    position={position}
    preventContextMenu={preventContextMenu}
  >
    {handle}
    <FloatingToolbarToggle
      label='Hide toolbar'
      variant='ghost'
      collapseTowardLeft={collapseTowardLeft}
      isCollapsing
      onClick={() => setCollapsed(true)}
    />
    {renderPrimaryControls}
    <FloatingNavigationToggle
      floatingOpen={floatingOpen}
      setFloatingOpen={setFloatingOpen}
    />
    <Visible when={floatingOpen}>
      <IconCommandGroup
        className='mt-1 flex flex-col items-center gap-1 border-t border-border/60 pt-1'
        controls={navigationControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
    </Visible>
  </FloatingToolbarShell>
)

export const FloatingViewerControls = ({
  collapsed,
  controlIcon,
  controlsDisabled,
  floatingOpen,
  position,
  renderPrimaryControls,
  sendControl,
  setCollapsed,
  setFloatingOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: FloatingViewerControlsProps) => {
  const collapseTowardLeft = position.x < 160
  const preventContextMenu = (event: { preventDefault: () => void }) => event.preventDefault()
  const handle = (
    <FloatingToolbarHandle
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={preventContextMenu}
    />
  )

  if (collapsed) {
    return (
      <CollapsedFloatingViewerControls
        collapseTowardLeft={collapseTowardLeft}
        handle={handle}
        position={position}
        preventContextMenu={preventContextMenu}
        setCollapsed={setCollapsed}
      />
    )
  }

  return (
    <ExpandedFloatingViewerControls
      collapseTowardLeft={collapseTowardLeft}
      controlIcon={controlIcon}
      controlsDisabled={controlsDisabled}
      floatingOpen={floatingOpen}
      handle={handle}
      position={position}
      preventContextMenu={preventContextMenu}
      renderPrimaryControls={renderPrimaryControls}
      sendControl={sendControl}
      setCollapsed={setCollapsed}
      setFloatingOpen={setFloatingOpen}
    />
  )
}

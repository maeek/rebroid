'use client'

import { useCallback, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { IconArrowsMinimize, IconGripVertical, IconPictureInPictureOff, IconX } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ViewerActionBar } from '@/features/applications/viewer/components/viewer-action-bar'
import { cn } from '@/lib/utils'
import { fitMiniPlayer, miniPlayerToolbarSpace, miniPlayerToolbarWidth } from './mini-player-geometry'
import { useMiniPlayerPosition } from './use-mini-player-position'
import { useMiniPlayerResize } from './use-mini-player-resize'
import { useMiniPlayerViewport } from './use-mini-player-viewport'

const headerButtonClassName = 'size-6 [&_svg]:size-3.5'

type DesktopMiniPlayerProps = {
  name: string
  expanded: boolean
  canExpand: boolean
  aspectRatio?: number
  expandedActions?: ReactNode
  expandedToolbar?: ReactNode
  inlineStyle?: CSSProperties
  inlineOverlay?: ReactNode
  onElement?: (element: HTMLDivElement | null) => void
  restoreLabel?: string
  onRestoreInline?: () => void
  viewerHref: string
  onExpandedChange: (expanded: boolean) => void
  onOpenViewer?: () => void
  onClose: () => void
  children: ReactNode
}

export const DesktopMiniPlayer = ({
  name,
  expanded,
  canExpand,
  aspectRatio = 9 / 16,
  expandedActions,
  expandedToolbar,
  inlineStyle,
  inlineOverlay,
  onElement,
  restoreLabel = 'Open viewer',
  onRestoreInline,
  viewerHref,
  onExpandedChange,
  onOpenViewer,
  onClose,
  children
}: DesktopMiniPlayerProps) => {
  const playerRef = useRef<HTMLDivElement>(null)
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16
  const viewport = useMiniPlayerViewport(!inlineStyle)
  const toolbarSpace = expanded && expandedToolbar ? miniPlayerToolbarSpace * (viewport.rem / 16) : 0
  const resize = useMiniPlayerResize(playerRef, ratio, toolbarSpace, viewport)
  const size = fitMiniPlayer({
    viewport,
    ratio,
    expanded,
    preferredWidth: expanded ? resize.preferredExpandedWidth : undefined,
    toolbarSpace,
    rem: viewport.rem
  })
  const { positionStyle, dragging, dragHandle, dragSurface, wasDragged, toolbarSide } = useMiniPlayerPosition(
    playerRef,
    size,
    viewport,
    toolbarSpace
  )
  const setPlayerElement = useCallback(
    (element: HTMLDivElement | null) => {
      playerRef.current = element
      onElement?.(element)
    },
    [onElement, playerRef]
  )
  const instructionsId = useId()
  const resizeInstructionsId = useId()
  const style = inlineStyle ?? { width: size.width, height: size.height, rowGap: size.headerGap, ...positionStyle }
  const compact = !inlineStyle && !expanded
  const compactLabel = canExpand ? 'Expand mini-player' : 'Move mini-player'
  const resizeRight = toolbarSide === 'right'
  const resizeBottom = positionStyle.top + size.height / 2 < viewport.height / 2

  return (
    <Surface
      ref={setPlayerElement}
      level='floating'
      role='region'
      aria-label={inlineStyle ? `${name} display` : `${name} mini-player`}
      className={cn(
        'group/mini fixed flex-col border-0 bg-transparent shadow-none',
        inlineStyle ? 'flex overflow-hidden fullscreen:rounded-none' : 'z-40 flex overflow-visible'
      )}
      style={style}
    >
      <div
        {...(compact ? dragSurface : undefined)}
        role={compact ? 'button' : undefined}
        tabIndex={compact ? 0 : undefined}
        aria-label={compact ? compactLabel : undefined}
        onClick={
          compact && canExpand
            ? () => {
                if (!wasDragged()) onExpandedChange(true)
              }
            : undefined
        }
        onKeyDown={
          compact
            ? event => {
                if (canExpand && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onExpandedChange(true)
                }
              }
            : undefined
        }
        className={cn(
          'relative min-h-0 w-full overflow-hidden bg-black',
          inlineStyle ? 'h-full flex-1' : 'rounded-overlay shadow-floating',
          compact && 'touch-none select-none cursor-grab focus-visible:outline-2 focus-visible:outline-ring',
          compact && dragging && 'cursor-grabbing'
        )}
        style={inlineStyle ? undefined : { height: size.videoHeight, aspectRatio: ratio }}
      >
        <div
          inert={compact}
          className={cn('absolute inset-0', compact && 'pointer-events-none')}
        >
          {children}
        </div>
      </div>
      <ViewerActionBar
        role='group'
        aria-label='Mini-player controls'
        hidden={Boolean(inlineStyle)}
        className={cn(
          'gap-0.5 px-0.5 transition-opacity duration-150 motion-reduce:transition-none',
          compact && 'order-first bg-surface-floating-control shadow-floating-control',
          compact &&
            !dragging &&
            'pointer-events-none opacity-0 group-hover/mini:pointer-events-auto group-hover/mini:opacity-100 group-has-[:focus-visible]/mini:pointer-events-auto group-has-[:focus-visible]/mini:opacity-100',
          inlineStyle ? 'hidden' : 'flex'
        )}
        style={{ height: size.headerHeight }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              {...dragHandle}
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label='Move mini-player'
              aria-describedby={instructionsId}
              aria-keyshortcuts='ArrowLeft ArrowRight ArrowUp ArrowDown'
              className={cn(headerButtonClassName, 'touch-none cursor-grab', dragging && 'cursor-grabbing')}
            >
              <IconGripVertical aria-hidden='true' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move mini-player</TooltipContent>
        </Tooltip>
        <span
          id={instructionsId}
          className='sr-only'
        >
          Use the arrow keys to move the mini-player.
        </span>
        <div
          {...dragSurface}
          className={cn(
            'mr-auto flex min-w-0 flex-1 touch-none select-none items-center gap-1 overflow-hidden',
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          <span
            className='truncate text-xs font-medium'
            title={name}
          >
            {name}
          </span>
        </div>
        {!inlineStyle && expanded && expandedActions}
        {!inlineStyle && expanded && (
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Collapse mini-player'
            title='Collapse mini-player'
            onClick={() => onExpandedChange(false)}
            className={headerButtonClassName}
          >
            <IconArrowsMinimize aria-hidden='true' />
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            {onRestoreInline ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className={headerButtonClassName}
                aria-label={restoreLabel}
                onClick={onRestoreInline}
              >
                <IconPictureInPictureOff aria-hidden='true' />
              </Button>
            ) : (
              <Button
                asChild
                variant='ghost'
                size='icon-sm'
                className={headerButtonClassName}
              >
                <Link
                  href={viewerHref}
                  prefetch={false}
                  onNavigate={onOpenViewer}
                  aria-label={restoreLabel}
                >
                  <IconPictureInPictureOff aria-hidden='true' />
                </Link>
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>{restoreLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={headerButtonClassName}
              aria-label='Close mini-player'
              onClick={onClose}
            >
              <IconX aria-hidden='true' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close mini-player</TooltipContent>
        </Tooltip>
      </ViewerActionBar>
      {!inlineStyle && expanded && (
        <>
          <span
            id={resizeInstructionsId}
            className='sr-only'
          >
            Drag to resize. Use arrow keys to grow or shrink the player.
          </span>
          <button
            {...resize.handle}
            type='button'
            aria-label='Resize mini-player'
            aria-describedby={resizeInstructionsId}
            onPointerDown={event => resize.start(event, resizeRight, resizeBottom)}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 20%, 20% 20%, 20% 100%, 0 100%)' }}
            className={cn(
              'absolute z-10 size-10 touch-none bg-transparent text-foreground-muted before:pointer-events-none before:absolute before:top-1 before:left-1 before:size-3.5 before:rounded-tl-sm before:border-t-2 before:border-l-2 before:border-current hover:text-foreground focus-visible:text-ring',
              resizeRight ? '-right-2 -scale-x-100' : '-left-2',
              resizeBottom ? '-bottom-2 -scale-y-100' : '-top-2',
              resizeRight === resizeBottom ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
            )}
          />
        </>
      )}
      {!inlineStyle && expanded && expandedToolbar && (
        <div
          data-toolbar-side={toolbarSide}
          style={{ width: miniPlayerToolbarWidth * (viewport.rem / 16), maxHeight: size.height }}
          className={cn(
            'absolute top-0 max-h-full overflow-y-auto scrollbar-none',
            toolbarSide === 'left' ? 'right-full mr-2' : 'left-full ml-2'
          )}
        >
          {expandedToolbar}
        </div>
      )}
      {inlineStyle && inlineOverlay}
    </Surface>
  )
}

'use client'

import { useRef, type ReactElement, type ReactNode } from 'react'
import { IconCheck, IconCopy, IconDotsVertical, IconListCheck, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { focusRingClassName, panelSurfaceClassName } from '@/components/ui/surface'
import { useOpenAppAsMe } from '@/hooks/use-open-app-as-me'
import { cn } from '@/lib/utils'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { AppGalleryTile, type AppGalleryCardData } from './app-gallery-tile'

const actionPosition = 'absolute right-2 top-1/2 -translate-y-1/2'

type CardSelection = {
  selected: boolean
  onToggle: () => void
}

const AppGallerySelection = ({
  app,
  label,
  disabled,
  selection,
  bindButton
}: {
  app: AppGalleryCardData
  label: string
  disabled: boolean
  selection: CardSelection
  bindButton: (button: HTMLButtonElement | null) => void
}) => (
  <button
    type='button'
    aria-label={`Select ${label}`}
    aria-pressed={selection.selected}
    ref={bindButton}
    disabled={disabled}
    onClick={selection.onToggle}
    className={cn(focusRingClassName, 'block w-full rounded-panel hover:bg-foreground/5')}
  >
    <span
      className={cn(actionPosition, 'touch-control flex size-8 items-center justify-center')}
      aria-hidden='true'
    >
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full border border-control-border-strong bg-control text-foreground-muted',
          selection.selected && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        {selection.selected ? <IconCheck className='size-3' /> : null}
      </span>
    </span>
    <AppGalleryTile app={app} />
  </button>
)

const AppGalleryLink = ({
  app,
  label,
  menuTrigger,
  onSelect,
  disabled,
  actions
}: {
  app: AppGalleryCardData
  label: string
  menuTrigger: ReactElement
  onSelect?: () => void
  disabled: boolean
  actions?: ReactNode
}) => {
  const contextOpen = useRef(false)
  const { isCloning, openAppAsMe } = useOpenAppAsMe()
  const menuLabel = `Actions for ${label}`
  const items = (
    <>
      {onSelect ? (
        <>
          <DropdownMenuItem
            className='gap-2'
            onClick={onSelect}
          >
            <IconListCheck className='size-4' /> Select app
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}
      {app.canClone ? (
        <DropdownMenuItem
          className='gap-2'
          disabled={isCloning}
          onSelect={() => void openAppAsMe(app.id)}
        >
          <IconCopy className='size-4' /> Open as me
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        asChild
        className='gap-2'
      >
        <Link href={appResourceHref(app.id, 'configuration')}>
          <IconSettings className='size-4' /> Configuration
        </Link>
      </DropdownMenuItem>
      {actions}
    </>
  )

  return (
    <>
      <ContextMenu
        disabled={disabled}
        onOpenChange={open => {
          contextOpen.current = open
        }}
      >
        <ContextMenuTrigger asChild>
          <Link
            href={appResourceHref(app.id)}
            aria-label={`${app.ownerDisplayName ? 'View' : 'Open'} ${label}`}
            onClick={event => {
              if (contextOpen.current) event.preventDefault()
            }}
            className={cn(
              focusRingClassName,
              'block rounded-panel transition-colors hover:bg-surface-band touch:select-none'
            )}
          >
            <AppGalleryTile app={app} />
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label={menuLabel}>{items}</ContextMenuContent>
      </ContextMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{menuTrigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          aria-label={menuLabel}
        >
          {items}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export const AppGalleryCard = ({
  app,
  disabled = false,
  selection,
  onSelect,
  actions
}: {
  app?: AppGalleryCardData
  disabled?: boolean
  selection?: CardSelection
  onSelect?: () => void
  actions?: ReactNode
}) => {
  const focusSelection = useRef(false)
  const label = app?.ownerDisplayName ? `${app.name} · ${app.ownerDisplayName}` : (app?.name ?? '')
  const menuTrigger = (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      className={actionPosition}
      aria-label={app ? `Actions for ${label}` : 'Loading app actions'}
      disabled={disabled || !app}
    >
      <IconDotsVertical className='size-4' />
    </Button>
  )

  let content = (
    <>
      <AppGalleryTile />
      {menuTrigger}
    </>
  )
  if (app && selection) {
    content = (
      <AppGallerySelection
        app={app}
        label={label}
        disabled={disabled}
        selection={selection}
        bindButton={button => {
          if (button && focusSelection.current) {
            focusSelection.current = false
            button.focus({ preventScroll: true })
          }
        }}
      />
    )
  } else if (app) {
    content = (
      <AppGalleryLink
        app={app}
        label={label}
        menuTrigger={menuTrigger}
        disabled={disabled}
        onSelect={
          onSelect &&
          (() => {
            focusSelection.current = true
            onSelect()
          })
        }
        actions={actions}
      />
    )
  }

  return (
    <li
      className={cn(panelSurfaceClassName, 'relative min-w-0', selection?.selected && 'bg-accent')}
      data-app-tile={app?.id}
    >
      {content}
    </li>
  )
}

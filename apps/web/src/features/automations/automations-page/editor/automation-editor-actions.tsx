'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
  IconAdjustments,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconHistory,
  IconTrash,
  IconUpload
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MutationButton } from '@/components/ui/mutation-button'
import { useDesktopViewport } from '@/hooks/use-desktop-viewport'
import { cn } from '@/lib/utils'
import { compactPageActionClassName } from '@/shared/ui/page/page-header'

export const AutomationEditorActions = ({
  busy,
  details,
  saving = false,
  saved = false,
  canSaveOrExport,
  canDraftFromPrompt,
  canDelete,
  yamlOpen,
  onDelete,
  onDraftFromPrompt,
  onExport,
  onImport,
  onRunHistory,
  onSave,
  onToggleYaml
}: {
  busy: boolean
  details?: ReactNode
  saving?: boolean
  saved?: boolean
  canSaveOrExport: boolean
  canDraftFromPrompt: boolean
  canDelete: boolean
  yamlOpen: boolean
  onDelete: () => void
  onDraftFromPrompt: () => void
  onExport: () => void
  onImport: () => void
  onRunHistory?: () => void
  onSave: () => void
  onToggleYaml: () => void
}) => {
  const isDesktop = useDesktopViewport()
  const editorMode = yamlOpen ? 'yaml' : 'visual'
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const pendingMenuAction = useRef<(() => void) | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <>
      {canDraftFromPrompt ? (
        <Button
          type='button'
          variant='secondary'
          className='max-lg:hidden'
          disabled={busy}
          aria-label='Draft workflow from prompt'
          onClick={onDraftFromPrompt}
        >
          <GradientSparklesIcon className='size-4' />
          Draft with AI
        </Button>
      ) : null}
      <MutationButton
        data-workflow-save=''
        className={cn('max-lg:h-11', compactPageActionClassName)}
        pending={saving}
        pendingLabel='Saving…'
        success={saved}
        disabled={busy || !canSaveOrExport}
        onClick={onSave}
      >
        <IconDeviceFloppy
          aria-hidden
          className='size-4'
        />
        Save
      </MutationButton>
      <DropdownMenu
        onOpenChangeComplete={open => {
          if (open) return
          const action = pendingMenuAction.current
          pendingMenuAction.current = null
          action?.()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            type='button'
            data-workflow-more=''
            variant='secondary'
            size='icon-md'
            className='max-lg:size-11'
            disabled={busy}
            aria-label='More workflow actions'
          >
            <IconDotsVertical
              aria-hidden
              className='size-4'
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='scrollbar-thin max-h-(--available-height) min-w-44 overflow-y-auto transform-gpu overscroll-contain p-2'
        >
          {isDesktop === false ? (
            <>
              <DropdownMenuRadioGroup
                aria-label='Editor mode'
                value={editorMode}
                onValueChange={value => {
                  pendingMenuAction.current = () => {
                    menuTriggerRef.current?.focus({ preventScroll: true })
                    if (value !== editorMode) onToggleYaml()
                  }
                }}
              >
                <DropdownMenuRadioItem
                  className='gap-2 px-3 py-2'
                  value='visual'
                >
                  Visual editor
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  className='gap-2 px-3 py-2'
                  value='yaml'
                >
                  YAML
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {canDraftFromPrompt ? (
                <DropdownMenuItem
                  disabled={busy}
                  className='gap-2 px-3 py-2'
                  onSelect={() => {
                    pendingMenuAction.current = onDraftFromPrompt
                  }}
                >
                  <GradientSparklesIcon className='size-4' />
                  Draft with AI
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          <DropdownMenuItem
            disabled={busy || yamlOpen}
            className='gap-2 px-3 py-2'
            onSelect={() => {
              pendingMenuAction.current = () => setDetailsOpen(true)
            }}
          >
            <IconAdjustments className='size-4' />
            Workflow details
          </DropdownMenuItem>
          {onRunHistory ? (
            <DropdownMenuItem
              className='gap-2 px-3 py-2'
              onSelect={() => {
                pendingMenuAction.current = onRunHistory
              }}
            >
              <IconHistory className='size-4' />
              Run history
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busy}
            className='gap-2 px-3 py-2'
            onSelect={onImport}
          >
            <IconUpload className='size-4' />
            Import workflow
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || !canSaveOrExport}
            className='gap-2 px-3 py-2'
            onSelect={onExport}
          >
            <IconDownload className='size-4' />
            Export workflow
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={busy}
                className='gap-2 px-3 py-2 text-danger'
                onSelect={() => {
                  pendingMenuAction.current = onDelete
                }}
              >
                <IconTrash className='size-4' />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {details ? (
        <Dialog
          open={detailsOpen && !busy && !yamlOpen}
          onOpenChange={setDetailsOpen}
        >
          <DialogContent
            data-editor-dialog=''
            finalFocus={menuTriggerRef}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>Workflow details</DialogTitle>
              <DialogDescription>Changes are saved when you save the workflow.</DialogDescription>
            </DialogHeader>
            {details}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type='button'
                  variant='secondary'
                >
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

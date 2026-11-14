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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MutationButton } from '@/components/ui/mutation-button'

export const AutomationEditorActions = ({
  busy,
  details,
  saving = false,
  saved = false,
  hasBrokenReferences = false,
  canDraftFromPrompt,
  canDelete,
  yamlOpen,
  yamlValid,
  onDelete,
  onDraftFromPrompt,
  onExport,
  onImport,
  onRunHistory,
  onSave
}: {
  busy: boolean
  details?: ReactNode
  saving?: boolean
  saved?: boolean
  hasBrokenReferences?: boolean
  canDraftFromPrompt: boolean
  canDelete: boolean
  yamlOpen: boolean
  yamlValid: boolean
  onDelete: () => void
  onDraftFromPrompt: () => void
  onExport: () => void
  onImport: () => void
  onRunHistory?: () => void
  onSave: () => void
}) => {
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const pendingMenuAction = useRef<(() => void) | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <>
      {canDraftFromPrompt ? (
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          aria-label='Draft workflow from prompt'
          onClick={onDraftFromPrompt}
        >
          <GradientSparklesIcon className='size-4' />
          Draft with AI
        </Button>
      ) : null}
      <MutationButton
        pending={saving}
        pendingLabel='Saving…'
        success={saved}
        disabled={busy || hasBrokenReferences || (yamlOpen && !yamlValid)}
        onClick={onSave}
      >
        <IconDeviceFloppy className='size-4' />
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
            variant='secondary'
            size='icon-md'
            disabled={busy}
            aria-label='More workflow actions'
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='min-w-44 p-2'
        >
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
            disabled={busy || (yamlOpen && !yamlValid)}
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

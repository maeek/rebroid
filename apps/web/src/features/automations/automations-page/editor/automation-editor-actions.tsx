import { IconDeviceFloppy, IconDotsVertical, IconDownload, IconTrash, IconUpload } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
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
  saving = false,
  saved = false,
  canDraftFromPrompt,
  canDelete,
  yamlOpen,
  yamlValid,
  onDelete,
  onDraftFromPrompt,
  onExport,
  onImport,
  onSave
}: {
  busy: boolean
  saving?: boolean
  saved?: boolean
  canDraftFromPrompt: boolean
  canDelete: boolean
  yamlOpen: boolean
  yamlValid: boolean
  onDelete: () => void
  onDraftFromPrompt: () => void
  onExport: () => void
  onImport: () => void
  onSave: () => void
}) => (
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
      disabled={busy || (yamlOpen && !yamlValid)}
      onClick={onSave}
    >
      <IconDeviceFloppy className='size-4' />
      Save
    </MutationButton>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
              onSelect={onDelete}
            >
              <IconTrash className='size-4' />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  </>
)

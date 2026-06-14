import {
  IconActivityHeartbeat,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFileCode,
  IconTrash,
  IconUpload
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export const AutomationEditorHeader = ({
  title,
  busy,
  canDraftFromPrompt,
  canDelete,
  yamlOpen,
  yamlValid,
  onDelete,
  onDraftFromPrompt,
  onExport,
  onImport,
  onSave,
  onShowTraces,
  onToggleYaml
}: {
  title: string
  busy: boolean
  canDraftFromPrompt: boolean
  canDelete: boolean
  yamlOpen: boolean
  yamlValid: boolean
  onDelete: () => void
  onDraftFromPrompt: () => void
  onExport: () => void
  onImport: () => void
  onSave: () => void
  onShowTraces: () => void
  onToggleYaml: () => void
}) => (
  <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch'>
    <h2 className='min-w-0 truncate text-3xl font-medium max-sm:text-xl'>{title}</h2>
    <div className='flex gap-2 max-sm:w-full'>
      {canDraftFromPrompt ? (
        <Button
          type='button'
          variant='secondary'
          size='icon'
          disabled={busy}
          aria-label='Draft workflow from prompt'
          onClick={onDraftFromPrompt}
        >
          <GradientSparklesIcon className='size-4' />
        </Button>
      ) : null}
      <Button
        disabled={busy || (yamlOpen && !yamlValid)}
        className='max-sm:flex-1'
        onClick={onSave}
      >
        <IconDeviceFloppy className='size-4' />
        Save
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='secondary'
            size='icon'
            aria-label='More automation actions'
          >
            <IconDotsVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='min-w-44 p-2'
        >
          {canDelete ? (
            <DropdownMenuItem
              className='gap-2 px-3 py-2'
              onSelect={onShowTraces}
            >
              <IconActivityHeartbeat className='size-4' />
              Traces
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className='gap-2 px-3 py-2'
            onSelect={onToggleYaml}
          >
            {yamlOpen ? <IconEye className='size-4' /> : <IconFileCode className='size-4' />}
            {yamlOpen ? 'Edit visually' : 'Edit YAML'}
          </DropdownMenuItem>
          {canDraftFromPrompt ? (
            <DropdownMenuItem
              disabled={busy}
              className='gap-2 px-3 py-2'
              onSelect={onDraftFromPrompt}
            >
              <GradientSparklesIcon className='size-4' />
              Draft from prompt
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
                className='gap-2 px-3 py-2 text-destructive'
                onSelect={onDelete}
              >
                <IconTrash className='size-4' />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
)

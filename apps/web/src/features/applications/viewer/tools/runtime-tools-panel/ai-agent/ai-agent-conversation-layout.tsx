import { useRef, useState, type ReactNode } from 'react'
import { IconDownload, IconDots, IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const AiAgentConversationLayout = ({
  toolbar,
  transcript,
  composer,
  className
}: {
  toolbar: ReactNode
  transcript: ReactNode
  composer: ReactNode
  className?: string
}) => (
  <section
    aria-label='Device conversation'
    className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', className)}
    data-testid='ai-agent-tools-section'
  >
    {toolbar}
    {transcript}
    <div
      className='shrink-0 pt-3'
      data-testid='ai-agent-composer-dock'
    >
      <div className='mx-auto grid w-full max-w-3xl gap-3'>{composer}</div>
    </div>
  </section>
)

export const AiAgentConversationToolbar = ({
  hasTurns = false,
  loading = false,
  isClearing = false,
  onExport,
  onClear
}: {
  hasTurns?: boolean
  loading?: boolean
  isClearing?: boolean
  onExport?: () => void
  onClear?: () => void
}) => (
  <div
    className='flex h-9 shrink-0 items-center justify-between gap-3'
    aria-busy={loading || isClearing}
  >
    <h2 className={cn('text-xs text-foreground-muted', !hasTurns && 'sr-only')}>Conversation</h2>
    {hasTurns ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='Conversation actions'
            disabled={loading || isClearing}
          >
            <IconDots className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={onExport}>
            <IconDownload className='mr-2 size-4' />
            Export conversation
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onClear}>
            <IconTrash className='mr-2 size-4' />
            Clear conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null}
  </div>
)

export const AiAgentPromptSuggestions = ({
  suggestions,
  onSelect
}: {
  suggestions: Array<{ id: string; label: string; prompt: string }>
  onSelect: (prompt: string) => void
}) => (
  <div
    className='flex flex-wrap justify-center gap-2'
    aria-label='Suggested requests'
  >
    {suggestions.slice(0, 3).map(preset => (
      <Button
        key={preset.id}
        type='button'
        size='sm'
        variant='ghost'
        className='h-auto min-h-8 max-w-full whitespace-normal text-left font-normal text-foreground-muted'
        onClick={() => onSelect(preset.prompt)}
      >
        {preset.label}
      </Button>
    ))}
  </div>
)

export const AiAgentSuggestionsMenu = ({
  suggestions,
  onSelect
}: {
  suggestions: Array<{ id: string; label: string; prompt: string }>
  onSelect: (prompt: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const selectedRef = useRef(false)
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (next) selectedRef.current = false
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Suggestions'
          title='Suggested requests'
          className='rounded-full text-foreground-muted'
        >
          <IconPlus className='size-5' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        finalFocus={() => !selectedRef.current}
        side='top'
        align='start'
        className='w-64'
      >
        <p className='mb-2 text-xs font-medium text-foreground-muted'>Suggested requests</p>
        <div className='grid gap-1'>
          {suggestions.map(suggestion => (
            <Button
              key={suggestion.id}
              variant='ghost'
              size='sm'
              className='h-auto justify-start whitespace-normal py-2 text-left font-normal'
              onClick={() => {
                selectedRef.current = true
                setOpen(false)
                onSelect(suggestion.prompt)
              }}
            >
              {suggestion.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

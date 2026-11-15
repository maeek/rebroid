import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function WorkflowEditorTitle({ title, onRename }: { title: ReactNode; onRename?: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const restoreFocus = useRef(false)
  const editing = draft !== null && Boolean(onRename)
  const focusClassName = 'rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

  const finishEdit = (apply: boolean, focusTitle = false) => {
    const name = draft?.trim()
    if (apply && name && name !== title) onRename?.(name)
    restoreFocus.current = focusTitle
    setDraft(null)
  }

  return (
    <h1 className={cn('min-w-0 text-lg font-medium [overflow-wrap:anywhere]', editing ? 'flex-1' : 'max-sm:truncate')}>
      {editing ? (
        <input
          ref={input => {
            if (input && document.activeElement !== input) input.focus({ preventScroll: true })
          }}
          aria-label='Workflow name'
          className={cn('w-full min-w-0 bg-transparent p-0', focusClassName)}
          value={draft ?? ''}
          onChange={event => setDraft(event.target.value)}
          onBlur={() => finishEdit(true)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
            event.preventDefault()
            finishEdit(event.key === 'Enter', true)
          }}
        />
      ) : onRename && typeof title === 'string' ? (
        <button
          ref={button => {
            if (!button || !restoreFocus.current) return
            restoreFocus.current = false
            button.focus({ preventScroll: true })
          }}
          type='button'
          title='Rename workflow'
          className={cn('cursor-text text-start max-sm:max-w-full max-sm:truncate', focusClassName)}
          onClick={() => setDraft(title)}
        >
          {title}
        </button>
      ) : (
        title
      )}
    </h1>
  )
}

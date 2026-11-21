import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation'
import { AutomationEditorActions } from './automation-editor-actions'

vi.mock('@/hooks/use-desktop-viewport', () => ({ useDesktopViewport: () => true }))

const push = vi.fn()
const noop = () => undefined

function Navigation({ dirty = true }: { dirty?: boolean }) {
  const navigation = useUnsavedNavigation({ hasUnsavedChanges: dirty, push })
  return (
    <>
      <a href='/automations'>Back to workflows</a>
      <AutomationEditorActions
        busy={false}
        canDraftFromPrompt={false}
        canDelete
        yamlOpen={false}
        canSaveOrExport
        onDelete={noop}
        onDraftFromPrompt={noop}
        onExport={noop}
        onImport={noop}
        onRunHistory={() => navigation.requestNavigation('/automations/workflow-1/traces')}
        onSave={noop}
        onToggleYaml={noop}
      />
      {navigation.pendingNavigation ? (
        <button onClick={navigation.confirmPendingNavigation}>Discard and leave</button>
      ) : null}
    </>
  )
}

function openHistory() {
  fireEvent.click(screen.getByRole('button', { name: 'More workflow actions' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Run history' }))
}

describe('workflow resource navigation guard', () => {
  it('requires an explicit discard before opening run history from a dirty editor', async () => {
    push.mockClear()
    render(<Navigation />)
    openHistory()
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and leave' }))
    expect(push).toHaveBeenCalledExactlyOnceWith('/automations/workflow-1/traces')
  })

  it('opens run history directly from a clean editor', async () => {
    push.mockClear()
    render(<Navigation dirty={false} />)
    openHistory()
    await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith('/automations/workflow-1/traces'))
    expect(screen.queryByRole('button', { name: 'Discard and leave' })).toBeNull()
  })

  it('guards the back link when the editor is dirty', () => {
    push.mockClear()
    render(<Navigation />)
    fireEvent.click(screen.getByRole('link', { name: 'Back to workflows' }))
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard and leave' }))
    expect(push).toHaveBeenCalledExactlyOnceWith('/automations')
  })
})

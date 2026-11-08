import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkflowResourceNavigation } from '../shared/workflow-resource-navigation'
import { useUnsavedAutomationNavigation } from './use-unsaved-automation-navigation'

const push = vi.fn()
function Navigation() {
  const navigation = useUnsavedAutomationNavigation({ hasUnsavedChanges: true, push })
  return (
    <>
      <WorkflowResourceNavigation
        workflowId='workflow-1'
        active='editor'
      />
      {navigation.pendingNavigationHref ? (
        <button onClick={navigation.confirmPendingNavigation}>Discard and leave</button>
      ) : null}
    </>
  )
}

describe('workflow resource navigation guard', () => {
  it('requires an explicit discard before leaving a dirty editor for run history', () => {
    render(<Navigation />)
    fireEvent.click(screen.getByRole('link', { name: 'Run history' }))
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard and leave' }))
    expect(push).toHaveBeenCalledExactlyOnceWith('/automations/workflow-1/traces')
  })
})

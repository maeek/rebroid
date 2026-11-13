import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import styles from './action-motion.module.css'
import { StateTransition } from './state-transition'

describe('StateTransition', () => {
  it('animates state changes without replaying history, polling, or replacement resources', () => {
    const { rerender } = render(
      <StateTransition
        identity='first'
        state='running'
      >
        Running
      </StateTransition>
    )
    expect(screen.getByText('Running')).not.toHaveClass(styles.enter)
    rerender(
      <StateTransition
        identity='first'
        state='success'
      >
        Completed
      </StateTransition>
    )
    const completed = screen.getByText('Completed')
    expect(completed).toHaveClass(styles.enter)
    rerender(
      <StateTransition
        identity='first'
        state='success'
      >
        Completed
      </StateTransition>
    )
    expect(screen.getByText('Completed')).toBe(completed)
    rerender(
      <StateTransition
        identity='second'
        state='success'
      >
        Completed
      </StateTransition>
    )
    expect(screen.getByText('Completed')).not.toHaveClass(styles.enter)
  })
})

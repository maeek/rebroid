import type { ReactNode } from 'react'
import styles from './action-motion.module.css'

export const ActionStateContent = ({
  state,
  states
}: {
  state: string
  states: ReadonlyArray<{ key: string; content: ReactNode }>
}) => (
  <span
    data-slot='action-state-content'
    className={styles.swap}
  >
    {states.map(item => (
      <span
        key={item.key}
        className={styles.layer}
        data-active={item.key === state}
        aria-hidden={item.key !== state || undefined}
        inert={item.key !== state || undefined}
      >
        {item.content}
      </span>
    ))}
  </span>
)

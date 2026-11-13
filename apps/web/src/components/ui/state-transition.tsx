'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import styles from './action-motion.module.css'

/** Animate observed state changes, never initial or replacement resource snapshots. */
export const StateTransition = ({
  state,
  identity,
  as: Element = 'span',
  children,
  className
}: {
  state: string
  identity?: string
  as?: 'span' | 'div'
  children: ReactNode
  className?: string
}) => {
  const [observed, setObserved] = useState({ state, identity, revision: 0 })
  if (observed.state !== state || observed.identity !== identity) {
    setObserved({ state, identity, revision: observed.identity === identity ? observed.revision + 1 : 0 })
  }

  return (
    <Element
      key={observed.revision}
      className={cn('inline-flex min-w-0 items-center gap-1.5', observed.revision > 0 && styles.enter, className)}
    >
      {children}
    </Element>
  )
}

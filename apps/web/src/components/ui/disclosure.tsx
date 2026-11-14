'use client'

import type { ComponentProps } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import styles from './disclosure.module.css'

// Native details retain keyboard behavior, toggle events, refs, and mounted drafts.
export const Disclosure = ({ className, ...props }: ComponentProps<'details'>) => (
  <details
    className={cn(styles.disclosure, className)}
    {...props}
  />
)

export const DisclosureSummary = ({ className, ...props }: ComponentProps<'summary'>) => (
  <summary
    className={cn(styles.summary, className)}
    {...props}
  />
)

export const DisclosureChevron = ({
  open,
  direction = 'down',
  className
}: {
  open?: boolean
  direction?: 'right' | 'down'
  className?: string
}) => (
  <IconChevronDown
    aria-hidden
    data-open={open}
    data-direction={direction}
    className={cn(styles.chevron, className)}
  />
)

export const disclosureContentClassName = styles.content
export const disclosureTriggerClassName = styles.summary

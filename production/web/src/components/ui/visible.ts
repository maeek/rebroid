import type { ReactNode } from 'react'

type VisibleProps = {
  when: unknown
  children?: ReactNode
  fallback?: ReactNode
}

export const Visible = ({ when, children, fallback = null }: VisibleProps): ReactNode => {
  return when ? children : fallback
}

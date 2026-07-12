import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type StatusBadgeProps = Omit<BadgeProps, 'variant'> & {
  tone?: StatusBadgeTone
  icon?: ReactNode
}

export const StatusBadge = ({ children, icon, tone = 'neutral', ...props }: StatusBadgeProps) => (
  <Badge
    variant={tone}
    {...props}
  >
    {icon}
    {children}
  </Badge>
)

'use client'

import { Badge } from '@/components/ui/badge'
import { automationTagStyle } from './automation-tags'
import type { AutomationTag } from '@rebroid/automation-core/definition'

export function AutomationTagBadge({ tag }: { tag: AutomationTag }) {
  return (
    <Badge
      variant='neutral'
      className='border border-white/10 shadow-control'
      style={automationTagStyle(tag.color)}
    >
      {tag.name}
    </Badge>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { normalizeTagColor, type AutomationTag } from './automation-tags'

const colorText = (hex: string) => {
  const normalized = normalizeTagColor(hex).slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? '#111827' : '#f8fafc'
}

export function AutomationTagBadge({ tag }: { tag: AutomationTag }) {
  return (
    <Badge
      variant='neutral'
      className='border border-white/10 shadow-control'
      style={{ backgroundColor: tag.color, color: colorText(tag.color) }}
    >
      {tag.name}
    </Badge>
  )
}

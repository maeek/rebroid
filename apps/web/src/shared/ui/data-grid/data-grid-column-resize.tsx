/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- A focusable ARIA separator is a resize widget. */
import { cn } from '@/lib/utils'
import type { Header, Table } from '@tanstack/react-table'

export function DataGridColumnResize<TData>({
  header,
  table,
  className
}: {
  header: Header<TData, unknown>
  table: Table<TData>
  className?: string
}) {
  'use no memo'

  const { column } = header
  const min = column.columnDef.minSize ?? 0
  const max = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER

  return (
    <div
      role='separator'
      tabIndex={0}
      aria-label={`Resize ${column.columnDef.meta?.label ?? column.id} column`}
      aria-orientation='vertical'
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={column.getSize()}
      aria-valuetext={`${Math.round(column.getSize())} pixels`}
      className={cn(
        'absolute end-0 top-0 h-full w-3 cursor-col-resize touch-none select-none',
        'after:absolute after:end-1 after:top-1/2 after:h-5 after:w-px after:-translate-y-1/2 after:bg-transparent',
        'hover:after:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:after:bg-primary',
        column.getIsResizing() && 'after:bg-primary',
        className
      )}
      onKeyDown={event => {
        const step = event.shiftKey ? 32 : 8
        const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
        let width: number
        switch (event.key) {
          case 'ArrowLeft':
            width = column.getSize() - step * direction
            break
          case 'ArrowRight':
            width = column.getSize() + step * direction
            break
          case 'Home':
            width = min
            break
          case 'End':
            width = max
            break
          case 'Enter':
            event.preventDefault()
            column.resetSize()
            return
          default:
            return
        }
        event.preventDefault()
        table.setColumnSizing(current => ({ ...current, [column.id]: Math.min(max, Math.max(min, width)) }))
      }}
      onDoubleClick={() => column.resetSize()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
    />
  )
}

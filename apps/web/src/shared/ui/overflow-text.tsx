'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const textClassName = 'block w-full min-w-0 truncate text-left'

export const OverflowText = ({ value }: { value: string }) => {
  const wrapper = useRef<HTMLSpanElement>(null)
  const triggerId = useId()
  const tooltipId = `${triggerId}-tooltip`
  const [overflowing, setOverflowing] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const node = wrapper.current
    if (!node) return

    const measure = () => {
      const text = node.firstElementChild
      const overflows = text !== null && text.scrollWidth > text.clientWidth
      setOverflowing(overflows)
      if (!overflows) setOpen(false)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [value])

  return (
    <span
      ref={wrapper}
      className='block min-w-0'
    >
      {overflowing ? (
        <Tooltip
          open={open}
          onOpenChange={setOpen}
          triggerId={triggerId}
        >
          <TooltipTrigger
            id={triggerId}
            aria-describedby={open ? tooltipId : undefined}
            closeOnClick={false}
            className={cn(
              textClassName,
              'cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-ring'
            )}
            onClick={() => setOpen(true)}
          >
            {value}
          </TooltipTrigger>
          <TooltipContent
            id={tooltipId}
            role='tooltip'
            side='bottom'
            align='start'
            className={cn(
              'max-h-[min(50dvh,var(--available-height))] max-w-[min(32rem,var(--available-width))]',
              'overflow-auto overscroll-contain whitespace-normal [overflow-wrap:anywhere]'
            )}
          >
            {value}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className={textClassName}>{value}</span>
      )}
    </span>
  )
}

'use client'

export function AutomationStepDropIndicator({ top }: { top: number }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute left-0 right-0 z-20 h-0.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.75)]'
      style={{ top }}
    />
  )
}

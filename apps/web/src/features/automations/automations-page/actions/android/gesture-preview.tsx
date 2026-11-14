import { cn } from '@/lib/utils'

export type RelativePoint = { x: number; y: number }

export function GesturePreview({ start, end }: { start: RelativePoint; end?: RelativePoint }) {
  const clamp = ({ x, y }: RelativePoint) => ({ x: Math.max(0, Math.min(x, 1)), y: Math.max(0, Math.min(y, 1)) })
  start = clamp(start)
  if (end) end = clamp(end)
  const angle = end ? (Math.atan2(end.y - start.y, (end.x - start.x) * 0.64) * 180) / Math.PI : 0
  const pointStyle = (point: RelativePoint) => ({ left: `${point.x * 100}%`, top: `${point.y * 100}%` })
  return (
    <div
      aria-hidden
      className='flex min-h-40 items-center justify-center rounded-control bg-surface-band/60 p-3'
    >
      <div className='aspect-[16/25] h-36 rounded-feature border border-surface-border bg-surface p-2'>
        <div className='relative h-full rounded-control bg-control/60'>
          <div className='absolute inset-x-1/4 top-1/2 border-t border-dashed border-surface-border' />
          <div className='absolute inset-y-1/4 left-1/2 border-l border-dashed border-surface-border' />
          {end && (start.x !== end.x || start.y !== end.y) ? (
            <>
              <div
                className='absolute h-0.5 origin-left bg-primary'
                style={{
                  ...pointStyle(start),
                  width: `${Math.hypot(end.x - start.x, (end.y - start.y) / 0.64) * 100}%`,
                  transform: `rotate(${angle}deg)`
                }}
              />
              <div
                className='absolute'
                style={{ ...pointStyle(end), transform: `rotate(${angle}deg)` }}
              >
                <div className='absolute -top-1 right-0 border-y-4 border-l-[7px] border-y-transparent border-l-primary' />
              </div>
            </>
          ) : null}
          <div
            className={cn(
              'absolute size-2.5 -translate-1/2 rounded-full border-2 border-primary',
              end ? 'bg-surface' : 'bg-primary ring-4 ring-primary/20'
            )}
            style={pointStyle(start)}
          />
        </div>
      </div>
    </div>
  )
}

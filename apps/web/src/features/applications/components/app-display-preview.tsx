import { useContext, type CSSProperties } from 'react'
import { IconBrandAndroid, IconDeviceMobile } from '@tabler/icons-react'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'

export const AppDisplayPreview = ({ display }: { display: { width: number; height: number; dpi?: number } | null }) => {
  const loading = useContext(FormLoadingContext)
  const ratio = display ? display.width / display.height : 0
  const screenWidth = Math.min(13 / 11, ratio)
  const screenHeight = Math.min(1, 13 / 11 / ratio)
  const showScreenDetails = screenWidth >= 0.3 && screenHeight >= 0.4

  return (
    <div
      data-slot='display-preview'
      className='min-w-0 px-3 py-2 [--device-unit:5.5rem] @min-[42rem]/runtime:py-3 @min-[42rem]/runtime:[--device-unit:9rem]'
    >
      <div className='mx-auto grid min-w-0 max-w-sm grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 @min-[42rem]/runtime:grid-cols-[11rem_minmax(0,1fr)] @min-[42rem]/runtime:gap-5'>
        <div
          aria-hidden='true'
          className='grid h-24 place-items-center @min-[42rem]/runtime:h-40'
        >
          {loading ? (
            <Skeleton className='h-full w-12 rounded-control @min-[42rem]/runtime:w-20' />
          ) : display ? (
            <div className='rounded-[10px] border border-control-border-strong bg-control p-0.75 @min-[42rem]/runtime:rounded-panel @min-[42rem]/runtime:p-1'>
              <div
                data-slot='device-preview-screen'
                className='relative grid h-[calc(var(--screen-height)*var(--device-unit))] w-[calc(var(--screen-width)*var(--device-unit))] place-items-center overflow-hidden rounded-[6px] bg-surface-editor text-foreground-muted @min-[42rem]/runtime:rounded-control'
                style={{ '--screen-width': screenWidth, '--screen-height': screenHeight } as CSSProperties}
              >
                {showScreenDetails ? (
                  <>
                    {ratio < 0.7 ? (
                      <div className='absolute top-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground-muted/40' />
                    ) : null}
                    <IconBrandAndroid className='size-4 @min-[42rem]/runtime:size-5' />
                    <div className='absolute inset-x-[32%] bottom-1.5 h-0.5 rounded-full bg-foreground-muted/50' />
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <IconDeviceMobile className='size-10 text-foreground-muted' />
          )}
        </div>
        <div className='grid min-w-0 gap-1'>
          <p className='text-sm font-medium @min-[42rem]/runtime:text-base'>Display preview</p>
          {loading ? (
            <>
              <Skeleton className='h-4 w-20 max-w-full' />
              {display?.dpi !== undefined ? <Skeleton className='h-4 w-12 max-w-full' /> : null}
            </>
          ) : display ? (
            <div className='text-xs leading-5 text-foreground-muted tabular-nums @min-[42rem]/runtime:text-sm'>
              <p className='wrap-anywhere'>
                {display.width} × {display.height} px
              </p>
              {display.dpi !== undefined ? <p>{display.dpi} dpi</p> : null}
            </div>
          ) : (
            <p className='text-xs text-foreground-muted'>Enter valid dimensions and DPI.</p>
          )}
        </div>
      </div>
    </div>
  )
}

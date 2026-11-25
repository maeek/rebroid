import { useContext, type CSSProperties } from 'react'
import { FormLoadingContext } from '@/components/ui/form-loading-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { StateIllustration } from '@/shared/ui/state-illustration'
import styles from './app-display-preview.module.css'

const deviceFrame = '/illustrations/device-frame.webp'

function revealDeviceFrame(screen: HTMLDivElement | null) {
  if (!screen) return
  const image = new Image()
  image.decoding = 'sync'
  image.onload = () => {
    screen.dataset.loaded = 'true'
  }
  image.src = deviceFrame
}

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
            <div
              ref={revealDeviceFrame}
              data-slot='device-preview-screen'
              className={styles.screen}
              style={
                {
                  '--device-frame': `url("${deviceFrame}")`,
                  '--screen-width': screenWidth,
                  '--screen-height': screenHeight
                } as CSSProperties
              }
            >
              {showScreenDetails ? <span className={styles.androidMark} /> : null}
            </div>
          ) : (
            <StateIllustration
              kind='external-devices'
              size='inline'
            />
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

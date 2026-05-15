import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AppDefinition } from '../../(standard)/constants'

export const AppViewerHeading = ({
  app,
  children,
  className
}: {
  app?: AppDefinition
  children?: ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(
        'text-3xl max-sm:text-lg font-medium shrink-0 flex gap-4 justify-between items-center w-full py-4 max-sm:pb-0 flex-wrap',
        className
      )}
    >
      <div className='flex gap-4 items-center overflow-hidden'>
        {app?.icon && (
          <div
            className='shrink-0 size-10 bg-slate-400/20 flex items-center justify-center transition-all -z-[1]'
            style={{
              clipPath: `url(#squircleClip)`,
              backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}
        <span className='text-ellipsis text-nowrap overflow-hidden max-w-[calc(100%-3rem)]'>
          {app?.name || '<App Name>'}
        </span>
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

import { ReactNode } from 'react'
import { AppDefinition } from '../../../constants'

export const AppViewerHeading = ({ app, children }: { app?: AppDefinition; children?: ReactNode }) => {
  return (
    <div className='text-3xl max-sm:text-lg font-medium shrink-0 flex gap-4 justify-between items-center w-full py-4'>
      <div className='flex gap-4 items-center'>
        {app?.icon && (
          <div
            className='size-10 bg-slate-400/20 flex items-center justify-center transition-all -z-[1]'
            style={{
              clipPath: `url(#squircleClip)`,
              backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}
        {app?.name || 'Loading...'}
      </div>
      {children}
    </div>
  )
}

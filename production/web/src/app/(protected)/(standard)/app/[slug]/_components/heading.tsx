import { Button } from '@/components/ui/button'
import { AppDefinition } from '../../../constants'

export const AppViewerHeading = ({ app }: { app?: AppDefinition }) => {
  return (
    <div className='text-3xl max-sm:text-lg font-medium flex-shrink-0 flex gap-4 justify-between items-center w-full py-4'>
      <div className='flex gap-4 items-center'>
        {app?.icon && (
          <div
            className='w-10 h-10 bg-slate-400/20 flex items-center justify-center transition-all'
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
      <Button
        variant='destructive'
        className='px-8'
      >
        Exit App
      </Button>
    </div>
  )
}

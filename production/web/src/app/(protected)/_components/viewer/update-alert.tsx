'use client'
import { IconProgressDown } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import { AppDefinition } from '../../(standard)/constants'

export const AppUpdateAlert = ({
  app,
  className,
  buttonText,
  description,
  onClick
}: {
  app?: AppDefinition
  className?: string
  buttonText?: string
  description?: string
  onClick?: () => void
}) => {
  if (!app?.apk.newVersion) {
    return <></>
  }

  return (
    <Section
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border border-green-500/20 bg-green-500/10! px-4 py-3 text-sm text-foreground hover:bg-green-500/20',
        className
      )}
    >
      <div className='flex flex-row gap-2 items-start'>
        <div className='pt-2'>
          <IconProgressDown className='size-5' />
        </div>
        <div>
          <div className='font-medium'>Update Available!</div>
          <div>
            {description || `We detected a new version of ${app?.name}. Go to the app management to update it.`}
          </div>
        </div>
      </div>
      <Link
        href={`/app/${app?.id}/manage`}
        onClick={e => {
          if (onClick) {
            e.preventDefault()
            onClick()
          }
        }}
      >
        <Button
          className='px-8 mt-4 w-full'
          variant='update'
        >
          {buttonText || 'Update Now'}&nbsp;&nbsp;•&nbsp;&nbsp;
          {app?.apk.newVersion ? `v${app.apk.newVersion}` : 'Latest'}
        </Button>
      </Link>
    </Section>
  )
}

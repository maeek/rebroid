import { IconProgressDown } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'
import { AppDefinition } from '../../../constants'

export const UpdateAlert = ({ app, className }: { app?: AppDefinition; className?: string }) => {
  if (!app?.newVersion) {
    return <></>
  }

  return (
    <Section
      className={cn(
        'flex flex-col gap-2 border-green-500/20 !bg-green-500/10 text-foreground hover:bg-green-500/20 w-full rounded-lg border px-4 py-3 text-sm',
        className
      )}
    >
      <div className='flex flex-row gap-2 items-start'>
        <div className='pt-2'>
          <IconProgressDown className='size-5' />
        </div>
        <div>
          <div className='font-medium'>Update Available!</div>
          <div>We detected a new version of {app?.name}. Go to the app management to update it.</div>
        </div>
      </div>
      <Link href={`/app/${app?.id}/manage`}>
        <Button
          className='px-8 mt-4 w-full'
          variant='update'
        >
          Update&nbsp;&nbsp;•&nbsp;&nbsp;v{app?.newVersion}
        </Button>
      </Link>
    </Section>
  )
}

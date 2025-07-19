import { IconProgressDown } from '@tabler/icons-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AppDefinition } from '../../../constants'

export const UpdateAlert = ({ app, className }: { app?: AppDefinition; className?: string }) => {
  if (!app?.newVersion) {
    return <></>
  }

  return (
    <Alert
      className={className}
      variant='update'
    >
      <IconProgressDown className='w-5 h-5' />
      <AlertTitle>Update Available!</AlertTitle>
      <AlertDescription>
        We detected a new version of {app?.name}. Go to the app management to update it.
      </AlertDescription>
      <Button
        className='px-8 mt-4 w-full'
        variant='update'
      >
        Update Available • v{app?.newVersion}
      </Button>
    </Alert>
  )
}

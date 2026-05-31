'use client'

import { useState } from 'react'
import { IconLoader2, IconRestore } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { repairDisplaySidecarAction } from '@/server/orchestrator/diagnostics/actions'

const castingErrorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : 'Unknown error').replace(/display sidecar/gi, 'casting sidecar')

export const CastingHeaderActions = () => {
  const router = useRouter()
  const [isRestarting, setIsRestarting] = useState(false)

  const restart = async () => {
    setIsRestarting(true)
    try {
      await repairDisplaySidecarAction()
      toast({ title: 'Casting sidecar restarted' })
      window.dispatchEvent(new Event('rebroid:casting-sidecar-restarted'))
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not restart casting sidecar',
        description: castingErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      disabled={isRestarting}
      onClick={() => void restart()}
    >
      {isRestarting ? <IconLoader2 className='size-4 animate-spin' /> : <IconRestore className='size-4' />}
      Restart sidecar
    </Button>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '../../../../lib/error-utils'

export const useAppViewerActionRunner = () => {
  const router = useRouter()
  const [isRunningAction, setIsRunningAction] = useState(false)

  const runAction = async (action: () => Promise<unknown>, title: string) => {
    setIsRunningAction(true)
    try {
      await action()
      router.refresh()
      return true
    } catch (error) {
      toast({ title, description: getDisplayErrorMessage(error), variant: 'destructive' })
      return false
    } finally {
      setIsRunningAction(false)
    }
  }

  return { isRunningAction, runAction }
}

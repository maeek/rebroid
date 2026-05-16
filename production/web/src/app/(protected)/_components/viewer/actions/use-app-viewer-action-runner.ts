'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

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
      toast({ title, description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
      return false
    } finally {
      setIsRunningAction(false)
    }
  }

  return { isRunningAction, runAction }
}

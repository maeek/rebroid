'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { ActionResultError } from '@/shared/actions/action-result'

const isSessionError = (message: string) => /session|sign in|unauthenticated|unauthorized|authentication/i.test(message)

export const useApplicationActionRunner = () => {
  const router = useRouter()
  const [isRunningAction, setIsRunningAction] = useState(false)

  const runAction = async (action: () => Promise<unknown>, title: string) => {
    setIsRunningAction(true)
    try {
      await action()
      router.refresh()
      return true
    } catch (error) {
      const message = getDisplayErrorMessage(error)
      if (error instanceof ActionResultError ? error.failure.code === 'unauthenticated' : isSessionError(message)) {
        await signOut({ callbackUrl: '/login', redirect: true })
        return false
      }

      toast({ title, description: message, variant: 'danger' })
      return false
    } finally {
      setIsRunningAction(false)
    }
  }

  return { isRunningAction, runAction }
}

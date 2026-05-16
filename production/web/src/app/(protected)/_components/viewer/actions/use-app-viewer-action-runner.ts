'use client'

import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

export const useAppViewerActionRunner = () => {
  const router = useRouter()

  const runAction = async (action: () => Promise<unknown>, title: string) => {
    try {
      await action()
      router.refresh()
      return true
    } catch (error) {
      toast({ title, description: error instanceof Error ? error.message : 'Unknown error' })
      return false
    }
  }

  return { runAction }
}

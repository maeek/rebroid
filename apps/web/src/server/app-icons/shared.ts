import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/server/auth/authorization'

export const requireUser = async () => {
  return getCurrentUser()
}

export const revalidateAppIconPaths = (appId: string) => {
  revalidatePath('/apps')
  revalidatePath(`/app/${appId}`)
  revalidatePath(`/app/${appId}/manage`)
}

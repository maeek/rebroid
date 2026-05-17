import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'

export const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}

export const revalidateAppIconPaths = (appId: string) => {
  revalidatePath('/apps')
  revalidatePath(`/app/${appId}`)
  revalidatePath(`/app/${appId}/manage`)
}

import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'
import { requireAdmin } from '@/server/auth/authorization'

export const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}

export const requireAdminUser = async () => {
  await requireAdmin()
}

export const revalidateApplicationList = () => {
  revalidatePath('/apps')
}

export const revalidateApplicationDetail = (id: string) => {
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
}

export const revalidateOrchestratorPages = () => {
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
}

export const revalidateOrchestratorSettingsPage = () => {
  revalidatePath('/settings/orchestrator')
}

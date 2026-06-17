import { revalidatePath } from 'next/cache'
import { getCurrentUser, requireAdmin } from '@/server/auth/authorization'

export const requireUser = async () => {
  return getCurrentUser()
}

export const requireAdminUser = async () => {
  return requireAdmin()
}

export const revalidateApplicationList = () => {
  revalidatePath('/apps')
}

export const revalidateApplicationDetail = (id: string) => {
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
}

export const revalidateOrchestratorPages = () => {
  revalidatePath('/platform')
  revalidatePath('/system/resources')
}

export const revalidateOrchestratorSettingsPage = () => {
  revalidatePath('/platform')
}

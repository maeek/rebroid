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
  revalidatePath('/orchestrator')
  revalidatePath('/infrastructure/system')
}

export const revalidateOrchestratorSettingsPage = () => {
  revalidatePath('/orchestrator')
}

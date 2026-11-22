import { revalidatePath } from 'next/cache'

export const revalidateApplicationList = () => {
  revalidatePath('/apps')
}

export const revalidateApplicationDetail = (id: string) => {
  revalidatePath(`/app/${id}`)
}

export const revalidateOrchestratorPages = () => {
  revalidatePath('/platform')
  revalidatePath('/system/resources')
}

export const revalidateOrchestratorSettingsPage = () => {
  revalidatePath('/platform')
}

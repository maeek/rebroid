import { revalidatePath } from 'next/cache'

export const revalidateAppIconPaths = (appId: string) => {
  revalidatePath('/apps')
  revalidatePath(`/app/${appId}`)
}

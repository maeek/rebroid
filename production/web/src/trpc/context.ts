import { getServerAuthSession } from '@/server/auth/auth'

export async function createContext() {
  const session = await getServerAuthSession()
  return {
    session
  }
}
export type Context = Awaited<ReturnType<typeof createContext>>

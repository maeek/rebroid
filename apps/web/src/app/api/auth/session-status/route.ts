import { getServerAuthSessionStatus } from '@/server/auth/auth'

export const GET = async () => {
  const session = await getServerAuthSessionStatus()
  return new Response(null, {
    status: session?.user ? 204 : 401,
    headers: { 'Cache-Control': 'no-store' }
  })
}

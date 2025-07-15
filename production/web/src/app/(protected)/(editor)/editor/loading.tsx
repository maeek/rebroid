import { redirect, RedirectType } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { getServerAuthSession } from '@/server/auth/auth'

export default async function Loading() {
  const session = await getServerAuthSession()

  if (!session) {
    return redirect('/login', RedirectType.replace)
  }

  return (
    <div className='flex w-full h-[100dvh] gap-4 py-2 px-2'>
      <Skeleton className='w-[270px] h-full' />
      <div className='size-full flex flex-col gap-2'>
        <Skeleton className='w-full h-16' />
        <Skeleton className='w-full h-full' />
      </div>
    </div>
  )
}

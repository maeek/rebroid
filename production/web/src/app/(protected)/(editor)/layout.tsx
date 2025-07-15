import Link from 'next/link'
import { redirect, RedirectType } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { NaselfLogo } from '@/components/ui/naself-logo'
import { getServerAuthSession } from '@/server/auth/auth'

export default async function FilesLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession()

  if (!session) {
    return redirect('/login', RedirectType.replace)
  }

  return (
    <div className='main-layout'>
      <div className='w-full h-9 bg-layout flex items-center justify-between px-4'>
        <Link href='/'>
          <NaselfLogo className='h-3' />
        </Link>
        <div>
          <Input
            type='search'
            placeholder='Search'
            className='h-6 rounded-[calc(var(--radius)-6px)] w-80 min-w-40 flex-1'
          />
        </div>
        <div />
      </div>
      <div className='h-full w-full'>{children}</div>
    </div>
  )
}

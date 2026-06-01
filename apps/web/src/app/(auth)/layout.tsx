import { AuthBackdrop } from '@/features/auth/components/auth-backdrop'
import { TopBarUnprotected } from '@/features/auth/components/top-bar'

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-col w-full h-full relative'>
      <AuthBackdrop />

      <TopBarUnprotected />
      <div className='h-full w-full grow'>{children}</div>
    </div>
  )
}

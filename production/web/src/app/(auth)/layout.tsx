import { AndroidLogo3D } from '@/components/ui/android-logo-3d'
import { TopBarUnprotected } from '@/features/auth/components/top-bar'

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-col w-full h-full relative'>
      <div className='pointer-events-none absolute top-unset bottom-0 inset-0 opacity-40 overflow-hidden max-w-screen flex items-end justify-center lg:bg-[radial-gradient(#29573c7a,transparent)]'>
        <AndroidLogo3D className='max-w-400' />
      </div>
      <TopBarUnprotected />
      <div className='h-full w-full grow'>{children}</div>
    </div>
  )
}

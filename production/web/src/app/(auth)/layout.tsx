import { TopBarUnprotected } from '@/features/auth/components/top-bar'

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-col w-full h-full'>
      <TopBarUnprotected />
      <div className='h-full w-full grow'>{children}</div>
    </div>
  )
}

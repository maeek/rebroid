import type { ReactNode } from 'react'
import { IconAlertTriangle, IconDeviceDesktop } from '@tabler/icons-react'
import { StatusSplash } from '@/features/shell/components/status-splash'

export const ViewerSplash = ({
  title,
  description,
  detail,
  tone = 'default',
  icon
}: {
  title: string
  description: string
  detail?: string | null
  tone?: 'default' | 'danger'
  icon?: ReactNode
}) => (
  <main className='flex min-h-screen items-center justify-center overflow-hidden bg-black p-6'>
    <div className='relative flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-5 text-center'>
      <div className='relative h-44 w-32 rounded-[2rem] border border-border/80 bg-black shadow-2xl'>
        <div className='absolute left-1/2 top-3 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-500/80' />
        <div className='absolute inset-x-5 bottom-10 top-9 flex items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-slate-950'>
          <IconDeviceDesktop
            className='size-14 text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.55)]'
            stroke={1.75}
          />
        </div>
        <div className='absolute bottom-5 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-primary/70 shadow-[0_0_18px_hsl(var(--primary))]' />
      </div>
      <StatusSplash
        title={title}
        description={description}
        detail={detail}
        tone={tone}
        icon={
          icon ??
          (tone === 'danger' ? <IconAlertTriangle className='size-10' /> : <IconDeviceDesktop className='size-10' />)
        }
        className='min-h-0 w-full'
      />
    </div>
  </main>
)

import { useState } from 'react'
import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { startApplicationAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { variantStyles, type NavigationVariant } from './protected-navigation-config'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const RecentAppLink = ({
  app,
  variant,
  isActive,
  onNavigate,
  onStarted
}: {
  app: RecentApp
  variant: NavigationVariant
  isActive: boolean
  onNavigate?: () => void
  onStarted: () => void
}) => {
  const styles = variantStyles[variant]
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const isOperating = app.status === 'provisioning' || app.status === 'removing' || isStarting
  const canStart = app.status === 'stopped' || app.status === 'error'

  const startAndOpen = async () => {
    if (isStarting) return

    setIsStarting(true)
    router.push(`/app/${app.id}`)
    onNavigate?.()
    try {
      await startApplicationAction(app.id)
      onStarted()
    } catch {
      // The destination page surfaces the runtime error state after navigation.
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <li className={cn(styles.item, 'group', isActive && styles.activeItem)}>
      <Link
        href={`/app/${app.id}`}
        onClick={onNavigate}
        className='flex min-w-0 flex-1 items-center gap-2'
      >
        <div className={styles.iconWrap}>
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='size-6 text-[0.6rem]'
          />
        </div>
        <span className={cn(styles.label, 'truncate')}>{app.name}</span>
      </Link>
      <Visible when={app.status === 'running'}>
        <span
          title='Running'
          aria-label='Running'
          className='mr-2 size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
        />
      </Visible>
      <Visible when={isOperating}>
        <IconLoader2
          title={app.statusLabel ?? 'Working'}
          aria-label={app.statusLabel ?? 'Working'}
          className='mr-1.5 size-4 shrink-0 animate-spin text-primary'
        />
      </Visible>
      <Visible when={canStart && !isStarting}>
        <button
          type='button'
          title={`Start ${app.name}`}
          aria-label={`Start ${app.name}`}
          className='mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-foreground-muted opacity-0 transition hover:bg-primary/15 hover:text-primary focus:opacity-100 group-hover:opacity-100'
          onClick={() => void startAndOpen()}
        >
          <IconPlayerPlayFilled className='size-4' />
        </button>
      </Visible>
    </li>
  )
}

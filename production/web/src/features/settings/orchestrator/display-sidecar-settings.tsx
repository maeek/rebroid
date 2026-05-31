'use client'

import { useState } from 'react'
import { IconLoader2, IconRefresh, IconRestore, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import {
  listDisplaySidecarSessionsAction,
  releaseDisplaySidecarSessionAction,
  repairDisplaySidecarAction
} from '@/server/orchestrator/diagnostics/actions'
import type { DisplaySidecarSession, ServiceHealth } from '@/server/orchestrator/diagnostics/types'

const formatTimestamp = (value: string) => new Date(value).toLocaleString()

export const DisplaySidecarSettings = ({
  initialHealth,
  initialSessions
}: {
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
}) => {
  const [health, setHealth] = useState(initialHealth)
  const [sessions, setSessions] = useState(initialSessions)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => {
    setBusy('refresh')
    try {
      setSessions(await listDisplaySidecarSessionsAction())
    } catch (error) {
      toast({
        title: 'Could not load display sessions',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const repair = async () => {
    setBusy('repair')
    try {
      const nextHealth = await repairDisplaySidecarAction()
      setHealth(nextHealth)
      setSessions([])
      toast({ title: 'Display sidecar restarted' })
    } catch (error) {
      toast({
        title: 'Could not restart display sidecar',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const release = async (session: DisplaySidecarSession) => {
    setBusy(session.id)
    try {
      const released = await releaseDisplaySidecarSessionAction(session.id)
      setSessions(current => current.map(item => (item.id === released.id ? released : item)))
      toast({ title: 'Display session terminated' })
    } catch (error) {
      toast({
        title: 'Could not terminate display session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const activeSessions = sessions.filter(session => session.status === 'created' || session.status === 'active')

  return (
    <Section
      title='Display sidecar'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4'>
        <div className='flex items-center gap-3'>
          <Badge variant={health.ok ? 'status' : 'warning'}>{health.status}</Badge>
          <span className='text-sm text-secondary-foreground'>{health.message}</span>
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='ghost'
            disabled={busy !== null}
            onClick={() => void refresh()}
          >
            {busy === 'refresh' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
            Refresh
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={busy !== null}
            onClick={() => void repair()}
          >
            {busy === 'repair' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRestore className='size-4' />}
            Restart sidecar
          </Button>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-[52rem] text-left text-sm'>
          <thead className='border-b border-border/60 text-xs uppercase text-secondary-foreground'>
            <tr>
              <th className='px-3 py-2 font-medium'>Application</th>
              <th className='px-3 py-2 font-medium'>Owner</th>
              <th className='px-3 py-2 font-medium'>Status</th>
              <th className='px-3 py-2 font-medium'>Last activity</th>
              <th className='px-3 py-2 font-medium'>Expires</th>
              <th className='px-3 py-2 text-right font-medium'>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr
                key={session.id}
                className='border-b border-border/40'
              >
                <td className='px-3 py-3 font-medium'>{session.applicationId ?? 'Unassigned'}</td>
                <td className='px-3 py-3 text-secondary-foreground'>{session.ownerUserId ?? 'Unknown'}</td>
                <td className='px-3 py-3'>
                  <Badge variant={session.status === 'active' ? 'status' : 'secondary'}>{session.status}</Badge>
                </td>
                <td className='px-3 py-3 text-secondary-foreground'>{formatTimestamp(session.lastActivityAt)}</td>
                <td className='px-3 py-3 text-secondary-foreground'>{formatTimestamp(session.expiresAt)}</td>
                <td className='px-3 py-3 text-right'>
                  <Button
                    type='button'
                    size='sm'
                    variant='destructive'
                    disabled={busy !== null || !['created', 'active'].includes(session.status)}
                    onClick={() => void release(session)}
                  >
                    {busy === session.id ? (
                      <IconLoader2 className='size-4 animate-spin' />
                    ) : (
                      <IconTrash className='size-4' />
                    )}
                    Terminate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sessions.length === 0 ? (
        <p className='text-sm text-secondary-foreground'>No display sessions are known to the sidecar.</p>
      ) : (
        <p className='text-xs text-secondary-foreground'>
          {activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}.
        </p>
      )}
    </Section>
  )
}

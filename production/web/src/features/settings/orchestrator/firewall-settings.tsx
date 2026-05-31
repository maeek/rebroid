'use client'

import { useState } from 'react'
import { IconLoader2, IconLock, IconRefresh } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { updateNetworkPolicyAction } from '@/server/orchestrator/applications/mutation-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/read-actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { ServiceHealth } from '@/server/orchestrator/diagnostics/types'

const broadInternetCidr = '0.0.0.0/0'

export const FirewallSettings = ({
  initialHealth,
  initialApplications
}: {
  initialHealth: ServiceHealth
  initialApplications: AndroidApplication[]
}) => {
  const [applications, setApplications] = useState(initialApplications)
  const [health] = useState(initialHealth)
  const [busy, setBusy] = useState<string | null>(null)

  const replaceApplication = (application: AndroidApplication) => {
    setApplications(current => current.map(item => (item.id === application.id ? application : item)))
  }

  const refresh = async () => {
    setBusy('refresh')
    try {
      setApplications(await listApplicationsAction())
    } catch (error) {
      toast({
        title: 'Could not load firewall policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const setRestricted = async (application: AndroidApplication, enabled: boolean) => {
    setBusy(application.id)
    try {
      replaceApplication(await updateNetworkPolicyAction(application.id, { networkPolicyEnabled: enabled }))
      toast({ title: enabled ? 'Restricted egress enabled' : 'Unrestricted egress enabled' })
    } catch (error) {
      toast({
        title: 'Could not update firewall policy',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const lockInternet = async (application: AndroidApplication) => {
    setBusy(application.id)
    try {
      replaceApplication(
        await updateNetworkPolicyAction(application.id, {
          networkPolicyEnabled: true,
          networkPolicyAllowCidrs: application.network.policy.allowCidrs.filter(cidr => cidr !== broadInternetCidr)
        })
      )
      toast({ title: 'Internet access locked' })
    } catch (error) {
      toast({
        title: 'Could not lock internet access',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      title='Firewall agent'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-5'
    >
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4'>
        <div className='flex items-center gap-3'>
          <Badge variant={health.ok ? 'status' : 'warning'}>{health.status}</Badge>
          <span className='text-sm text-secondary-foreground'>{health.message}</span>
        </div>
        <Button
          type='button'
          variant='ghost'
          disabled={busy !== null}
          onClick={() => void refresh()}
        >
          {busy === 'refresh' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
          Refresh
        </Button>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-[58rem] text-left text-sm'>
          <thead className='border-b border-border/60 text-xs uppercase text-secondary-foreground'>
            <tr>
              <th className='px-3 py-2 font-medium'>Application</th>
              <th className='px-3 py-2 font-medium'>Runtime</th>
              <th className='px-3 py-2 font-medium'>Policy</th>
              <th className='px-3 py-2 font-medium'>Allowlist</th>
              <th className='px-3 py-2 font-medium'>Result</th>
              <th className='px-3 py-2 text-right font-medium'>Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map(application => {
              const policy = application.network.policy
              const allowsInternet = policy.allowCidrs.includes(broadInternetCidr)
              return (
                <tr
                  key={application.id}
                  className='border-b border-border/40'
                >
                  <td className='px-3 py-3 font-medium'>{application.name}</td>
                  <td className='px-3 py-3 text-secondary-foreground'>{application.status.currentStatus}</td>
                  <td className='px-3 py-3'>
                    <label className='flex items-center gap-2'>
                      <Switch
                        checked={policy.enabled}
                        disabled={busy !== null}
                        aria-label={`Toggle restricted egress for ${application.name}`}
                        onCheckedChange={checked => void setRestricted(application, checked)}
                      />
                      <span className='text-xs text-secondary-foreground'>
                        {policy.enabled ? 'Restricted' : 'Unrestricted'}
                      </span>
                    </label>
                  </td>
                  <td className='px-3 py-3 text-secondary-foreground'>
                    {policy.allowCidrs.length} CIDR{policy.allowCidrs.length === 1 ? '' : 's'}
                  </td>
                  <td className='px-3 py-3'>
                    <Badge variant={policy.result?.status === 'error' ? 'destructive' : 'secondary'}>
                      {policy.result?.code ?? policy.status ?? 'not applied'}
                    </Badge>
                  </td>
                  <td className='px-3 py-3 text-right'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={busy !== null || (policy.enabled && !allowsInternet)}
                      onClick={() => void lockInternet(application)}
                    >
                      {busy === application.id ? (
                        <IconLoader2 className='size-4 animate-spin' />
                      ) : (
                        <IconLock className='size-4' />
                      )}
                      Lock internet
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {applications.length === 0 && (
        <p className='text-sm text-secondary-foreground'>No application containers are configured.</p>
      )}
    </Section>
  )
}

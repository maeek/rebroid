'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { AppNetworkPolicyEditorSection } from '@/features/applications/components/app-network-policy-editor-section'
import { parseOutboundDestinations } from '@/features/applications/components/outbound-destinations'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { ActionResultError, unwrapActionResult } from '@/shared/actions/action-result'
import { outboundEnforcement } from '@/shared/model/network/outbound-policy'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { UpdateNetworkPolicyInput } from '@/shared/contracts/application'

const sameDestinations = (left: string[], right: string[]) =>
  left.length === right.length && left.every((cidr, index) => cidr === right[index])

const enforcementForApp = (app: AppDefinition) =>
  outboundEnforcement(app.status, { enabled: app.networkPolicyEnabled, result: app.networkPolicyResult })

export const AppManageNetworkPolicySettings = ({
  app,
  onUpdated,
  canUseInternet
}: {
  app: AppDefinition
  onUpdated: (app: AppDefinition) => void
  canUseInternet: boolean
}) => {
  const [accessDraft, setAccessDraft] = useState<boolean>()
  const [destinationDraft, setDestinationDraft] = useState<string>()
  const [destinationsError, setDestinationsError] = useState<string>()
  const [failure, setFailure] = useState<{ message: string; requestId?: string; saved?: boolean }>()
  const [pending, setPending] = useState<'save' | 'retry'>()
  const submitting = useRef(false)
  const restricted = accessDraft ?? app.networkPolicyEnabled
  const savedDestinations = app.networkPolicyAllowCidrs.join('\n')
  const destinations = destinationDraft ?? savedDestinations
  const destinationsChanged = restricted && destinations !== savedDestinations
  const dirty = restricted !== app.networkPolicyEnabled || destinationsChanged
  const enforcement = enforcementForApp(app)
  const canRetry = enforcement.tone === 'danger' || enforcement.tone === 'warning'

  const resetDraft = () => {
    setAccessDraft(undefined)
    setDestinationDraft(undefined)
    setDestinationsError(undefined)
  }

  const submit = async (input?: UpdateNetworkPolicyInput) => {
    if (submitting.current) return
    submitting.current = true
    setPending(input ? 'save' : 'retry')
    setFailure(undefined)
    try {
      const result = input ? await updateNetworkPolicyAction(app.id, input) : await applyNetworkPolicyAction(app.id)
      const next = mapAndroidApplicationToAppDefinition(unwrapActionResult(result))
      onUpdated(next)
      if (input) resetDraft()
      const state = enforcementForApp(next)
      if (state.tone === 'danger' || state.tone === 'warning') {
        setFailure({ message: state.description, requestId: result.requestId, saved: Boolean(input) })
      } else {
        toast({
          title: input ? 'Network access saved' : 'Firewall rules refreshed',
          description: state.description,
          variant: 'success'
        })
      }
    } catch (error) {
      const details = error instanceof ActionResultError ? error.failure : undefined
      let saved = false
      // The orchestrator can persist the draft before live enforcement fails.
      if (!details || ['upstream_error', 'upstream_unavailable', 'internal'].includes(details.code)) {
        const current = await getApplicationAction(app.id).catch(() => undefined)
        if (current) {
          const next = mapAndroidApplicationToAppDefinition(current)
          onUpdated(next)
          saved = Boolean(
            input &&
            (input.networkPolicyEnabled === undefined || input.networkPolicyEnabled === next.networkPolicyEnabled) &&
            (input.networkPolicyAllowCidrs === undefined ||
              sameDestinations(input.networkPolicyAllowCidrs, next.networkPolicyAllowCidrs))
          )
          if (saved) resetDraft()
        }
      }
      setFailure({
        message: details?.message ?? 'The request could not be completed. Try again.',
        requestId: details?.requestId,
        saved
      })
      setDestinationsError(details?.fieldErrors?.networkPolicyAllowCidrs?.join(' '))
    } finally {
      submitting.current = false
      setPending(undefined)
    }
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dirty || submitting.current) return
    const input: UpdateNetworkPolicyInput = {}
    if (restricted !== app.networkPolicyEnabled) input.networkPolicyEnabled = restricted
    if (destinationsChanged) {
      const parsed = parseOutboundDestinations(destinations, canUseInternet)
      setDestinationsError(parsed.error)
      if (!parsed.cidrs) return
      if (!sameDestinations(parsed.cidrs, app.networkPolicyAllowCidrs)) input.networkPolicyAllowCidrs = parsed.cidrs
    }
    if (Object.keys(input).length > 0) void submit(input)
    else resetDraft()
  }

  return (
    <div className='grid min-w-0 gap-6'>
      <FirewallEnforcementSection
        state={enforcement}
        actions={
          canRetry && !dirty ? (
            <MutationButton
              type='button'
              variant='secondary'
              pending={pending === 'retry'}
              pendingLabel='Retrying…'
              disabled={Boolean(pending)}
              onClick={() => void submit()}
            >
              Retry enforcement
            </MutationButton>
          ) : undefined
        }
      />
      {failure ? (
        <Notice
          tone='danger'
          title={failure.saved ? 'Settings saved. Check firewall enforcement.' : 'Could not update network access'}
          description={failure.message}
        >
          {failure.requestId ? <p className='text-xs text-foreground-muted'>Request ID {failure.requestId}</p> : null}
        </Notice>
      ) : null}
      <form onSubmit={handleSave}>
        <AppNetworkPolicyEditorSection
          restricted={restricted}
          onRestrictedChange={networkPolicyEnabled =>
            setAccessDraft(networkPolicyEnabled === app.networkPolicyEnabled ? undefined : networkPolicyEnabled)
          }
          destinations={destinations}
          onDestinationsChange={text => {
            setDestinationDraft(text === savedDestinations ? undefined : text)
            setDestinationsError(undefined)
          }}
          destinationsError={destinationsError}
          disabled={Boolean(pending)}
          canUseInternet={canUseInternet}
        >
          {dirty && app.status === 'running' ? (
            <p className='text-sm text-foreground-muted'>Saving updates the firewall for the running app.</p>
          ) : null}
          <div className='flex flex-wrap gap-2'>
            <MutationButton
              type='submit'
              pending={pending === 'save'}
              pendingLabel='Saving…'
              disabled={!dirty || Boolean(pending)}
            >
              Save network access
            </MutationButton>
            {dirty ? (
              <Button
                type='button'
                variant='ghost'
                disabled={Boolean(pending)}
                onClick={() => {
                  resetDraft()
                  setFailure(undefined)
                }}
              >
                Discard changes
              </Button>
            ) : null}
          </div>
        </AppNetworkPolicyEditorSection>
      </form>
    </div>
  )
}

const FirewallEnforcementSection = ({
  state,
  actions
}: {
  state?: ReturnType<typeof outboundEnforcement>
  actions?: React.ReactNode
}) => (
  <Section
    title='Firewall enforcement'
    surface='plain'
    headingSpacing='compact'
  >
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        {state ? (
          <>
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            <p className='text-sm text-foreground-muted'>{state.description}</p>
          </>
        ) : (
          <Skeleton className='h-6 w-64 max-w-full' />
        )}
      </div>
      {actions}
    </div>
  </Section>
)

const noop = () => undefined

export const AppNetworkPolicySettingsLoading = () => (
  <div className='grid min-w-0 gap-6'>
    <FirewallEnforcementSection />
    <AppNetworkPolicyEditorSection
      restricted
      onRestrictedChange={noop}
      destinations=''
      onDestinationsChange={noop}
      canUseInternet={false}
      disabled
    >
      <Button disabled>Save network access</Button>
    </AppNetworkPolicyEditorSection>
  </div>
)

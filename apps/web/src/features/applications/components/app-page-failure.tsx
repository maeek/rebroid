'use client'

import { useTransition } from 'react'
import { IconCloudOff, IconLinkOff, IconQuestionMark } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { StateView } from '@/shared/ui/state-view'

export type AppPageFailureState = {
  kind: 'invalid-link' | 'not-found' | 'unavailable'
  requestId?: string
}

const failureContent = {
  'invalid-link': {
    title: 'Invalid app link',
    description: 'This link doesn’t point to an app. Find the app in All apps or ask for a new link.',
    symbol: IconLinkOff
  },
  'not-found': {
    title: 'App not found',
    description: 'The app may have been removed, or your account may not have access to it.',
    symbol: IconQuestionMark
  },
  unavailable: {
    title: 'Could not load app',
    description: 'We couldn’t load the app details. Try again in a moment.',
    symbol: IconCloudOff
  }
}

const AppFailureIllustration = ({ kind }: { kind: AppPageFailureState['kind'] }) => {
  const BadgeIcon = failureContent[kind].symbol
  return (
    <div className='text-foreground-muted'>
      <svg
        aria-hidden='true'
        viewBox='0 0 208 144'
        className='h-auto w-44 sm:w-52'
      >
        <circle
          cx='101'
          cy='69'
          r='61'
          className='fill-surface-editor'
        />
        <ellipse
          cx='101'
          cy='125'
          rx='52'
          ry='7'
          className='fill-control'
        />
        <path
          d='M27 75h18m-9-9v18m120-54h14m-7-7v14m-5 79h11'
          fill='none'
          strokeWidth='1.5'
          strokeLinecap='round'
          className='stroke-foreground-subtle'
        />
        <g transform='rotate(-9 96 69)'>
          <rect
            x='67'
            y='20'
            width='59'
            height='100'
            rx='12'
            strokeWidth='2'
            className='fill-control stroke-foreground-muted'
          />
          <rect
            x='74'
            y='37'
            width='45'
            height='64'
            rx='5'
            className='fill-surface-editor'
          />
          <path
            d='M90 29h13m-14 82h15'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
          />
          <rect
            x='85'
            y='51'
            width='23'
            height='23'
            rx='6'
            className='fill-control'
          />
          <path
            d='M89 83h15'
            stroke='currentColor'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </g>
        <circle
          cx='139'
          cy='94'
          r='22'
          strokeWidth='2'
          className='fill-surface-elevated stroke-control-border-strong'
        />
        <BadgeIcon
          x='127'
          y='82'
          size={24}
          stroke={1.7}
        />
      </svg>
    </div>
  )
}

export const AppPageFailure = ({ failure = { kind: 'not-found' } }: { failure?: AppPageFailureState }) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { kind, requestId } = failure
  const { title, description } = failureContent[kind]

  return (
    <StateView
      scope='immersive'
      className='min-h-(--console-content-height)'
      kind={kind === 'unavailable' ? 'unavailable' : 'not-found'}
      title={title}
      description={description}
      icon={<AppFailureIllustration kind={kind} />}
      requestId={requestId}
      actions={[
        ...(kind === 'unavailable'
          ? [
              {
                label: 'Try again',
                pending,
                pendingLabel: 'Retrying…',
                onClick: () => startTransition(() => router.refresh())
              }
            ]
          : []),
        { label: 'View all apps', href: '/apps', variant: kind === 'unavailable' ? 'secondary' : 'primary' }
      ]}
    />
  )
}

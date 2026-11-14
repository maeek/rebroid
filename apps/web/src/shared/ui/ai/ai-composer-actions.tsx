'use client'

import type { ReactNode } from 'react'
import { IconArrowUp, IconCheck } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ComposerAction = {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  pending?: boolean
}

/** The auxiliary action keeps its slot when Stop or Run next is unavailable. */
export const AiComposerActions = ({
  label,
  disabled,
  pending,
  accepted,
  onSubmit,
  secondaryAction
}: {
  label: string
  disabled?: boolean
  pending?: boolean
  accepted?: boolean
  onSubmit: () => void
  secondaryAction?: ComposerAction
}) => (
  <div
    data-slot='ai-composer-actions'
    className='flex shrink-0 items-center gap-2'
  >
    <span className='touch-control inline-flex size-9 shrink-0'>
      {secondaryAction ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <MutationButton
              type='button'
              variant='secondary'
              size='icon-md'
              className='rounded-full motion-reduce:transition-none'
              aria-label={secondaryAction.label}
              disabled={secondaryAction.disabled}
              pending={secondaryAction.pending}
              pendingLabel={<span className='sr-only'>{secondaryAction.label}</span>}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.icon}
            </MutationButton>
          </TooltipTrigger>
          <TooltipContent>{secondaryAction.label}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
    <Tooltip>
      <TooltipTrigger asChild>
        <MutationButton
          type='button'
          size='icon-md'
          className='rounded-full motion-reduce:transition-none'
          aria-label={label}
          disabled={disabled}
          pending={pending}
          pendingLabel={<span className='sr-only'>{label}</span>}
          onClick={onSubmit}
        >
          {accepted ? (
            <IconCheck
              aria-hidden
              className='size-4'
            />
          ) : (
            <IconArrowUp
              aria-hidden
              className='size-4'
            />
          )}
        </MutationButton>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </div>
)

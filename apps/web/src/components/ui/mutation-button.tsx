'use client'

import type { ReactNode } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

type MutationButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean
  pendingLabel?: ReactNode
}

export const MutationButton = ({
  children,
  disabled,
  pending = false,
  pendingLabel,
  ...props
}: MutationButtonProps) => (
  <Button
    aria-busy={pending || undefined}
    disabled={disabled || pending}
    {...props}
  >
    {pending ? <IconLoader2 className='size-4 animate-spin' /> : null}
    {pending ? (pendingLabel ?? children) : children}
  </Button>
)

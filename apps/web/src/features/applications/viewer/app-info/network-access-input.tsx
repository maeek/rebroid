import { type KeyboardEvent, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { chipInputSurfaceClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'

type NetworkAccessInputProps = {
  cidrs: string[]
  disabled?: boolean
  isBusy?: boolean
  onAddCidr: (cidr: string) => void
  onRemoveCidr: (cidr: string) => void
  onInvalidCidr: (value: string) => void
}

const ipv4Segment = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const ipv4Regex = new RegExp(`^(?:${ipv4Segment}\\.){3}${ipv4Segment}$`)
const ipv4CidrRegex = new RegExp(`^((?:${ipv4Segment}\\.){3}${ipv4Segment})/(3[0-2]|[12]?\\d)$`)

const normalizeCidrInput = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (ipv4Regex.test(trimmed)) {
    return `${trimmed}/32`
  }

  if (ipv4CidrRegex.test(trimmed)) {
    return trimmed
  }

  return undefined
}

export const NetworkAccessInput = ({
  cidrs,
  disabled,
  isBusy,
  onAddCidr,
  onRemoveCidr,
  onInvalidCidr
}: NetworkAccessInputProps) => {
  const [draft, setDraft] = useState('')

  const commitDraft = () => {
    const normalized = normalizeCidrInput(draft)

    if (normalized === null) {
      return
    }

    if (!normalized) {
      onInvalidCidr(draft.trim())
      return
    }

    if (!cidrs.includes(normalized)) {
      onAddCidr(normalized)
    }

    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    commitDraft()
  }

  return (
    <div className='w-full space-y-2'>
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md px-3 py-2',
          chipInputSurfaceClassName,
          {
            'cursor-not-allowed opacity-60': disabled || isBusy
          }
        )}
      >
        {cidrs.map(cidr => (
          <Badge
            key={cidr}
            variant='secondary'
            className='flex items-center gap-1 rounded-md border border-control-border/80 bg-muted/80 px-2 py-1 text-xs font-medium text-foreground-muted shadow-xs'
          >
            <span>{cidr}</span>
            <button
              type='button'
              aria-label={`Remove ${cidr}`}
              className='cursor-pointer rounded-sm text-muted-foreground transition hover:text-foreground'
              disabled={disabled || isBusy}
              onClick={() => onRemoveCidr(cidr)}
            >
              <IconX className='size-3.5' />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          disabled={disabled || isBusy}
          className='h-7 min-w-34 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
          placeholder={isBusy ? 'Updating access list...' : 'Add CIDR and press Enter'}
          onBlur={commitDraft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p className='text-xs leading-relaxed text-muted-foreground'>
        Enter app-specific IPv4 CIDRs like 10.20.0.0/16. Plain IPv4 addresses are stored as /32 entries. API/default
        destinations are applied automatically.
      </p>
    </div>
  )
}

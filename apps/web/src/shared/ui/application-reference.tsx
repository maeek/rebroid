import { ResourceLink } from '@/shared/ui/resource-link'

export const ApplicationReference = ({
  id,
  name,
  ownerUsername,
  href = `/app/${encodeURIComponent(id)}`
}: {
  id: string
  name?: string | null
  ownerUsername?: string
  href?: string
}) => {
  const label = name || 'Open application'

  return (
    <div className='grid min-w-0 gap-1'>
      <ResourceLink
        href={href}
        aria-label={ownerUsername ? `${label} · ${ownerUsername}` : undefined}
        className='whitespace-normal break-words font-medium'
      >
        {label}
        {ownerUsername ? <span className='text-xs text-foreground-muted'> · {ownerUsername}</span> : null}
      </ResourceLink>
      <span
        className='truncate font-mono text-xs text-foreground-muted'
        title={id}
      >
        {id}
      </span>
    </div>
  )
}

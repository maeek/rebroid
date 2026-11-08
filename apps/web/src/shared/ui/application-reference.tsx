import { ResourceLink } from '@/shared/ui/resource-link'

export const ApplicationReference = ({ id, name }: { id: string; name?: string | null }) => (
  <div className='grid min-w-0 gap-1'>
    <ResourceLink
      href={`/app/${encodeURIComponent(id)}`}
      className='whitespace-normal break-words font-medium'
    >
      {name || 'Open application'}
    </ResourceLink>
    <span
      className='truncate font-mono text-xs text-foreground-muted'
      title={id}
    >
      {id}
    </span>
  </div>
)

export const ActivityDetailField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className='rounded-lg border border-border/60 bg-surface-band/45 p-3'>
    <div className='text-xs uppercase tracking-wide text-foreground-muted'>{label}</div>
    <div className='mt-1 break-words font-mono text-sm'>{value || 'none'}</div>
  </div>
)

export const ObservationEventDetails = ({ label, values }: { label: string; values: string[] }) => (
  <div className='text-xs text-secondary-foreground'>
    {label}
    {values.length > 0 ? <span className='text-muted-foreground'> ({values.join(', ')})</span> : null}
  </div>
)

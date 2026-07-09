export const ObservationEventDetails = ({ label, values }: { label: string; values: string[] }) => (
  <div className='text-xs text-foreground-muted'>
    {label}
    {values.length > 0 ? <span className='text-muted-foreground'> ({values.join(', ')})</span> : null}
  </div>
)

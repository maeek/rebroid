import { ReactNode } from 'react'

export const QuickGlanceCard = ({
  label,
  value,
  hint,
  headerAction
}: {
  label: string
  value: ReactNode
  hint: ReactNode
  headerAction?: ReactNode
}) => {
  return (
    <div className='rounded-md border border-border/60 border-l-primary/50 bg-card/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
      <div className='flex items-start justify-between gap-2'>
        <div className='text-sm font-medium text-secondary-foreground'>{label}</div>
        {headerAction}
      </div>
      <div className='mt-1 text-2xl font-semibold text-foreground'>{value}</div>
      <div className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</div>
    </div>
  )
}

import { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export const RuntimeToolField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className='grid gap-2'>
    <Label className='text-xs uppercase text-secondary-foreground'>{label}</Label>
    {children}
  </div>
)

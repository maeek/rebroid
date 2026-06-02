import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export const ActivityFilterField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className='grid gap-2'>
    <Label>{label}</Label>
    {children}
  </div>
)

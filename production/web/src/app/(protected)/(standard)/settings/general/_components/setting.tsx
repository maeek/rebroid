import { ReactNode } from 'react'

export const Setting = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <label>
      <div className='flex items-center justify-between gap-4'>
        <div>{label}</div>
        <div>{children}</div>
      </div>
    </label>
  )
}

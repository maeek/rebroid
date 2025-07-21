import { ReactNode } from 'react'
import classNames from 'classnames'

export const Section = ({ className, children }: { className?: string; children?: ReactNode }) => {
  return (
    <div
      className={classNames(
        'flex flex-col bg-card/60 bg-opacity-40 p-6 max-sm:p-4 w-full rounded-xl hover:bg-card/50 border border-input',
        className
      )}
    >
      {children}
    </div>
  )
}

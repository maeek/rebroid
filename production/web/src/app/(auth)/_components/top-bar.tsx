import classNames from 'classnames'
import Link from 'next/link'
import { Button } from '@/components/ui/button'


export const TopBarUnprotected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-4'

  return (
    <div className='flex justify-between h-16 w-dvw border-b border-b-layout-border bg-layout flex-shrink-0 sticky top-0'>
      <div className={classNames(sectionClasses, 'justify-start')}>
        <Link href='/'>
          <span>ShopMeAlone</span>
        </Link>
      </div>
      <div className={classNames(sectionClasses, 'justify-center flex-initial w-full max-w-screen-sm')}></div>
      <div className={classNames(sectionClasses, 'justify-end')}>
        <Button className='font-semibold'>Login</Button>
      </div>
    </div>
  )
}

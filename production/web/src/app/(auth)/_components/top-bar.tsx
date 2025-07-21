import classNames from 'classnames'
import Link from 'next/link'

export const TopBarUnprotected = () => {
  const sectionClasses = 'flex items-center h-full px-4 gap-x-4'

  return (
    <div className='flex justify-between h-16 w-dvw flex-shrink-0 sticky top-0'>
      <div className={classNames(sectionClasses, 'justify-start')}>
        <Link href='/'>
          <span className='text-xl font-black'>Shop</span>
          <span className='text-xl font-black'>Me</span>
          <span className='text-xl font-black underline underline-offset-4 decoration-primary decoration-solid'>
            Alone
          </span>
        </Link>
      </div>
      <div className={classNames(sectionClasses, 'justify-center flex-initial w-full max-w-screen-sm')}></div>
    </div>
  )
}

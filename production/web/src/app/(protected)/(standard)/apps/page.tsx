import { Button } from '@/components/ui/button'
import { AppsList } from './_components/apps-list'

export default function Apps() {
  const yourApps = [
    { id: 'uxjswa', name: 'Zappka', icon: 'zappka.png', running: true },
    { id: 'llsdiy', name: 'Decathlon', icon: 'decathlon.png', running: false },
    { id: 'gllasn', name: 'Rossmann', icon: 'rossmann.jpg', running: false },
    { id: 'uuiaqd', name: 'Lidl Plus', icon: 'lidl.png', running: false },
    { id: 'vihwqd', name: "McDonald's", icon: 'mcdonalds.png', running: true },
    { id: 'oaf8ds', name: 'Kaufland', icon: 'kaufland.png', running: false },
    { id: 'aldfef', name: 'LEROY MERLIN', icon: 'leroy.png', running: false },
    { id: 'pyflca', name: 'Hebe', icon: 'hebe.png', running: false },
    { id: 'sdfois', name: 'Deichmann Footwear', icon: 'deichman.png', running: false },
    { id: 'cmisdf', name: 'Orlen Vitay', icon: 'orlen.png', running: true }
  ]

  return (
    <div className='pl-72 max-lg:pl-0 min-h-full'>
      <main className='row-layout max-w-[1200px] mx-auto'>
        <div className='px-6 flex items-center justify-between gap-4 pt-2 pb-2 max-sm:px-4'>
          <div className='text-3xl max-sm:text-xl font-medium flex-shrink-0'>Installed Apps</div>
          <Button variant='ghost'>Manage</Button>
        </div>
        <AppsList yourApps={yourApps} />
      </main>
    </div>
  )
}

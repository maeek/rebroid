'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Setting } from '../../../_components/settings/setting'

export default function SystemPage() {
  return (
    <div className='pl-72 max-lg:pl-0 min-h-full'>
      <main className='row-layout max-w-[1200px] mx-auto flex h-full justify-between gap-2 flex-col'>
        <section className='py-4 px-4 flex items-center justify-between gap-3 shrink-0 bg-background'>
          <h2 className='text-3xl max-sm:text-xl font-medium shrink-0'>General</h2>
          <Button>Save</Button>
        </section>
        <section className='px-4 w-full flex flex-col gap-4 shrink flex-wrap pb-16'>
          <Section
            orientation='vertical'
            title='APK Search'
            contentClassName='gap-2'
            className='bg-transparent border-0 px-0'
          >
            <Setting label='Use APKPure'>
              <Switch defaultChecked />
            </Setting>
            <Setting label='Check for updates'>
              <Switch defaultChecked />
            </Setting>
            <Setting label='Auto-download app thumbnails'>
              <Switch defaultChecked />
            </Setting>
          </Section>
          <Section
            orientation='vertical'
            title='Docker'
            contentClassName='gap-2'
          >
            <Setting
              label='Docker socket path'
              className='flex-col items-start w-full'
              variant='vertical'
            >
              <Input defaultValue='/var/sock/docker.socket' />
            </Setting>
          </Section>
        </section>
      </main>
    </div>
  )
}

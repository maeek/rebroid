'use client'
import { useDeferredValue, useState } from 'react'
import { IconArrowRight } from '@tabler/icons-react'
import { Argument } from 'classnames'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { AppUpdateAlert } from '@/app/(protected)/_components/viewer/update-alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combo-box'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AppViewerHeading } from '../../../../_components/viewer/heading'
import { ApkProviders, AppDefinition } from '../../../constants'

export default function AppManage({ app }: { app?: AppDefinition }) {
  const [appName, setAppName] = useState(app?.name || '')
  const deferredName = useDeferredValue(appName)

  if (!app) {
    return <div className='p-4'>App not found</div>
  }

  return (
    <div className='pl-72 max-lg:pl-0 min-h-full h-[calc(100vh-4rem)] max-sm:w-full'>
      <div
        className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 z-[-10] pointer-events-none'
        style={{
          backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
          backgroundSize: '1000% 1000%',
          backgroundPosition: 'top left',
          opacity: 0.05
        }}
      />
      <main className='row-layout max-w-[1200px] mx-auto flex h-full justify-between gap-8 max-sm:flex-col max-sm:items-center'>
        <div className='px-6 w-full flex items-start gap-4 pt-2 pb-2 max-sm:px-4 flex-col'>
          <AppViewerHeading app={{ ...app, name: deferredName }}>
            <Button>Save</Button>
          </AppViewerHeading>
          <div className='flex w-full gap-8 max-sm:flex-col max-sm:gap-10'>
            <div className='flex flex-col gap-4 flex-3/5'>
              <Setting
                label='Name'
                className='flex-col items-start w-full'
                variant='vertical'
              >
                <Input
                  value={deferredName}
                  onChange={e => setAppName(e.target.value)}
                />
              </Setting>
              <Setting
                label='Provider'
                className='flex-col items-start w-full'
                variant='vertical'
              >
                <Combobox
                  defaultValue='apk-pure'
                  options={ApkProviders as unknown as Parameters<typeof Combobox>['0']['options']}
                />
              </Setting>
              <Setting
                label='Version'
                className='flex-col items-start w-full'
                variant='vertical'
              >
                <p className='text-secondary-foreground pb-4 flex items-center gap-2'>
                  <span>v{app.version}</span>
                  {typeof app.newVersion === 'string' && (
                    <>
                      <IconArrowRight className='inline size-4 text-secondary-foreground' />
                      <span className='text-primary'>v{app.newVersion}</span>
                    </>
                  )}
                  <span> • Provided by APKPure</span>
                </p>
                <AppUpdateAlert
                  app={app}
                  buttonText='Download new version'
                  description='A new version of this app is available. Click to download it.'
                />
              </Setting>
              <Setting
                label='Container settings'
                className='flex-col items-start w-full'
                variant='vertical'
              >
                <div className='flex flex-col gap-6 w-full'>
                  <div className='flex items-center gap-2 justify-between'>
                    <span className='text-secondary-foreground'>Preserve container data between restarts</span>
                    <Switch defaultChecked />
                  </div>
                  <div className='flex items-center gap-2 justify-between'>
                    <span className='text-secondary-foreground'>Provide internet access to the container</span>
                    <Switch defaultChecked />
                  </div>
                  <div className='flex items-center gap-2 justify-between'>
                    <span className='text-secondary-foreground'>Container keepalive</span>
                    <Input
                      defaultValue='1h'
                      className='w-40'
                      placeholder='1h'
                      type='text'
                    />
                  </div>
                </div>
              </Setting>
            </div>
            <div className='shrink-0 flex flex-col gap-4 grow-0 flex-2/5 items-center'>
              <Setting
                label='Icon'
                className='flex-col items-start w-full'
                variant='vertical'
              >
                <p className='text-secondary-foreground text-sm pb-4'>
                  Drop the image in the container below or click <b className='text-primary cursor-pointer'>here</b> to
                  upload a photo
                </p>
                <div className='flex flex-col items-center gap-6 w-full'>
                  <div
                    className='shrink-0 size-72 bg-slate-400/20 flex items-center justify-center transition-all -z-[1]'
                    style={{
                      clipPath: `url(#squircleClip)`,
                      backgroundImage: `url("https://static.suchanecki.me/${app?.icon}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                </div>
              </Setting>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

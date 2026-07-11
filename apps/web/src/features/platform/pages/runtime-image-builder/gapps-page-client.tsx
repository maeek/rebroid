'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { useGappsBuildController } from './hooks/use-gapps-build-controller'
import { GappsBuildConfiguration } from './sections/gapps-build-configuration'
import { GappsBuildProgress } from './sections/gapps-build-progress'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/shared/contracts/platform-image-build'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

interface RuntimeGappsImageBuilderPageClientProps {
  presetResponse: GappsBuildPresetsResponse
  jobs: ContainerImageBuildJob[]
  initialSettings: OrchestratorUiSettings
  uploadedApkId?: string
}

export const RuntimeGappsImageBuilderPageClient = (props: RuntimeGappsImageBuilderPageClientProps) => {
  const controller = useGappsBuildController(props)

  return (
    <StandardPage>
      <PlatformPageHeader
        title='Build Google Play image'
        description='Patch an official ReDroid image with a locally built, pinned MindTheGapps payload.'
        breadcrumbRoot={{ label: 'Runtime', href: '/runtime/images' }}
        parent={{ label: 'Images', href: '/runtime/images' }}
        actions={
          <Button
            asChild
            variant='outline'
          >
            <Link href='/runtime/images/build/custom'>Custom builder</Link>
          </Button>
        }
      />

      <div className='mx-auto w-full max-w-7xl px-6 pb-12 max-sm:px-4'>
        <div className='grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)] xl:gap-14'>
          <GappsBuildConfiguration
            controller={controller}
            resources={props.presetResponse.resources}
          />
          <GappsBuildProgress controller={controller} />
        </div>
      </div>
    </StandardPage>
  )
}

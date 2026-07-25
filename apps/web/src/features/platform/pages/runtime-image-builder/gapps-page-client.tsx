'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { useGappsBuildController } from './hooks/use-gapps-build-controller'
import { GappsBuildConfiguration } from './sections/gapps-build-configuration'
import { GappsBuildProgress } from './sections/gapps-build-progress'
import type { ContainerImageBuildJob, GappsBuildPresetsResponse } from '@/shared/contracts/platform'
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
      <PageHeader
        section={{ label: 'Runtime' }}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
        title='Build Google Play image'
        description='Patch an official ReDroid image with a locally built, pinned MindTheGapps payload.'
        actions={
          <Button
            asChild
            variant='outline'
          >
            <Link href='/runtime/images/build/custom'>Custom builder</Link>
          </Button>
        }
      />

      <PageContent>
        <div className='grid w-full gap-10 lg:grid-cols-[minmax(20rem,2fr)_minmax(20rem,3fr)] xl:gap-14'>
          <GappsBuildConfiguration
            controller={controller}
            resources={props.presetResponse.resources}
          />
          <GappsBuildProgress controller={controller} />
        </div>
      </PageContent>
    </StandardPage>
  )
}

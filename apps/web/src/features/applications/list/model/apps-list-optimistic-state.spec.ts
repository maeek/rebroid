import { describe, expect, it } from 'vitest'
import { optimisticRemovingApp, optimisticStartingApp, optimisticStoppingApp } from './apps-list-optimistic-state'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = {
  id: 'app-1',
  name: 'Demo',
  running: true,
  status: 'running',
  lifecycleStage: 'running',
  statusMessage: null,
  statusDetail: null
} as unknown as AppDefinition

describe('apps list optimistic state', () => {
  it('marks an app as starting', () => {
    expect(optimisticStartingApp(app)).toMatchObject({
      id: 'app-1',
      running: false,
      status: 'provisioning',
      lifecycleStage: 'container_starting',
      statusMessage: 'Starting app.',
      statusDetail: {
        code: 'container_starting',
        title: 'Starting container',
        tone: 'progress'
      }
    })
  })

  it('marks an app as stopping', () => {
    expect(optimisticStoppingApp(app)).toMatchObject({
      id: 'app-1',
      running: false,
      status: 'stopped',
      lifecycleStage: 'stopping',
      statusMessage: 'Stopping app.',
      statusDetail: {
        code: 'stopping',
        title: 'Stopping app',
        tone: 'progress'
      }
    })
  })

  it('marks an app as removing', () => {
    expect(optimisticRemovingApp(app)).toMatchObject({
      id: 'app-1',
      status: 'removing',
      lifecycleStage: 'removing',
      statusMessage: 'Removing app.',
      statusDetail: {
        code: 'removing',
        title: 'Removing app',
        tone: 'progress'
      }
    })
  })
})

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const protectedRoot = resolve(process.cwd(), 'src/app/(protected)')

const renderableRoutes = [
  '(standard)/app/[slug]',
  '(standard)/app/[slug]/manage',
  '(standard)/app/[slug]/manage/profiles',
  '(standard)/apps',
  '(standard)/apps/create',
  '(standard)/automations',
  '(standard)/automations/[id]',
  '(standard)/automations/[id]/traces',
  '(standard)/automations/create',
  '(standard)/automations/triggers',
  '(standard)/platform',
  '(standard)/platform/ai',
  '(standard)/platform/ai/[providerId]',
  '(standard)/platform/features',
  '(standard)/platform/runtime',
  '(standard)/platform/scheduler',
  '(standard)/platform/services',
  '(standard)/platform/services/display-sessions',
  '(standard)/preferences/general',
  '(standard)/runtime/containers',
  '(standard)/runtime/containers/[id]',
  '(standard)/runtime/images',
  '(standard)/runtime/images/[id]',
  '(standard)/runtime/images/build',
  '(standard)/runtime/images/build/custom',
  '(standard)/runtime/networks',
  '(standard)/runtime/networks/[id]',
  '(standard)/security/audit-log',
  '(standard)/security/groups',
  '(standard)/security/groups/[id]',
  '(standard)/security/network-policies',
  '(standard)/security/users',
  '(standard)/security/users/[id]',
  '(standard)/system/resources',
  'account/required-password-change',
  'viewer/apps/[id]'
] as const

const dataGridLoadingOwners = [
  'features/automations/automations-page/automation-page-skeletons.tsx',
  'features/platform/components/platform-page-skeletons/platform-container-detail-page-skeleton.tsx',
  'features/platform/components/platform-page-skeletons/platform-resource-detail-page-skeleton.tsx',
  'features/platform/services/services-page-skeleton.tsx',
  'features/settings/activity/activity-page-skeleton.tsx',
  'features/settings/casting/pages/platform-display-sessions/page-skeleton.tsx',
  'features/settings/orchestrator/ai-providers/ai-provider-page-skeletons.tsx',
  'features/settings/orchestrator/firewall-settings-page-loading.tsx',
  'features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-page-skeleton.tsx',
  'features/settings/users/user-page-skeletons.tsx'
] as const

describe('protected route loading contract', () => {
  it('covers all 36 renderable routes with thin feature-owned loaders', () => {
    expect(renderableRoutes).toHaveLength(36)

    for (const route of renderableRoutes) {
      const pagePath = resolve(protectedRoot, route, 'page.tsx')
      const loadingPath = resolve(protectedRoot, route, 'loading.tsx')

      expect(existsSync(pagePath), `${route} page`).toBe(true)
      expect(existsSync(loadingPath), `${route} loading state`).toBe(true)

      const source = readFileSync(loadingPath, 'utf8').trim()
      expect(source, `${route} loader`).toMatch(/^export \{ [A-Za-z0-9_]+ as default \} from '@\/features\/[^']+'$/)
    }
  })

  it('keeps the legacy redirect as the only loader-free protected route', () => {
    const route = '(standard)/platform/display-sessions'

    expect(existsSync(resolve(protectedRoot, route, 'page.tsx'))).toBe(true)
    expect(existsSync(resolve(protectedRoot, route, 'loading.tsx'))).toBe(false)
    expect(existsSync(resolve(protectedRoot, '(standard)/app/[slug]/details/loading.tsx'))).toBe(false)
  })

  it('constructs loading DataGrid functions inside client boundaries', () => {
    for (const owner of dataGridLoadingOwners) {
      const source = readFileSync(resolve(process.cwd(), 'src', owner), 'utf8')
      expect(source, owner).toMatch(/^'use client'/)
    }
  })
})

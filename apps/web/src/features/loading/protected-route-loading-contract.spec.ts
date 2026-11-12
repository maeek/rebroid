import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const protectedRoot = resolve(process.cwd(), 'src/app/(protected)')

const renderableRoutes = [
  '(standard)/app/[slug]',
  '(standard)/apps',
  '(standard)/apps/create',
  '(standard)/automations',
  '(standard)/automations/[id]',
  '(standard)/automations/[id]/traces',
  '(standard)/automations/create',
  '(standard)/automations/triggers',
  '(standard)/platform/(overview)',
  '(standard)/platform/ai/(providers)',
  '(standard)/platform/ai/[providerId]',
  '(standard)/platform/casting',
  '(standard)/platform/features',
  '(standard)/platform/console',
  '(standard)/platform/runtime',
  '(standard)/platform/scheduler',
  '(standard)/platform/services/(connections)',
  '(standard)/preferences/general',
  '(standard)/preferences/security',
  '(standard)/runtime/containers',
  '(standard)/runtime/containers/[id]',
  '(standard)/runtime/docker',
  '(standard)/runtime/images',
  '(standard)/runtime/images/[id]',
  '(standard)/runtime/images/build',
  '(standard)/runtime/images/build/custom',
  '(standard)/runtime/networks',
  '(standard)/runtime/networks/[id]',
  '(standard)/security/audit-log',
  '(standard)/security/firewall',
  '(standard)/security/groups',
  '(standard)/security/groups/[id]',
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
  'features/platform/pages/firewall/page-loading.tsx',
  'features/platform/services/services-page-skeleton.tsx',
  'features/settings/activity/activity-page-skeleton.tsx',
  'features/settings/casting/pages/casting/page-skeleton.tsx',
  'features/settings/orchestrator/ai-providers/ai-provider-page-skeletons.tsx',
  'features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-page-skeleton.tsx',
  'features/settings/users/user-page-skeletons.tsx'
] as const

describe('protected route loading contract', () => {
  it('covers every protected route with a thin feature-owned loader', () => {
    const discoveredRoutes = readdirSync(protectedRoot, { recursive: true, encoding: 'utf8' })
      .filter(path => path.endsWith('/page.tsx'))
      .map(path => path.slice(0, -'/page.tsx'.length))
    expect(discoveredRoutes.sort()).toEqual([...renderableRoutes].sort())

    for (const route of renderableRoutes) {
      const pagePath = resolve(protectedRoot, route, 'page.tsx')
      const loadingPath = resolve(protectedRoot, route, 'loading.tsx')

      expect(existsSync(pagePath), `${route} page`).toBe(true)
      expect(existsSync(loadingPath), `${route} loading state`).toBe(true)

      const source = readFileSync(loadingPath, 'utf8').trim()
      if (route === '(standard)/app/[slug]') {
        expect(source).toContain('<AppPageSkeleton activity={<AppActivityLoading />} />')
        expect(source).not.toContain('className')
      } else {
        expect(source, `${route} loader`).toMatch(/^export \{ [A-Za-z0-9_]+ as default \} from '@\/features\/[^']+'$/)
      }
    }
  })

  it('scopes platform loaders to their destination instead of inheriting an index page fallback', () => {
    const platformRoutes = renderableRoutes.filter(route => route.startsWith('(standard)/platform/'))

    for (const route of platformRoutes) {
      const segments = route.split('/')
      for (let depth = 2; depth < segments.length; depth++) {
        const ancestor = segments.slice(0, depth).join('/')
        expect(existsSync(resolve(protectedRoot, ancestor, 'loading.tsx')), `${route} inherits ${ancestor}`).toBe(false)
      }
    }

    const layout = readFileSync(resolve(protectedRoot, '(standard)/platform/layout.tsx'), 'utf8')
    expect(layout).toContain('await requireAdmin()')
  })

  it('constructs loading DataGrid functions inside client boundaries', () => {
    for (const owner of dataGridLoadingOwners) {
      const source = readFileSync(resolve(process.cwd(), 'src', owner), 'utf8')
      expect(source, owner).toMatch(/^'use client'/)
    }
  })
})

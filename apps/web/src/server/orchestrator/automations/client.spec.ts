import { describe, expect, it, vi } from 'vitest'
import { emptyRequest, jsonRequest } from '../request'
import { orchestratorAutomationsClient as client } from './client'
vi.mock('../request', () => ({
  emptyRequest: vi.fn(),
  jsonRequest: vi.fn(),
  request: vi.fn(),
  responseRequest: vi.fn()
}))
describe('automation owner boundary', () => {
  it('preserves the session owner in both grid queries', async () => {
    const input = { ownerUserId: 'victim', q: 'login' }
    await client.listGrid('actor', input)
    await client.listTriggersGrid('actor', input)
    for (const [path] of vi.mocked(emptyRequest).mock.calls) {
      expect(path).toContain('ownerUserId=actor')
      expect(path).not.toContain('victim')
      expect(path).toContain('q=login')
    }
  })
  it('preserves the trusted owner in creation and run bodies', async () => {
    await client.create('actor', { ownerUserId: 'victim', yaml: 'test' } as never)
    await client.run('actor', 'workflow', { ownerUserId: 'victim', targetApplicationId: 'app' } as never)
    await client.createTrigger('actor', { ownerUserId: 'victim' } as never)
    await client.runAdHocAi('actor', { ownerUserId: 'victim' } as never)
    for (const [, , body] of vi.mocked(jsonRequest).mock.calls) expect(body).toMatchObject({ ownerUserId: 'actor' })
  })
})

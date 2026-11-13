import { AppStartupTimingsSection } from './app-startup-timings'

const start = Date.parse('2026-11-13T00:59:27.328Z')
export const StartupTimingsPreview = () => (
  <main className='mx-auto grid max-w-3xl gap-6 p-6'>
    <AppStartupTimingsSection
      timings={{
        baseline: start,
        firstFrameAt: start + 36_340,
        milestones: [
          { label: 'Container creation started', at: start },
          { label: 'Container created', at: start + 88 },
          { label: 'Container start requested', at: start + 95 },
          { label: 'Container started', at: start + 695 },
          { label: 'Android ready', at: start + 23_672 },
          { label: 'Display network attached', at: start + 28_351 },
          { label: 'ADB ready', at: start + 30_000 },
          { label: 'App ready', at: start + 30_010 },
          { label: 'First frame in this tab', at: start + 36_340 }
        ]
      }}
      viewerStartup={{ requestToConnectMs: 2300, connectToFrameMs: 1600 }}
    />
    <AppStartupTimingsSection loading />
  </main>
)

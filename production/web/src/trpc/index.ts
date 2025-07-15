import { filesRouter } from './files'
import { systemRouter } from './system'
import { router } from './trpc'

export const appRouter = router({
  files: filesRouter,
  system: systemRouter
})

export type AppRouter = typeof appRouter

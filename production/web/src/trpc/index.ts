import { systemRouter } from './system'
import { router } from './trpc'

export const appRouter = router({
  system: systemRouter
})

export type AppRouter = typeof appRouter

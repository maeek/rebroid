import { z } from 'zod'
import { files } from '@/server/files'
import { protectedProcedure, router } from '../trpc'

export const filesRouter = router({
  filesListItems: protectedProcedure.input(z.string()).query(async ({ input }) => files.list(input)),
  createFolder: protectedProcedure
    .input(z.object({ name: z.string(), path: z.string() }))
    .mutation(async ({ input }) => files.createFolder(input.name, input.path)),
  remove: protectedProcedure.input(z.array(z.string())).mutation(async ({ input }) => files.remove(input))
})

export type FilesRouter = typeof filesRouter

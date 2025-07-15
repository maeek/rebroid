import { initTRPC, TRPCError } from '@trpc/server'
import { Context } from './context'

export const t = initTRPC.context<Context>().create()
export const router = t.router

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user }
    }
  })
})

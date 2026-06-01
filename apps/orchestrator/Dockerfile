# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/orchestrator/package.json apps/orchestrator/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter rebroid-orchestrator... --frozen-lockfile
RUN pnpm --filter rebroid-orchestrator deploy --prod /out

FROM base AS builder
WORKDIR /workspace/apps/orchestrator
COPY --from=deps /workspace /workspace
COPY apps/orchestrator ./
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /out ./
COPY --from=builder /workspace/apps/orchestrator/dist ./dist
COPY --chmod=755 apps/orchestrator/docker-entrypoint.sh /usr/local/bin/rebroid-orchestrator-entrypoint
RUN mkdir -p /app/data /app/uploads /app/secrets /run/rebroid-firewall && chown -R node:node /app /run/rebroid-firewall
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4100/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["rebroid-orchestrator-entrypoint"]
CMD ["node", "dist/src/main.js"]

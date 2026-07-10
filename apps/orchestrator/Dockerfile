# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/automation-core/package.json packages/automation-core/package.json
COPY packages/application-core/package.json packages/application-core/package.json
COPY packages/firewall-policy-core/package.json packages/firewall-policy-core/package.json
COPY packages/vision-core/package.json packages/vision-core/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter rebroid-orchestrator... --frozen-lockfile

FROM base AS builder
COPY --from=deps /workspace /workspace
COPY packages/ai-core /workspace/packages/ai-core
COPY packages/automation-core /workspace/packages/automation-core
COPY packages/application-core /workspace/packages/application-core
COPY packages/firewall-policy-core /workspace/packages/firewall-policy-core
COPY packages/vision-core /workspace/packages/vision-core
COPY apps/orchestrator /workspace/apps/orchestrator
RUN pnpm --filter @rebroid/application-core --filter @rebroid/ai-core --filter @rebroid/automation-core --filter @rebroid/firewall-policy-core --filter @rebroid/vision-core build
WORKDIR /workspace/apps/orchestrator
RUN pnpm build
WORKDIR /workspace
RUN pnpm --filter rebroid-orchestrator deploy --prod /out

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out ./
COPY --from=builder /workspace/apps/orchestrator/dist ./dist
COPY apps/gapps-patcher /app/gapps-patcher
COPY --chmod=755 apps/orchestrator/docker-entrypoint.sh /usr/local/bin/rebroid-orchestrator-entrypoint
RUN mkdir -p /app/data /app/uploads /app/secrets /run/rebroid-firewall && chown -R node:node /app /run/rebroid-firewall
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4100/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["rebroid-orchestrator-entrypoint"]
CMD ["node", "dist/src/main.js"]

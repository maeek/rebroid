# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.package.json ./
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY packages/automation-core/package.json packages/automation-core/package.json
COPY packages/android-application-core/package.json packages/android-application-core/package.json
COPY packages/display-sidecar-contracts/package.json packages/display-sidecar-contracts/package.json
COPY packages/firewall-policy-core/package.json packages/firewall-policy-core/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter rebroid-orchestrator... --frozen-lockfile

FROM deps AS builder
COPY packages/automation-core /workspace/packages/automation-core
COPY packages/android-application-core /workspace/packages/android-application-core
COPY packages/display-sidecar-contracts /workspace/packages/display-sidecar-contracts
COPY packages/firewall-policy-core /workspace/packages/firewall-policy-core
RUN pnpm --filter @rebroid/android-application-core --filter @rebroid/automation-core --filter @rebroid/firewall-policy-core build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm --filter rebroid-orchestrator deploy --prod /out
COPY apps/orchestrator /workspace/apps/orchestrator
WORKDIR /workspace/apps/orchestrator
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
COPY --from=builder /workspace/apps/orchestrator/dist/src ./dist/src
COPY apps/gapps-patcher/Dockerfile apps/gapps-patcher/run.sh /app/gapps-patcher/
COPY --chmod=755 apps/orchestrator/docker-entrypoint.sh /usr/local/bin/rebroid-orchestrator-entrypoint
RUN mkdir -p /app/data /app/uploads /app/secrets /run/rebroid-firewall \
  && chown node:node /app/data /app/uploads /app/secrets /run/rebroid-firewall
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4100/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["rebroid-orchestrator-entrypoint"]
CMD ["node", "dist/src/main.js"]

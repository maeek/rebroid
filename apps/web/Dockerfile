# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/automation-core/package.json packages/automation-core/package.json
COPY packages/android-application-core/package.json packages/android-application-core/package.json
COPY packages/firewall-policy-core/package.json packages/firewall-policy-core/package.json
COPY packages/orchestrator-contracts/package.json packages/orchestrator-contracts/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter rebroid-web... --frozen-lockfile

FROM base AS builder
WORKDIR /workspace/apps/web
RUN apk add --no-cache libc6-compat
ARG NEXT_PROXY_CLIENT_MAX_BODY_SIZE=512mb
ARG DISPLAY_SIDECAR_INTERNAL_BASE_URL=http://rebroid-display-sidecar:8000
ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE}
ENV DISPLAY_SIDECAR_INTERNAL_BASE_URL=${DISPLAY_SIDECAR_INTERNAL_BASE_URL}
COPY --from=deps /workspace /workspace
COPY packages/automation-core /workspace/packages/automation-core
COPY packages/android-application-core /workspace/packages/android-application-core
COPY packages/firewall-policy-core /workspace/packages/firewall-policy-core
COPY packages/orchestrator-contracts /workspace/packages/orchestrator-contracts
COPY apps/web ./
RUN pnpm --filter @rebroid/android-application-core --filter @rebroid/automation-core --filter @rebroid/firewall-policy-core build
# The deps stage injects package.json-only workspace snapshots. Point the
# builder at the complete package directories after their dist output exists.
RUN rm -rf node_modules/@rebroid \
  && mkdir -p node_modules/@rebroid \
  && ln -s /workspace/packages/android-application-core node_modules/@rebroid/android-application-core \
  && ln -s /workspace/packages/automation-core node_modules/@rebroid/automation-core \
  && ln -s /workspace/packages/firewall-policy-core node_modules/@rebroid/firewall-policy-core \
  && ln -s /workspace/packages/orchestrator-contracts node_modules/@rebroid/orchestrator-contracts
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=127.0.0.1
ENV PORT=3443
ENV NEXT_INTERNAL_PORT=3101
ENV NEXT_SERVER_PATH=apps/web/server.js
ENV ORCHESTRATOR_API_URL=http://orchestrator:4100
ENV DISPLAY_SIDECAR_INTERNAL_BASE_URL=http://rebroid-display-sidecar:8000
ENV REBROID_TLS_HOSTS=localhost,127.0.0.1
RUN apk add --no-cache libc6-compat openssl su-exec
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /workspace/apps/web/rebroid-proxy-server.mjs ./rebroid-proxy-server.mjs
COPY --chmod=755 apps/web/docker-entrypoint.sh /usr/local/bin/rebroid-web-entrypoint
RUN mkdir -p /app/data /app/secrets /data/secrets && chown -R node:node /app /data
EXPOSE 3443
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';fetch('https://127.0.0.1:3443/login').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["rebroid-web-entrypoint"]
CMD ["node", "rebroid-proxy-server.mjs"]

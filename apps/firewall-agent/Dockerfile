FROM node:24-alpine AS builder
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.package.json ./
COPY apps/firewall-agent/package.json apps/firewall-agent/package.json
COPY packages/firewall-policy-core/package.json packages/firewall-policy-core/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter rebroid-firewall-agent... --frozen-lockfile
COPY packages/firewall-policy-core /workspace/packages/firewall-policy-core
RUN pnpm --filter @rebroid/firewall-policy-core build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm --filter rebroid-firewall-agent deploy --prod /out
COPY apps/firewall-agent/tsconfig.json /workspace/apps/firewall-agent/tsconfig.json
COPY apps/firewall-agent/src /workspace/apps/firewall-agent/src
WORKDIR /workspace/apps/firewall-agent
RUN pnpm build

FROM node:24-alpine
RUN apk add --no-cache iptables ip6tables nftables curl
WORKDIR /app
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
COPY --from=builder /workspace/apps/firewall-agent/dist ./dist
RUN mkdir -p /run/rebroid-firewall
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD curl --fail --unix-socket /run/rebroid-firewall/agent.sock http://localhost/v1/health || exit 1
CMD ["node", "dist/index.js"]

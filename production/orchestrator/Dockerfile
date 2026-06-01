# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/rebroid-orchestrator-entrypoint
RUN mkdir -p /app/data /app/uploads /app/secrets /run/rebroid-firewall && chown -R node:node /app /run/rebroid-firewall
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4100/health',{headers:{'x-orchestrator-secret':process.env.ORCHESTRATOR_SHARED_SECRET||''}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["rebroid-orchestrator-entrypoint"]
CMD ["node", "dist/src/main.js"]

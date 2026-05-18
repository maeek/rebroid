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
RUN apk add --no-cache docker-cli iptables ip6tables
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/rebroid-orchestrator-entrypoint
RUN mkdir -p /app/data /app/uploads /app/secrets && chown -R node:node /app
USER node
EXPOSE 4100
ENTRYPOINT ["rebroid-orchestrator-entrypoint"]
CMD ["node", "dist/src/main.js"]

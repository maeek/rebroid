# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
RUN apk add --no-cache libc6-compat
ARG NEXT_PROXY_CLIENT_MAX_BODY_SIZE=4096mb
ARG WS_SCRCPY_INTERNAL_BASE_URL=http://sma-ws-scrcpy:8000
ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE}
ENV WS_SCRCPY_INTERNAL_BASE_URL=${WS_SCRCPY_INTERNAL_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
ENV ORCHESTRATOR_API_URL=http://orchestrator:4100
RUN apk add --no-cache libc6-compat
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/shop-me-alone-web-entrypoint
RUN mkdir -p /app/data /app/secrets && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["shop-me-alone-web-entrypoint"]
CMD ["node", "server.js"]

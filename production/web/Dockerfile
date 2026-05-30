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
ARG NEXT_PROXY_CLIENT_MAX_BODY_SIZE=512mb
ARG DISPLAY_SIDECAR_INTERNAL_BASE_URL=http://rebroid-display-sidecar:8000
ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE}
ENV DISPLAY_SIDECAR_INTERNAL_BASE_URL=${DISPLAY_SIDECAR_INTERNAL_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=127.0.0.1
ENV PORT=3443
ENV NEXT_INTERNAL_PORT=3101
ENV ORCHESTRATOR_API_URL=http://orchestrator:4100
ENV DISPLAY_SIDECAR_INTERNAL_BASE_URL=http://rebroid-display-sidecar:8000
ENV REBROID_TLS_HOSTS=localhost,127.0.0.1
RUN apk add --no-cache libc6-compat openssl su-exec
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/rebroid-proxy-server.mjs ./rebroid-proxy-server.mjs
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/rebroid-web-entrypoint
RUN mkdir -p /app/data /app/secrets /data/secrets && chown -R node:node /app /data
EXPOSE 3443
ENTRYPOINT ["rebroid-web-entrypoint"]
CMD ["node", "rebroid-proxy-server.mjs"]

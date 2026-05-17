FROM node:24-alpine AS deps
WORKDIR /app
COPY orchestrator/package*.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY orchestrator .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache docker-cli iptables ip6tables
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY orchestrator/package*.json ./
COPY ws-scrcpy-sidecar /app/ws-scrcpy-sidecar
RUN mkdir -p /app/data /app/uploads
EXPOSE 4100
CMD ["node", "dist/main.js"]

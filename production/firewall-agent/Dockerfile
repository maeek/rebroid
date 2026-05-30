FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
RUN apk add --no-cache iptables ip6tables nftables curl
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/dist ./dist
RUN mkdir -p /run/rebroid-firewall
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD curl --fail --unix-socket /run/rebroid-firewall/agent.sock http://localhost/v1/health || exit 1
CMD ["node", "dist/index.js"]

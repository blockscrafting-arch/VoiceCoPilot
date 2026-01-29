# VoiceCoPilot Web — production serve. Build context = repo root.
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm i --frozen-lockfile
RUN pnpm --filter @voicecopilot/web build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 4173
# Railway sets PORT at runtime. serve is more reliable than vite preview for proxy/health checks.
CMD ["sh", "-c", "npx serve -s dist -l ${PORT:-4173}"]

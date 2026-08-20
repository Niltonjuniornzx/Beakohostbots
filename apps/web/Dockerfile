FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
RUN for attempt in 1 2 3 4 5; do \
      pnpm install --filter @beako/web... --no-frozen-lockfile && exit 0; \
      echo "Falha ao baixar dependencias (tentativa ${attempt}/5). Tentando novamente..."; \
      sleep $((attempt * 5)); \
    done; exit 1

FROM deps AS builder
COPY apps/web apps/web
RUN pnpm --filter @beako/web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

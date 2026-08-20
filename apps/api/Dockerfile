FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS builder
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/database/prisma packages/database/prisma
RUN for attempt in 1 2 3 4 5; do \
      pnpm install --filter @beako/api... --no-frozen-lockfile && exit 0; \
      echo "Falha ao baixar dependencias (tentativa ${attempt}/5). Tentando novamente..."; \
      sleep $((attempt * 5)); \
    done; exit 1
COPY apps/api apps/api
RUN pnpm --filter @beako/database generate && pnpm --filter @beako/api build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
RUN addgroup --system --gid 1001 beako && adduser --system --uid 1001 beako
COPY --from=builder --chown=beako:beako /app/node_modules ./node_modules
COPY --from=builder --chown=beako:beako /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=beako:beako /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=beako:beako /app/packages/database/prisma ./packages/database/prisma
USER beako
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema packages/database/prisma/schema.prisma && node apps/api/dist/main.js"]

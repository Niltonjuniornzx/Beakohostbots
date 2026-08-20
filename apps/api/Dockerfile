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
RUN pnpm install --filter @beako/api... --no-frozen-lockfile
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
USER beako
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

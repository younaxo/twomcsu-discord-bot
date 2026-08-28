# Собирается из корня монорепозитория: docker build -f apps/bot/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/bot/package.json apps/bot/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/bot apps/bot
RUN pnpm --filter @twomcsu/db generate
# packages/db и packages/shared собираются в реальный JS: в рантайме бот запускается
# обычным node, который (в отличие от tsx/webpack) не умеет исполнять .ts-исходники напрямую.
RUN pnpm --filter @twomcsu/shared build
RUN pnpm --filter @twomcsu/db build
RUN pnpm --filter @twomcsu/bot build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=build --chown=node:node /repo/packages/db ./packages/db
COPY --from=build --chown=node:node /repo/apps/bot/dist ./apps/bot/dist
COPY --from=build --chown=node:node /repo/apps/bot/package.json ./apps/bot/package.json
# pnpm симлинкует прямые зависимости приложения в его собственный node_modules, а не только
# в корневой — без этой папки discord.js/express/pino/zod не резолвятся в рантайме.
COPY --from=build --chown=node:node /repo/apps/bot/node_modules ./apps/bot/node_modules

# node:20-alpine уже содержит непривилегированного пользователя node (uid 1000) — не запускаем
# процесс от root без необходимости.
USER node
WORKDIR /repo/apps/bot
EXPOSE 3001
CMD ["node", "dist/index.js"]

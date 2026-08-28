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
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/bot apps/bot
RUN pnpm --filter @twomcsu/db generate
RUN pnpm --filter @twomcsu/bot build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/apps/bot/dist ./apps/bot/dist
COPY --from=build /repo/apps/bot/package.json ./apps/bot/package.json

WORKDIR /repo/apps/bot
EXPOSE 3001
CMD ["node", "dist/index.js"]

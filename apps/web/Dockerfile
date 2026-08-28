# Собирается из корня монорепозитория: docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/web apps/web
RUN pnpm --filter @twomcsu/db generate

# next build импортирует route-хендлеры для сбора метаданных, а те валидируют env.ts на уровне
# модуля — реальные секреты в момент сборки образа ещё не нужны и недоступны (.env подключается
# только в рантайме через docker-compose), поэтому передаём заглушки, проходящие валидацию по форме.
ENV DISCORD_CLIENT_ID=build-time-placeholder \
    DISCORD_CLIENT_SECRET=build-time-placeholder \
    DISCORD_OAUTH_REDIRECT_URI=https://bot.twomc.su/api/auth/callback/discord \
    DISCORD_GUILD_ID=0000000000000000 \
    DISCORD_PANEL_ACCESS_ROLE_ID=0000000000000000 \
    DATABASE_URL=postgresql://user:pass@localhost:5432/db \
    SESSION_SECRET=00000000000000000000000000000000000000000000000000000000000000 \
    ENCRYPTION_KEY=00000000000000000000000000000000000000000000000000000000000000 \
    INTERNAL_API_SECRET=0000000000000000 \
    INTERNAL_API_URL=http://localhost:3001 \
    APP_URL=https://bot.twomc.su
RUN pnpm --filter @twomcsu/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

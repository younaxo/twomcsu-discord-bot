# TWOMC.SU Discord-бот и веб-панель

Монорепозиторий: Discord-бот (тикет-система) + веб-панель управления `bot.twomc.su`.

## Структура

```
apps/bot      — Discord-бот (discord.js) + внутреннее HTTP API для веб-панели
apps/web      — веб-панель (Next.js App Router)
packages/db   — схема Prisma и клиент БД, общий для бота и панели
packages/shared — Zod-схемы, константы и утилиты, общие для бота и панели
nginx/        — конфигурация reverse proxy для bot.twomc.su
scripts/      — деплой и вспомогательные скрипты
```

## Архитектура доступа

Веб-панель никогда не создаёт и не изменяет Discord-каналы напрямую — все действия с
тикетами и публикация панелей идут через внутреннее HTTP API бота (`apps/bot/src/internalApi`),
которое слушает только внутри docker-сети и дополнительно защищено секретом
`INTERNAL_API_SECRET`. Проверка доступа к панели (членство в сервере + роль) тоже всегда
идёт через это API — напрямую к Discord, без доверия данным из cookie/браузера.

## Требования

- Node.js 20+, pnpm 9+ (`corepack enable`)
- Docker + Docker Compose v2 (для production и для локального Postgres)
- Discord-приложение с ботом на сервере (guild)

## Discord-приложение: настройка

1. **Bot → Privileged Gateway Intents**: включите **Server Members Intent** и
   **Message Content Intent**. Без первого не будет работать список участников сервера
   и дата вступления, без второго — текст сообщений в транскриптах тикетов. Это единственное
   действие, которое нужно сделать руками в Developer Portal — через API это не включается.
2. **OAuth2 → Redirects**: добавьте `https://bot.twomc.su/api/auth/callback/discord`.
3. **OAuth2 → Scopes** для приглашения бота на сервер: `bot`, `applications.commands`.
   **Bot Permissions**: Manage Channels, Manage Roles (только в пределах категории тикетов),
   Send Messages, Embed Links, Attach Files, Read Message History, View Channels.
4. Роль `DISCORD_PANEL_ACCESS_ROLE_ID` должна быть выдана администраторам, которым нужен
   доступ к панели.

## Модель тикетов: приватные ветки

Новые тикеты создаются как приватная ветка (`PrivateThread`) внутри родительского текстового
канала категории — отдельный канал на тикет больше не создаётся.

- В настройках категории (веб-панель → «Категории») обязательно укажите **родительский канал**.
  Без него создание тикетов в категории заблокировано с понятной ошибкой — старые категории,
  перенесённые из прошлой версии, тоже требуют этой настройки.
- У приватной ветки нет собственных permission overwrites — доступ строится через членство:
  бот добавляет автора и сотрудника, который взял тикет, напрямую в ветку. Чтобы **вся** роль
  поддержки видела приватные ветки автоматически (а не только тех, кого добавили лично), выдайте
  этой роли право **«Управлять ветками» (Manage Threads)** и **«Просмотр канала»** на родительском
  канале — это делается один раз в настройках канала в Discord, не в панели.
- Закрытие тикета блокирует (`Locked`) и архивирует (`Archived`) ветку — сообщения писать нельзя,
  но история остаётся. Повторное открытие снимает блокировку и разархивирует ту же ветку.
- Тикеты, созданные до этого обновления (отдельные каналы), продолжают работать по старой модели
  и никуда не делись — они просто не создаются заново для новых обращений.

## Переменные окружения

См. [.env.example](.env.example) — там же комментарии на русском для каждого значения.
Скопируйте в `.env` и заполните реальными значениями. Файл `.env` никогда не коммитится.

Сгенерировать секреты:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Нужно сгенерировать так `SESSION_SECRET`, `ENCRYPTION_KEY` и `INTERNAL_API_SECRET`.

## Локальный запуск

```bash
corepack enable
pnpm install

# поднять локальный Postgres
docker run -d --name twomcsu-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=twomcsu_bot -p 5432:5432 postgres:16-alpine

# .env с DATABASE_URL=postgresql://postgres:devpass@localhost:5432/twomcsu_bot
cp .env.example .env

pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed

pnpm dev:bot   # в одном терминале
pnpm dev:web   # в другом
```

Панель откроется на `http://localhost:3000`. Для локальной разработки OAuth redirect в
Discord-приложении должен указывать на `http://localhost:3000/api/auth/callback/discord`
(добавьте его как дополнительный, не убирая production redirect).

## Команды бота

Регистрируются на конкретный guild (мгновенно, без часа ожидания глобальной регистрации):

```bash
pnpm --filter @twomcsu/bot deploy-commands
```

Доступные команды: `/ping`, `/status`, `/help`.

## Миграции базы данных

```bash
pnpm db:migrate:dev     # локально, создаёт новую миграцию по изменениям schema.prisma
pnpm db:migrate         # production, применяет уже существующие миграции (prisma migrate deploy)
```

Миграции лежат в `packages/db/prisma/migrations` и коммитятся в репозиторий — руками их не
редактируем.

Сервис `migrate` в `docker-compose.yml` собирается отдельным профилем: обычный
`docker compose build` его пропускает, поэтому `deploy.sh` и любой ручной пересборки образов
должны запускать `docker compose --profile tools build` — иначе `docker compose run --rm migrate`
использует старый образ без новых миграций.

## Production-деплой

```bash
ssh root@2.26.85.78
mkdir -p /opt/twomcsu-discord-bot
# .env кладём один раз вручную (см. .env.example), chmod 600
curl -fsSL https://raw.githubusercontent.com/younaxo/twomcsu-discord-bot/main/scripts/deploy.sh | bash
```

На проде DNS-резолвер провайдера отдаёт нерабочий IP для `github.com`/`codeload.github.com`
(сетевая особенность хостинга) — `deploy.sh` сам прописывает рабочие IP в `/etc/hosts`
при первом запуске. Если GitHub сменит диапазон адресов и клонирование снова начнёт
зависать, обновите IP в `ensure_github_dns_workaround()` в `scripts/deploy.sh`.

Повторный запуск `scripts/deploy.sh` безопасен: подтягивает код, пересобирает образы,
применяет новые миграции, перезапускает контейнеры и обновляет nginx-конфиг для
`bot.twomc.su`, не трогая остальные сайты на сервере. Сертификат Let's Encrypt выпускается
при первом запуске и продлевается автоматически через `certbot.timer`.

### Обновление после изменений в коде

```bash
cd /opt/twomcsu-discord-bot
./scripts/deploy.sh
```

## Backup / restore базы данных

```bash
# backup
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz

# restore
gunzip -c backup-2026-08-28.sql.gz | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Транскрипты тикетов хранятся в базе (таблица `Transcript`), поэтому попадают в тот же backup.

### Откат после неудачного деплоя

1. Остановить проблемную версию: `docker compose down` (данные в volume `pgdata` сохраняются).
2. Восстановить БД из бэкапа, снятого перед деплоем (см. команду `restore` выше).
3. Откатить код: `git -C /opt/twomcsu-discord-bot reset --hard <предыдущий_коммит>`.
4. `docker compose --profile tools build && docker compose up -d --remove-orphans`.

Миграции в этом проекте только аддитивные (добавляют колонки, ничего не удаляют и не
переименовывают), поэтому откат кода на предыдущую версию с уже накатившейся новой миграцией
безопасен — старый код просто не использует новые поля.

## Диагностика

```bash
docker compose ps                     # статус контейнеров
docker compose logs -f bot            # логи бота
docker compose logs -f web            # логи панели
docker compose exec bot node -e "console.log('ok')"   # быстрая проверка, что контейнер жив

nginx -t                              # проверка конфигурации nginx
systemctl status certbot.timer        # автопродление сертификата
```

Если бот показывает "оффлайн" на Dashboard — проверьте `docker compose logs bot`: чаще всего
это неверный `DISCORD_BOT_TOKEN` или не пройдена проверка окружения (`env.ts` бросает
исключение при старте, если чего-то не хватает).

## Дизайн-система

Тёмная тёплая (коричнево-оранжевая) палитра с точечным эффектом Liquid Glass — токены в
`apps/web/src/app/globals.css` (CSS-переменные `--bg`, `--accent`, `--glass` и т.д.), подключены
в `tailwind.config.ts` под именами `brand`/`surface`/`muted`/`success`/`warning`/`danger`. Шрифт
интерфейса — Onest, файлы лежат в `apps/web/public/fonts`, декларации в `apps/web/src/app/fonts.css`
(размещён локально, без обращений к Google Fonts в рантайме). Иконки — `lucide-react`, emoji в
интерфейсе панели не используются (в Discord-сообщениях эмодзи остаются — это ограничение самого
Discord API, кастомные SVG в кнопки/select не передать).

## Безопасность

- Discord OAuth2 с проверкой `state`, HttpOnly/Secure/SameSite=Lax cookie, double-submit CSRF
  на изменяющих запросах, серверная ревалидация роли раз в 10 минут и мгновенный отзыв при
  потере роли/выходе с сервера.
- `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`.
- Docker-контейнеры бота и веб-панели работают от непривилегированного пользователя `node`.
- Атомарные переходы статуса тикета (`updateMany` с проверкой текущего статуса в `WHERE`) — 
  повторная доставка interaction или двойной клик не создают гонку и не дублируют действие.
- `pnpm audit` — обновляйте Next.js в пределах текущей мажорной версии при выходе патчей
  с security-фиксами, не откладывайте: несколько found ранее уязвимостей были critical/high.

## Тесты и проверки

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

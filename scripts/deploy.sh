#!/usr/bin/env bash
# Повторяемый деплой на production-сервер. Запускать от root на сервере:
#   curl -fsSL .../deploy.sh | bash    (или просто ./scripts/deploy.sh из уже склонированного репозитория)
#
# Скрипт идемпотентен: повторный запуск обновляет код, пересобирает образы, применяет
# миграции и перезапускает сервисы, не трогая настройки других сайтов на сервере.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/twomcsu-discord-bot}"
REPO_URL="${REPO_URL:-https://github.com/younaxo/twomcsu-discord-bot.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="bot.twomc.su"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] Ошибка: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "запускать нужно от root (или через sudo)"

ensure_packages() {
  # Сервер управляется BT-Panel и обслуживает другие сайты (twomc.su, api.twomc.su и т.д.) —
  # nginx и certbot здесь уже свои, собранные панелью. Ставить их через apt нельзя: это может
  # породить конфликтующую вторую копию nginx. Поэтому только проверяем наличие инструментов.
  command -v docker >/dev/null 2>&1 || fail "docker не найден"
  command -v git >/dev/null 2>&1 || fail "git не найден"
  command -v nginx >/dev/null 2>&1 || fail "nginx не найден"
  command -v certbot >/dev/null 2>&1 || fail "certbot не найден"
  docker compose version >/dev/null 2>&1 || fail "плагин 'docker compose' не найден (нужен Docker Engine с Compose v2)"
}

ensure_github_dns_workaround() {
  # На этом сервере DNS-резолвер провайдера отдаёт нерабочий IP для github.com/codeload.github.com
  # (сетевая особенность хостинга, не связана с проектом). Фиксируем реальные IP в /etc/hosts —
  # без этого git clone/fetch зависает или падает по таймауту. Если GitHub сменит диапазон адресов,
  # обновите IP ниже (актуальные можно узнать с машины с рабочим DNS: `dig +short github.com`).
  grep -q '^140\.82\..*github\.com' /etc/hosts 2>/dev/null && return 0
  log "Добавляю статичные записи GitHub в /etc/hosts (обход неисправного DNS провайдера)…"
  cat >> /etc/hosts << 'EOF'

# twomcsu-discord-bot: DNS-резолвер провайдера возвращает нерабочий IP для GitHub — фиксируем реальные адреса
140.82.121.3 github.com
140.82.121.9 codeload.github.com
140.82.121.6 api.github.com
EOF
}

sync_repo() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    log "Клонирую репозиторий в $REPO_DIR…"
    git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  else
    log "Обновляю код в $REPO_DIR…"
    git -C "$REPO_DIR" fetch origin "$BRANCH"
    git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
  fi
}

check_env() {
  [ -f "$REPO_DIR/.env" ] || fail "нет файла $REPO_DIR/.env — создайте его на основе .env.example перед первым запуском"
  chmod 600 "$REPO_DIR/.env"
}

deploy_services() {
  cd "$REPO_DIR"
  log "Собираю образы…"
  docker compose build

  log "Применяю миграции базы данных…"
  docker compose run --rm migrate

  log "Перезапускаю сервисы…"
  docker compose up -d --remove-orphans

  log "Регистрирую slash-команды guild…"
  docker compose run --rm --entrypoint node bot dist/deploy-commands.js || log "не удалось зарегистрировать команды — проверьте токен бота и повторите позже"
}

setup_nginx_tls() {
  # Сервер использует BT-Panel: конфиги сайтов лежат в /www/server/panel/vhost/nginx/,
  # а не в стандартном /etc/nginx/sites-*. Правим только файл нашего домена — остальные
  # сайты панели не трогаем.
  local vhost_dir="/www/server/panel/vhost/nginx"
  local conf_path="${vhost_dir}/${DOMAIN}.conf"
  local cert_dir="/etc/letsencrypt/live/${DOMAIN}"
  local acme_webroot="/www/wwwroot/acme-challenge"

  [ -d "$vhost_dir" ] || fail "не найден каталог vhost-конфигов BT-Panel ($vhost_dir) — проверьте путь вручную"
  mkdir -p "$acme_webroot"

  if [ ! -d "$cert_dir" ]; then
    log "Сертификат ещё не выпущен — публикую временный HTTP-конфиг для проверки домена…"
    cp "$REPO_DIR/nginx/${DOMAIN}.bootstrap.conf" "$conf_path"
    nginx -t && systemctl reload nginx

    certbot certonly --webroot -w "$acme_webroot" -d "$DOMAIN" \
      --non-interactive --agree-tos --register-unsafely-without-email \
      || fail "не удалось выпустить сертификат Let's Encrypt — проверьте, что DNS домена указывает на этот сервер"
  fi

  cp "$REPO_DIR/nginx/${DOMAIN}.conf" "$conf_path"
  nginx -t && systemctl reload nginx
  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
  log "Nginx настроен для $DOMAIN, автопродление сертификата включено"
}

ensure_packages
ensure_github_dns_workaround
sync_repo
check_env
deploy_services
setup_nginx_tls

log "Готово. Проверьте: https://${DOMAIN}"

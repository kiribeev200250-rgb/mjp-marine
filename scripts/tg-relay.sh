#!/bin/bash
# Dev-инструмент: тестирование Telegram-бота локально без публичного webhook URL.
# Long-polling getUpdates + форвард каждого апдейта на локальный webhook-роут.
# Использование: TELEGRAM_BOT_TOKEN должен быть в .env, dev-сервер должен уже работать.
#   ./scripts/tg-relay.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d= -f2-)
if [ -z "$TOKEN" ]; then
  echo "TELEGRAM_BOT_TOKEN не найден в .env" >&2
  exit 1
fi

WEBHOOK_URL="${1:-http://localhost:3000/api/crm/webhook/telegram}"
OFFSET=0

echo "Relaying Telegram updates to $WEBHOOK_URL (Ctrl+C to stop)"

while true; do
  RESP=$(curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${OFFSET}&timeout=25")
  COUNT=$(echo "$RESP" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))")
  if [ "$COUNT" -gt 0 ]; then
    echo "$RESP" | python3 -c "
import json, sys
for upd in json.load(sys.stdin)['result']:
    print(json.dumps(upd))
" | while IFS= read -r upd; do
      uid=$(echo "$upd" | python3 -c "import json,sys; print(json.load(sys.stdin)['update_id'])")
      echo "[relay] forwarding update_id=$uid"
      curl -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" \
        -d "$upd" -o /dev/null -w "[relay] webhook responded %{http_code}\n"
    done
    OFFSET=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(max(u['update_id'] for u in d['result'])+1)")
  fi
done

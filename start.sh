#!/bin/bash
set -e

# If a persistent disk is configured at SQLITE_DB_PATH (e.g. /data/nutrition-bot.db)
# and it does not exist yet on a fresh mount, seed it from the pre-indexed /app/nutrition-bot.db
if [ -n "$SQLITE_DB_PATH" ] && [ "$SQLITE_DB_PATH" != "./nutrition-bot.db" ] && [ ! -f "$SQLITE_DB_PATH" ]; then
  echo "Target DB $SQLITE_DB_PATH does not exist. Initializing from pre-indexed /app/nutrition-bot.db..."
  mkdir -p "$(dirname "$SQLITE_DB_PATH")"
  cp /app/nutrition-bot.db "$SQLITE_DB_PATH"
fi

echo "Starting Next.js on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}"


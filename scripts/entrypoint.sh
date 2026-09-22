#!/bin/sh
set -e

# Ждём базу (в dev с USE_SQLITE=True Postgres не нужен)
if [ "$USE_SQLITE" != "True" ]; then
  echo "Ожидание Postgres на $POSTGRES_HOST:$POSTGRES_PORT..."
  until nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
    sleep 1
  done
  echo "База доступна."
fi

echo "Применяем миграции..."
python manage.py migrate --noinput

echo "Собираем статику..."
python manage.py collectstatic --noinput

# Демо-данные (сотрудники, товары, продажи) — только если явно попросили
if [ "$SEED_DEMO" = "True" ]; then
  echo "Загружаем демо-данные..."
  python manage.py seed_demo
fi

exec "$@"

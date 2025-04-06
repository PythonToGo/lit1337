#!/bin/sh

echo "Waiting for PostgreSQL to be ready..."

DB_HOST=$(echo $DATABASE_URL | sed -E 's|.*://.*:(.*)@(.*):[0-9]+/.*|\2|')
DB_PORT=$(echo $DATABASE_URL | sed -E 's|.*:([0-9]+)/.*|\1|')

echo "Parsed host: $DB_HOST"
echo "Parsed port: $DB_PORT"

while ! nc -z "$DB_HOST" "$DB_PORT"; do
    sleep 0.5
done

echo "PostgreSQL is up - launching app..."
exec "$@"

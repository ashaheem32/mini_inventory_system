#!/bin/sh
set -e

# Persist a generated secret key in the data volume when none is supplied,
# so tokens and sessions survive container recreation without committing a secret.
if [ -z "$DJANGO_SECRET_KEY" ]; then
  KEY_FILE=/data/.django_secret_key
  if [ ! -s "$KEY_FILE" ]; then
    python -c "from django.core.management.utils import get_random_secret_key as k; print(k())" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
  fi
  DJANGO_SECRET_KEY="$(cat "$KEY_FILE")"
  export DJANGO_SECRET_KEY
fi

python manage.py migrate --noinput

if [ "${SEED_ON_START:-false}" = "true" ]; then
  # Idempotent: never duplicates rows, overwrites edits or resets passwords.
  python manage.py seed_data
fi

exec "$@"

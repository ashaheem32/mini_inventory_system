FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SQLITE_PATH=/data/db.sqlite3

WORKDIR /app
RUN useradd --create-home --uid 10001 app && mkdir -p /data && chown app:app /data

COPY requirements.txt .
RUN pip install -r requirements.txt

# Explicit ownership/modes: source files may come from filesystems without Unix permissions.
COPY --chown=app:app . .
RUN chmod -R u=rwX,go=rX /app && chmod 755 docker-entrypoint.sh \
    && DJANGO_DEBUG=false DJANGO_SECRET_KEY=collectstatic-only python manage.py collectstatic --noinput

USER app
VOLUME ["/data"]
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
# One process keeps the in-memory login throttle consistent and suits SQLite.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--access-logfile", "-"]

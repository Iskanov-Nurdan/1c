"""Настройки для Vercel (serverless).

Файловая система функции временная, поэтому SQLite не подходит: база берётся
из DATABASE_URL (Postgres: Neon / Supabase / Vercel Postgres).
Статика раздаётся через whitenoise прямо из app/static (collectstatic не нужен).
"""
import os
from urllib.parse import parse_qs, unquote, urlparse

from .prod import *  # noqa: F401,F403
from .prod import MIDDLEWARE

ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', '.vercel.app').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', 'https://*.vercel.app').split(',') if o.strip()
]


def _database_from_url(url):
    parsed = urlparse(url)
    options = {'sslmode': parse_qs(parsed.query).get('sslmode', ['require'])[0]}
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/'),
        'USER': unquote(parsed.username or ''),
        'PASSWORD': unquote(parsed.password or ''),
        'HOST': parsed.hostname,
        'PORT': parsed.port or 5432,
        'OPTIONS': options,
        'CONN_MAX_AGE': 0,   # в serverless соединения не переиспользуем
    }


_database_url = os.getenv('DATABASE_URL', '')
if _database_url:
    DATABASES = {'default': _database_from_url(_database_url)}
    VERCEL_SQLITE = False
else:
    # Без DATABASE_URL — временная SQLite в /tmp (единственная записываемая папка на Vercel).
    # Данные сбрасываются при холодном старте функции.
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': '/tmp/db.sqlite3'}}
    VERCEL_SQLITE = True

MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
WHITENOISE_USE_FINDERS = True
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

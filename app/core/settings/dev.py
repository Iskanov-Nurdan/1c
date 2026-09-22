"""Настройки для локальной разработки.

Проект запускается «из коробки»: без .env, без Postgres, без Docker —
`python manage.py migrate && python manage.py seed_demo && python manage.py runserver`.
"""
import os

from .base import *  # noqa: F401,F403
from .base import ALLOWED_HOSTS, BASE_DIR, SECRET_KEY

DEBUG = True

# Ключ для разработки. В production он обязан приходить из окружения (prod.py).
if not SECRET_KEY:
    SECRET_KEY = 'django-insecure-dev-key-erp-1c-local-only'

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', 'testserver']

# Явное переключение на SQLite даже при заданных POSTGRES_* переменных
if os.getenv('USE_SQLITE', 'False') == 'True':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

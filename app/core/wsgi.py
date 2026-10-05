"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
import sys
from pathlib import Path

# Папка app/ (где лежат пакеты core и apps) должна быть в sys.path при любом способе запуска
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from django.core.wsgi import get_wsgi_application

# На Vercel (переменная VERCEL задана платформой) включаем настройки для serverless
os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    'core.settings.vercel' if os.environ.get('VERCEL') else 'core.settings.dev',
)

application = get_wsgi_application()

# Vercel ищет WSGI-вызываемый объект с именем ``app``
app = application

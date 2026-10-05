"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# На Vercel (переменная VERCEL задана платформой) включаем настройки для serverless
os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    'core.settings.vercel' if os.environ.get('VERCEL') else 'core.settings.dev',
)

application = get_wsgi_application()

# Vercel ищет WSGI-вызываемый объект с именем ``app``
app = application

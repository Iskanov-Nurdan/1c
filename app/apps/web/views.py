"""Отдача одностраничного приложения.

Шаблон один — templates/index.html; вся навигация выполняется на клиенте.
Настройки передаются через ``json_script``: клиент читает их из тега
``#app-config`` (см. static/js/core/config.js).
"""
from django.conf import settings
from django.shortcuts import render


def index(request):
    """Главная страница ERP."""
    return render(request, 'index.html', {
        'app_config': {
            'mode': 'api',
            'apiBase': '/api/',
            'staticUrl': settings.STATIC_URL,
            'companyName': settings.COMPANY_NAME,
            'currency': settings.CURRENCY,
            'version': 1,
        },
    })

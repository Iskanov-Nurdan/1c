from django.conf import settings


def company_settings(request):
    """Реквизиты организации и параметры учёта — в шаблоны."""
    return {
        'COMPANY_NAME': settings.COMPANY_NAME,
        'CURRENCY': settings.CURRENCY,
        'VAT_RATE': settings.VAT_RATE,
    }

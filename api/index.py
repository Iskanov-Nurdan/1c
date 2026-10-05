"""Точка входа Vercel: отдаёт Django WSGI-приложение."""
import os
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'app'))
# Принудительно: неверное значение из панели Vercel (например, core.settings) не должно ломать запуск
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings.vercel'

from django.core.wsgi import get_wsgi_application  # noqa: E402

try:
    application = get_wsgi_application()
except Exception as exc:  # noqa: BLE001
    # Одна заметная строка в логах Vercel: причина + какие переменные заданы (только имена, без значений)
    present = {k: bool(os.getenv(k)) for k in ('SECRET_KEY', 'DATABASE_URL', 'DJANGO_SETTINGS_MODULE')}
    print('VERCEL-DIAG: %s: %s | env=%s' % (type(exc).__name__, exc, present), file=sys.stderr, flush=True)
    traceback.print_exc()
    raise

# Vercel ищет имя `app` на верхнем уровне модуля (в начале строки)
app = application

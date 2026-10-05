"""Точка входа Vercel: отдаёт Django WSGI-приложение."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'app'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.vercel')

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()

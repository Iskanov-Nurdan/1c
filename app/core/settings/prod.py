"""Настройки для production."""
from .base import *  # noqa: F401,F403
from .base import SECRET_KEY

DEBUG = False

if not SECRET_KEY:
    raise Exception('SECRET_KEY не задан в переменных окружения')

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'

# За обратным прокси (nginx) заголовок протокола приходит от него
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# В проде статика раздаётся nginx из STATIC_ROOT (см. docker/nginx.conf),
# доступ к API ограничен списком доменов.
CORS_ALLOW_ALL_ORIGINS = False

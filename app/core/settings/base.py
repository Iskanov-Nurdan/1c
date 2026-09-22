"""Базовые настройки ERP-системы."""
from datetime import timedelta
from pathlib import Path
import os

from dotenv import load_dotenv

# =============================================================================
# PATHS (ПУТИ)
# =============================================================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent          # …/app
PROJECT_DIR = BASE_DIR.parent                                      # корень репозитория

# Фронтенд лежит по стандартной раскладке Django:
#   app/templates/index.html      — разметка SPA
#   app/static/{css,js,img}/      — стили, скрипты, изображения

load_dotenv(PROJECT_DIR / '.env')

# =============================================================================
# SECURITY (БЕЗОПАСНОСТЬ)
# =============================================================================
# В dev-настройках подставляется безопасный ключ по умолчанию, в проде
# переменная окружения обязательна (см. prod.py).
SECRET_KEY = os.getenv('SECRET_KEY', '')

_allowed_hosts_env = os.getenv('ALLOWED_HOSTS', '').strip()
ALLOWED_HOSTS = [host.strip() for host in _allowed_hosts_env.split(',') if host.strip()]

_csrf_trusted_origins_env = os.getenv('CSRF_TRUSTED_ORIGINS', '').strip()
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in _csrf_trusted_origins_env.split(',') if origin.strip()
]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# =============================================================================
# APPLICATIONS (ПРИЛОЖЕНИЯ)
# =============================================================================
INSTALLED_APPS = [
    # Оформление админки — должно идти строго перед django.contrib.admin
    'jazzmin',

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'corsheaders',

    # Local — доменные приложения ERP
    'apps.common',        # базовая модель, сериализаторы, права, аудит
    'apps.accounts',      # пользователи и роли
    'apps.directories',   # организации, контрагенты, товары, склады, сотрудники
    'apps.documents',     # ЭДО, договоры, ЭЦП
    'apps.accounting',    # план счетов, проводки, периоды, налоги
    'apps.finance',       # касса, банк, платежи, бюджет
    'apps.inventory',     # остатки, движения, инвентаризация, закупки
    'apps.sales',         # продажи, возвраты, CRM
    'apps.hr',            # зарплата, табель
    'apps.workflow',      # заявки, уведомления, журнал аудита
    'apps.api',           # REST API (роутеры, сериализаторы, представления)
    'apps.web',           # отдача SPA
]

# =============================================================================
# MIDDLEWARE (ПРОМЕЖУТОЧНЫЕ ОБРАБОТЧИКИ)
# =============================================================================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# =============================================================================
# URLS & WSGI (МАРШРУТЫ И WSGI)
# =============================================================================
ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

# =============================================================================
# TEMPLATES (ШАБЛОНЫ)
# =============================================================================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'apps.common.context_processors.company_settings',
            ],
        },
    },
]

# =============================================================================
# DATABASE (БАЗА ДАННЫХ)
# =============================================================================
# Если POSTGRES_DB не задан — работаем на SQLite: проект поднимается
# без внешних сервисов (`python manage.py migrate && runserver`).
if os.getenv('POSTGRES_DB') and os.getenv('USE_SQLITE', 'False') != 'True':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB'),
            'USER': os.getenv('POSTGRES_USER'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': int(os.getenv('POSTGRES_PORT', 5432)),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# =============================================================================
# PASSWORD VALIDATION (ВАЛИДАЦИЯ ПАРОЛЕЙ)
# =============================================================================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# =============================================================================
# AUTHENTICATION (АУТЕНТИФИКАЦИЯ)
# =============================================================================
AUTH_USER_MODEL = 'accounts.User'

LOGIN_URL = '/admin/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'

# =============================================================================
# INTERNATIONALIZATION (ИНТЕРНАЦИОНАЛИЗАЦИЯ)
# =============================================================================
LANGUAGE_CODE = os.getenv('LANGUAGE_CODE', 'ru')
TIME_ZONE = os.getenv('TIME_ZONE', 'Asia/Bishkek')
USE_I18N = True
USE_TZ = True

# =============================================================================
# STATIC & MEDIA FILES (СТАТИЧЕСКИЕ И МЕДИА ФАЙЛЫ)
# =============================================================================
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# =============================================================================
# DEFAULTS (ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ)
# =============================================================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# ERP (ПАРАМЕТРЫ УЧЁТА)
# =============================================================================
COMPANY_NAME = os.getenv('COMPANY_NAME', 'ОсОО «Прогресс Групп»')
CURRENCY = os.getenv('CURRENCY', 'сом')
VAT_RATE = float(os.getenv('VAT_RATE', 12))
SALES_TAX_RATE = float(os.getenv('SALES_TAX_RATE', 2))
INCOME_TAX_RATE = float(os.getenv('INCOME_TAX_RATE', 10))

# =============================================================================
# REST API (DRF + JWT)
# =============================================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'apps.common.permissions.RoleModulePermission',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.common.pagination.LargePagination',
    'PAGE_SIZE': 500,
    'DEFAULT_FILTER_BACKENDS': (
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    # Суммы уходят числами, а не строками: клиент считает итоги на лету
    'COERCE_DECIMAL_TO_STRING': False,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
}

CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL', 'True') == 'True'
_cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').strip()
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]

# =============================================================================
# JAZZMIN (ОФОРМЛЕНИЕ АДМИНКИ)
# =============================================================================
JAZZMIN_SETTINGS = {
    'site_title': 'ERP — админка',
    'site_header': 'ERP',
    'site_brand': COMPANY_NAME,
    'welcome_sign': 'ERP · панель администратора',
    'copyright': COMPANY_NAME,
    'search_model': ['directories.Counterparty', 'directories.Product', 'documents.Document'],
    'user_avatar': None,

    'topmenu_links': [
        {'name': 'Открыть ERP', 'url': '/', 'new_window': False},
        {'name': 'API', 'url': '/api/', 'new_window': True},
        {'model': 'accounts.User'},
    ],
    'usermenu_links': [
        {'name': 'Вернуться в ERP', 'url': '/', 'icon': 'fas fa-chart-line'},
    ],

    'show_sidebar': True,
    'navigation_expanded': False,
    'order_with_respect_to': [
        'directories', 'documents', 'accounting', 'finance',
        'inventory', 'sales', 'hr', 'workflow', 'accounts', 'auth',
    ],

    'icons': {
        'auth': 'fas fa-lock',
        'auth.Group': 'fas fa-users-cog',
        'accounts.User': 'fas fa-user-tie',
        'accounts.Role': 'fas fa-key',
        'directories.Company': 'fas fa-building',
        'directories.Counterparty': 'fas fa-handshake',
        'directories.Product': 'fas fa-box',
        'directories.Category': 'fas fa-tags',
        'directories.Warehouse': 'fas fa-warehouse',
        'directories.Employee': 'fas fa-id-badge',
        'documents.Document': 'fas fa-file-invoice',
        'documents.Contract': 'fas fa-file-signature',
        'documents.Signature': 'fas fa-stamp',
        'accounting.Account': 'fas fa-book',
        'accounting.Entry': 'fas fa-calculator',
        'accounting.Period': 'fas fa-lock',
        'accounting.Tax': 'fas fa-percent',
        'finance.CashOrder': 'fas fa-cash-register',
        'finance.Payment': 'fas fa-credit-card',
        'finance.BankStatement': 'fas fa-university',
        'finance.Budget': 'fas fa-bullseye',
        'inventory.StockMove': 'fas fa-exchange-alt',
        'inventory.Inventory': 'fas fa-clipboard-check',
        'inventory.PurchaseOrder': 'fas fa-truck',
        'sales.Sale': 'fas fa-receipt',
        'sales.Deal': 'fas fa-briefcase',
        'hr.Payroll': 'fas fa-money-check-alt',
        'workflow.Request': 'fas fa-inbox',
        'workflow.AuditLog': 'fas fa-history',
    },
    'default_icon_parents': 'fas fa-chevron-circle-right',
    'default_icon_children': 'fas fa-circle',

    'changeform_format': 'horizontal_tabs',
    'related_modal_active': True,
    'show_ui_builder': False,
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text': False,
    'footer_small_text': True,
    'brand_colour': 'navbar-dark',
    'accent': 'accent-primary',
    'navbar': 'navbar-dark navbar-primary',
    'no_navbar_border': True,
    'navbar_fixed': True,
    'sidebar_fixed': True,
    'sidebar': 'sidebar-dark-primary',
    'sidebar_nav_compact_style': True,
    'theme': 'default',
    'dark_mode_theme': 'darkly',
    'button_classes': {
        'primary': 'btn-primary',
        'secondary': 'btn-outline-secondary',
        'info': 'btn-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
    'actions_sticky_top': True,
}

# =============================================================================
# LOGGING (ЛОГИРОВАНИЕ)
# =============================================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {'format': '[{asctime}] {levelname} {name}: {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'simple'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'apps': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}

"""Корневые маршруты ERP-системы."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    # REST API (SPA, мобильные клиенты, внешние интеграции)
    path('api/', include('apps.api.urls')),

    # Одностраничное приложение
    path('', include('apps.web.urls')),
]

# Статика: в разработке отдаёт Django (staticfiles), в production — nginx
# из STATIC_ROOT после collectstatic (см. docker/nginx.conf).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

"""Маршруты REST API."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .registry import COLLECTIONS
from .views import (
    AssetScheduleView, BootstrapView, DepreciationView, MeView, ReportView, VIEWSETS,
    health, report_index, summary,
)

app_name = 'api'

router = DefaultRouter()
for collection in COLLECTIONS:
    router.register(collection.name, VIEWSETS[collection.name], basename=collection.name)

urlpatterns = [
    # Аутентификация (JWT)
    path('token/', TokenObtainPairView.as_view(), name='token'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Профиль и начальная загрузка данных
    path('me/', MeView.as_view(), name='me'),
    path('bootstrap/', BootstrapView.as_view(), name='bootstrap'),

    # Основные средства: начисление амортизации и график по объекту (ТЗ п. 5)
    path('assets/depreciate/', DepreciationView.as_view(), name='depreciate'),
    path('assets/<str:asset_id>/schedule/', AssetScheduleView.as_view(), name='asset-schedule'),

    # Отчётность (ТЗ п. 4)
    path('reports/', report_index, name='report-index'),
    path('reports/<str:name>/', ReportView.as_view(), name='report'),

    # Сводка для дашборда и проверка живости
    path('summary/', summary, name='summary'),
    path('health/', health, name='health'),

    # CRUD по всем коллекциям
    path('', include(router.urls)),
]

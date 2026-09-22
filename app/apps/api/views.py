"""Представления API.

Слой тонкий: CRUD собирается фабрикой из реестра коллекций, бизнес-операции
(аудит, уведомления, сводка) вынесены в сервисы.
"""
from datetime import date

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import RoleModulePermission, required_module
from apps.common.services import write_audit

from .registry import COLLECTIONS
from .reports import REPORTS
from .serializers import MeSerializer, SERIALIZERS


class BaseCollectionViewSet(viewsets.ModelViewSet):
    """CRUD одной коллекции с проверкой прав, скоупом организаций и аудитом."""

    collection = ''
    module = None
    write_module = None

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        # Ограничение по организациям пользователя (ТЗ п. 29).
        if hasattr(self.queryset.model, 'company') and not user.is_superuser:
            company_ids = list(user.companies.values_list('id', flat=True))
            if company_ids:
                qs = qs.filter(Q(company_id__in=company_ids) | Q(company__isnull=True))
        return qs

    # --- Аудит действий (ТЗ п. 21) ---------------------------------------
    def perform_create(self, serializer):
        extra = {}
        if 'author' in [f.name for f in serializer.Meta.model._meta.get_fields()]:
            if not serializer.validated_data.get('author'):
                extra['author'] = getattr(self.request.user, 'full_name', '')
        instance = serializer.save(**extra)
        write_audit(self.request, 'create', self.collection, instance)

    def perform_update(self, serializer):
        changed = ', '.join(list(serializer.validated_data.keys())[:6])
        extra = {}
        if 'updated_by' in [f.name for f in serializer.Meta.model._meta.get_fields()]:
            extra['updated_by'] = getattr(self.request.user, 'full_name', '')
        instance = serializer.save(**extra)
        write_audit(self.request, 'update', self.collection, instance, details=changed)

    def perform_destroy(self, instance):
        write_audit(self.request, 'delete', self.collection, instance)
        instance.delete()


def build_viewset(collection):
    """Собирает ViewSet для коллекции реестра."""
    attrs = {
        'collection': collection.name,
        'module': collection.module,
        'write_module': collection.write_module,
        'queryset': collection.model.objects.all(),
        'serializer_class': SERIALIZERS[collection.name],
        'search_fields': list(collection.search),
        'ordering_fields': '__all__',
    }
    return type(f'{collection.model.__name__}ViewSet', (BaseCollectionViewSet,), attrs)


VIEWSETS = {c.name: build_viewset(c) for c in COLLECTIONS}


class BootstrapView(APIView):
    """Начальная загрузка: все доступные пользователю коллекции одним запросом.

    SPA работает с данными в памяти, поэтому 37 отдельных запросов при старте
    заменены одним. Коллекции, недоступные роли, возвращаются пустыми —
    интерфейс всё равно скрывает эти разделы.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {}
        blocked = []

        for collection in COLLECTIONS:
            view = type('V', (), {'module': collection.module, 'write_module': collection.write_module})
            module = required_module(view, 'GET')
            allowed = (
                user.is_superuser
                or module is None
                or (user.role and module in (user.role.permissions or []))
            )
            if not allowed:
                data[collection.name] = []
                blocked.append(collection.name)
                continue

            qs = collection.model.objects.all()
            if hasattr(collection.model, 'company') and not user.is_superuser:
                company_ids = list(user.companies.values_list('id', flat=True))
                if company_ids:
                    qs = qs.filter(Q(company_id__in=company_ids) | Q(company__isnull=True))

            serializer = SERIALIZERS[collection.name](qs, many=True)
            data[collection.name] = serializer.data

        return Response({
            'user': MeSerializer(user).data,
            'collections': data,
            'blocked': blocked,
        })


class MeView(APIView):
    """Профиль текущего пользователя (роль, права, организации)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """Проверка живости сервиса — используется Docker healthcheck и nginx."""
    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def summary(request):
    """Сводка для дашборда, рассчитанная на сервере (ТЗ п. 17)."""
    from apps.api.services import dashboard_summary

    return Response(dashboard_summary(request.user))


class DepreciationView(APIView):
    """Начисление амортизации за месяц (ТЗ п. 5).

    ``POST /api/assets/depreciate/`` с телом ``{"period": "2026-08",
    "units": {"fa-...": 120}}``. Операция идемпотентна: объект, по которому
    за период уже начисляли, пропускается.
    """

    module = 'assets'
    write_module = 'assets'

    def post(self, request):
        from apps.accounting.models import FixedAsset
        from apps.accounting.services import accrue

        raw_period = str(request.data.get('period') or '')
        try:
            year, month = (int(part) for part in raw_period.split('-')[:2])
            day = date(year, month, 1)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Укажите период в формате ГГГГ-ММ, например 2026-08'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assets = FixedAsset.objects.filter(status='operation')
        if not request.user.is_superuser:
            company_ids = list(request.user.companies.values_list('id', flat=True))
            if company_ids:
                assets = assets.filter(Q(company_id__in=company_ids) | Q(company__isnull=True))

        asset_ids = request.data.get('assetIds')
        if asset_ids:
            assets = assets.filter(id__in=list(asset_ids))

        units = {str(k): v for k, v in (request.data.get('units') or {}).items()}
        created = accrue(
            None, day, assets=assets, units_by_asset=units,
            author=getattr(request.user, 'full_name', ''),
        )

        write_audit(request, 'custom', 'depreciations', None,
                    details=f'начислена амортизация за {raw_period}: объектов {len(created)}')

        return Response({
            'period': raw_period,
            'count': len(created),
            'total': float(sum(item.amount for item in created)),
            'depreciations': SERIALIZERS['depreciations'](created, many=True).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AssetScheduleView(APIView):
    """График амортизации объекта: помесячный прогноз до конца срока."""

    module = 'assets'

    def get(self, request, asset_id):
        from apps.accounting.models import FixedAsset
        from apps.accounting.services import schedule

        asset = FixedAsset.objects.filter(id=asset_id).first()
        if asset is None:
            return Response({'detail': 'Объект не найден'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'assetId': asset.id, 'rows': schedule(asset)})


class ReportView(APIView):
    """Бухгалтерская и финансовая отчётность (ТЗ п. 4).

    ``/api/reports/<имя>/?from=2026-01-01&to=2026-08-25`` — расчёт выполняется
    на сервере, клиент получает готовые строки и итоги.
    """

    module = 'reports'

    def get(self, request, name):
        builder = REPORTS.get(name)
        if builder is None:
            return Response(
                {'detail': f'Отчёт «{name}» не найден', 'available': sorted(REPORTS)},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(builder(request.user, request.query_params))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_index(request):
    """Список доступных отчётов — используется интерфейсом и внешними клиентами."""
    return Response({'reports': sorted(REPORTS)})

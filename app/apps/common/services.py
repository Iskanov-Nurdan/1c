"""Сервисы общего назначения: журнал аудита и уведомления (ТЗ п. 21, 23).

Бизнес-логика живёт в сервисах — представления только вызывают их.
"""
import logging

from django.apps import apps

logger = logging.getLogger(__name__)

ACTION_TEXT = {
    'create': 'создал',
    'update': 'изменил',
    'delete': 'удалил',
}

ENTITY_TITLES = {
    'documents': 'Документ', 'contracts': 'Договор', 'counterparties': 'Контрагент',
    'entries': 'Проводка', 'cashOrders': 'Кассовый ордер', 'payments': 'Платёж',
    'products': 'Товар', 'stockMoves': 'Движение товара', 'inventories': 'Инвентаризация',
    'sales': 'Продажа', 'purchaseOrders': 'Заказ поставщику', 'purchaseRequests': 'Заявка на закупку',
    'deals': 'Сделка', 'tasks': 'Задача', 'employees': 'Сотрудник', 'payrolls': 'Расчёт зарплаты',
    'requests': 'Внутренняя заявка', 'taxes': 'Налог', 'budgets': 'Бюджет', 'users': 'Пользователь',
    'roles': 'Роль', 'signatures': 'Подпись', 'periods': 'Период', 'warehouses': 'Склад',
    'returns': 'Возврат', 'companies': 'Организация', 'notifications': 'Уведомление',
}


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def write_audit(request, action, collection, instance=None, details=''):
    """Пишет запись в журнал действий пользователей."""
    AuditLog = apps.get_model('workflow', 'AuditLog')
    user = getattr(request, 'user', None)
    label = ''
    if instance is not None:
        label = (
            getattr(instance, 'number', '')
            or getattr(instance, 'name', '')
            or getattr(instance, 'title', '')
            or getattr(instance, 'full_name', '')
            or str(instance.pk)
        )
    try:
        AuditLog.objects.create(
            user=getattr(user, 'full_name', '') or getattr(user, 'username', 'Система'),
            user_ref=user if getattr(user, 'is_authenticated', False) else None,
            role=getattr(getattr(user, 'role', None), 'code', 'system'),
            action=action,
            action_text=ACTION_TEXT.get(action, action),
            entity=collection,
            entity_title=ENTITY_TITLES.get(collection, collection),
            entity_id=str(getattr(instance, 'pk', '') or ''),
            label=label,
            details=details,
            company=getattr(instance, 'company', None),
            ip=client_ip(request),
        )
    except Exception:  # журнал не должен ломать основную операцию
        logger.exception('Не удалось записать действие в журнал аудита')


def notify(title, text='', kind='info', icon='bell', link='', company=None):
    """Создаёт уведомление для ленты и внешних каналов (Telegram/Email/SMS)."""
    Notification = apps.get_model('workflow', 'Notification')
    return Notification.objects.create(
        title=title, text=text, kind=kind, icon=icon, link=link, company=company,
    )

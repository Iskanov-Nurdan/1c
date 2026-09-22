"""Права доступа по ролям (ТЗ п. 2, 26).

Роль хранит список доступных модулей и список модулей «только для чтения».
Представление объявляет ``module`` (доступ на чтение) и, при необходимости,
``write_module`` — модуль, который проверяется при изменении данных.
Пример: справочник организаций читают все, а меняет только администратор.
"""
from rest_framework import permissions

SAFE = permissions.SAFE_METHODS


def required_module(view, method):
    if method in SAFE:
        return getattr(view, 'module', None)
    return getattr(view, 'write_module', None) or getattr(view, 'module', None)


class RoleModulePermission(permissions.BasePermission):
    message = 'У вашей роли нет прав на этот раздел'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        module = required_module(view, request.method)
        if module is None:
            return True

        role = getattr(user, 'role', None)
        if role is None:
            return False

        if module not in (role.permissions or []):
            return False

        if request.method not in SAFE and module in (role.readonly or []):
            self.message = 'Раздел доступен вашей роли только для чтения'
            return False

        return True


class IsAdminRole(permissions.BasePermission):
    """Действия, доступные только администратору системы."""

    message = 'Действие доступно только администратору системы'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_superuser or getattr(getattr(user, 'role', None), 'code', '') == 'admin'

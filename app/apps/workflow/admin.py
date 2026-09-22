from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import AuditLog, Notification, Request


@admin.register(Request)
class RequestAdmin(BaseAdmin):
    list_display = ('number', 'date', 'type_name', 'subject', 'author', 'amount', 'priority', 'status')
    list_filter = ('type', 'status', 'priority', 'company')
    search_fields = ('number', 'subject', 'author')


@admin.register(Notification)
class NotificationAdmin(BaseAdmin):
    list_display = ('title', 'kind', 'text', 'ts', 'read')
    list_filter = ('kind', 'read')
    search_fields = ('title', 'text')


@admin.register(AuditLog)
class AuditLogAdmin(BaseAdmin):
    list_display = ('ts', 'user', 'role', 'action_text', 'entity_title', 'label', 'ip')
    list_filter = ('action', 'role', 'entity')
    search_fields = ('user', 'action_text', 'label')
    date_hierarchy = 'ts'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import Deal, Return, Sale, Task


@admin.register(Sale)
class SaleAdmin(BaseAdmin):
    list_display = ('number', 'date', 'counterparty', 'amount', 'paid', 'due_date', 'status', 'manager')
    list_filter = ('status', 'manager', 'company')
    search_fields = ('number', 'counterparty__name')
    date_hierarchy = 'date'


@admin.register(Return)
class ReturnAdmin(BaseAdmin):
    list_display = ('number', 'date', 'sale_number', 'counterparty', 'amount', 'reason', 'status')
    list_filter = ('status', 'reason', 'company')


@admin.register(Deal)
class DealAdmin(BaseAdmin):
    list_display = ('title', 'counterparty', 'stage', 'amount', 'probability', 'manager', 'next_date')
    list_filter = ('stage', 'manager', 'company')
    search_fields = ('title', 'counterparty__name')


@admin.register(Task)
class TaskAdmin(BaseAdmin):
    list_display = ('title', 'assignee', 'due_date', 'priority', 'status')
    list_filter = ('status', 'priority', 'company')
    search_fields = ('title', 'assignee')

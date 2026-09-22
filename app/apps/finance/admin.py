from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import BankStatement, Budget, CashOrder, Payment


@admin.register(CashOrder)
class CashOrderAdmin(BaseAdmin):
    list_display = ('number', 'kind', 'date', 'amount', 'person', 'basis', 'cashier')
    list_filter = ('kind', 'company')
    search_fields = ('number', 'person', 'basis')
    date_hierarchy = 'date'


@admin.register(Payment)
class PaymentAdmin(BaseAdmin):
    list_display = ('number', 'kind', 'date', 'counterparty', 'amount', 'matched', 'status')
    list_filter = ('kind', 'status', 'matched', 'company')
    search_fields = ('number', 'purpose', 'counterparty__name')
    date_hierarchy = 'date'


@admin.register(BankStatement)
class BankStatementAdmin(BaseAdmin):
    list_display = ('date', 'file_name', 'rows_count', 'incoming', 'outgoing', 'matched', 'status')
    list_filter = ('status', 'company')


@admin.register(Budget)
class BudgetAdmin(BaseAdmin):
    list_display = ('period', 'kind', 'item', 'plan', 'fact')
    list_filter = ('kind', 'period_key', 'company')
    search_fields = ('item',)

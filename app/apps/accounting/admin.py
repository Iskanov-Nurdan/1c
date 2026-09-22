from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import Account, Depreciation, Entry, FixedAsset, Period, Tax


@admin.register(Account)
class AccountAdmin(BaseAdmin):
    list_display = ('code', 'name', 'kind', 'parent')
    list_filter = ('kind',)
    search_fields = ('code', 'name')


@admin.register(Entry)
class EntryAdmin(BaseAdmin):
    list_display = ('date', 'number', 'debit', 'credit', 'amount', 'content', 'auto', 'posted')
    list_filter = ('posted', 'auto', 'company')
    search_fields = ('number', 'content', 'debit', 'credit')
    date_hierarchy = 'date'


@admin.register(Period)
class PeriodAdmin(BaseAdmin):
    list_display = ('name', 'revenue', 'expense', 'closed', 'closed_by', 'closed_at')
    list_filter = ('closed', 'year', 'company')


@admin.register(Tax)
class TaxAdmin(BaseAdmin):
    list_display = ('name', 'period', 'base', 'rate', 'amount', 'due_date', 'status', 'declaration')
    list_filter = ('name', 'status', 'company')


@admin.register(FixedAsset)
class FixedAssetAdmin(BaseAdmin):
    list_display = ('inv_number', 'name', 'group', 'method', 'initial_cost',
                    'accumulated', 'life_months', 'status')
    list_filter = ('group', 'method', 'status', 'company')
    search_fields = ('inv_number', 'name', 'responsible', 'location')
    date_hierarchy = 'commissioned_at'


@admin.register(Depreciation)
class DepreciationAdmin(BaseAdmin):
    list_display = ('period', 'asset_name', 'method', 'amount', 'residual_after', 'posted')
    list_filter = ('period_key', 'method', 'posted', 'company')
    search_fields = ('asset_name', 'period')
    date_hierarchy = 'date'

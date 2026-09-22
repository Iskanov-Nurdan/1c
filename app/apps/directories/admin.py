from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import (
    AppSettings, Category, Company, Counterparty, Employee, Integration, Product, Unit, Warehouse,
)


@admin.register(Company)
class CompanyAdmin(BaseAdmin):
    list_display = ('name', 'inn', 'director', 'tax_mode', 'phone')
    search_fields = ('name', 'inn')


@admin.register(Counterparty)
class CounterpartyAdmin(BaseAdmin):
    list_display = ('name', 'kind', 'inn', 'phone', 'rating', 'debt', 'active')
    list_filter = ('kind', 'active', 'rating', 'company')
    search_fields = ('name', 'inn', 'phone', 'email')


@admin.register(Product)
class ProductAdmin(BaseAdmin):
    list_display = ('name', 'sku', 'barcode', 'category', 'unit', 'cost', 'price', 'active')
    list_filter = ('category', 'active', 'company')
    search_fields = ('name', 'sku', 'barcode')


@admin.register(Warehouse)
class WarehouseAdmin(BaseAdmin):
    list_display = ('name', 'branch', 'manager', 'company')
    list_filter = ('company',)


@admin.register(Employee)
class EmployeeAdmin(BaseAdmin):
    list_display = ('full_name', 'position', 'department', 'hire_date', 'salary', 'status')
    list_filter = ('department', 'status', 'company')
    search_fields = ('full_name', 'position', 'phone')


@admin.register(Integration)
class IntegrationAdmin(BaseAdmin):
    list_display = ('name', 'kind', 'status', 'last_sync')
    list_filter = ('kind', 'status')


@admin.register(Category)
class CategoryAdmin(BaseAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Unit)
class UnitAdmin(BaseAdmin):
    list_display = ('name',)


@admin.register(AppSettings)
class AppSettingsAdmin(BaseAdmin):
    list_display = ('currency', 'language', 'vat_rate', 'auto_backup')

from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import Inventory, PurchaseOrder, PurchaseRequest, Stock, StockMove


@admin.register(Stock)
class StockAdmin(BaseAdmin):
    list_display = ('product', 'warehouse', 'qty')
    list_filter = ('warehouse', 'company')
    search_fields = ('product__name', 'product__sku')


@admin.register(StockMove)
class StockMoveAdmin(BaseAdmin):
    list_display = ('number', 'date', 'type', 'product_name', 'qty', 'amount', 'reason')
    list_filter = ('type', 'company')
    search_fields = ('number', 'product_name')
    date_hierarchy = 'date'


@admin.register(Inventory)
class InventoryAdmin(BaseAdmin):
    list_display = ('number', 'date', 'warehouse', 'responsible', 'status')
    list_filter = ('status', 'warehouse', 'company')


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(BaseAdmin):
    list_display = ('number', 'date', 'product_name', 'qty', 'amount', 'need', 'status')
    list_filter = ('status', 'company')
    search_fields = ('number', 'product_name')


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(BaseAdmin):
    list_display = ('number', 'date', 'supplier', 'amount', 'paid', 'delivery_date', 'status')
    list_filter = ('status', 'company')
    search_fields = ('number', 'supplier__name')

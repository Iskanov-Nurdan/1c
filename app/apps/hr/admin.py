from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import Payroll, Timesheet


@admin.register(Payroll)
class PayrollAdmin(BaseAdmin):
    list_display = ('employee_name', 'period', 'base', 'bonus', 'gross', 'income_tax', 'social', 'net', 'status')
    list_filter = ('period_key', 'status', 'company')
    search_fields = ('employee_name',)


@admin.register(Timesheet)
class TimesheetAdmin(BaseAdmin):
    list_display = ('employee_name', 'date', 'type', 'hours')
    list_filter = ('type', 'company')
    search_fields = ('employee_name',)
    date_hierarchy = 'date'

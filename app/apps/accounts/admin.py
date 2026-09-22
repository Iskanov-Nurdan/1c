from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'modules_count', 'description')
    search_fields = ('name', 'code')

    @admin.display(description='модулей')
    def modules_count(self, obj):
        return len(obj.permissions or [])


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ('full_name',)
    list_display = ('full_name', 'login', 'role', 'email', 'is_active', 'last_login')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('full_name', 'login', 'email')
    filter_horizontal = ('companies', 'groups', 'user_permissions')
    readonly_fields = ('id', 'created_at', 'last_login')

    fieldsets = (
        ('Учётная запись', {'fields': ('id', 'login', 'password')}),
        ('Личные данные', {'fields': ('full_name', 'email', 'phone')}),
        ('Доступ', {'fields': ('role', 'companies', 'two_factor', 'is_active', 'is_staff', 'is_superuser')}),
        ('Права Django', {'classes': ('collapse',), 'fields': ('groups', 'user_permissions')}),
        ('Служебное', {'fields': ('created_at', 'last_login')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('login', 'full_name', 'role', 'password1', 'password2'),
        }),
    )

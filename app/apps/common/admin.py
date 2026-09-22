from django.contrib import admin


class BaseAdmin(admin.ModelAdmin):
    """Общие настройки админки для доменных моделей."""

    readonly_fields = ('id', 'created_at', 'updated_at', 'updated_by')
    list_per_page = 50
    save_on_top = True

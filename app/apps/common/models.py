"""Базовые модели.

Первичный ключ — строка вида ``doc-3f9a2b10c4``. Так сделано намеренно:
фронтенд оперирует идентификаторами как строками (значения <option>, ключи
в JSON-полях), и строковый ключ исключает рассинхронизацию типов между
клиентом и сервером.
"""
from uuid import uuid4

from django.db import models


def make_id(prefix: str) -> str:
    return f'{prefix}-{uuid4().hex[:10]}'


class BaseModel(models.Model):
    """Общие поля всех справочников и документов."""

    ID_PREFIX = 'obj'

    id = models.CharField('идентификатор', primary_key=True, max_length=48, editable=False)
    created_at = models.DateTimeField('создан', auto_now_add=True)
    updated_at = models.DateTimeField('изменён', auto_now=True)
    author = models.CharField('автор', max_length=150, blank=True, default='')
    updated_by = models.CharField('кто изменил', max_length=150, blank=True, default='')

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = make_id(self.ID_PREFIX)
        super().save(*args, **kwargs)

    def __str__(self):
        return getattr(self, 'number', None) or getattr(self, 'name', None) or self.id


class CompanyModel(BaseModel):
    """Документ или справочник, принадлежащий организации.

    Мультиорганизационность (ТЗ п. 29): выборки в API всегда ограничены
    организациями, доступными пользователю.
    """

    company = models.ForeignKey(
        'directories.Company',
        verbose_name='организация',
        on_delete=models.CASCADE,
        related_name='%(class)s_set',
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True

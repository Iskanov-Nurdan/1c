"""Внутренние заявки, уведомления и журнал аудита (ТЗ п. 15, 21, 23)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class Request(CompanyModel):
    """Внутренняя заявка: Создание → Проверка → Одобрение → Выполнение."""

    ID_PREFIX = 'req'

    TYPE = (
        ('purchase', 'Покупка'), ('payment', 'Оплата'), ('cash', 'Выдача денег'),
        ('document', 'Создание документа'), ('repair', 'Ремонт'), ('supply', 'Закупка'),
    )
    STATUS = (
        ('new', 'Новая'), ('review', 'На проверке'), ('approved', 'Одобрена'),
        ('done', 'Выполнена'), ('rejected', 'Отклонена'),
    )
    PRIORITY = (('low', 'Низкий'), ('normal', 'Обычный'), ('high', 'Высокий'))

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    type = models.CharField('тип', max_length=24, choices=TYPE, default='purchase')
    type_name = models.CharField('название типа', max_length=60, blank=True, default='')
    subject = models.CharField('тема заявки', max_length=255)
    amount = models.DecimalField('сумма', **MONEY)
    department = models.CharField('отдел', max_length=120, blank=True, default='')
    priority = models.CharField('приоритет', max_length=16, choices=PRIORITY, default='normal')
    status = models.CharField('статус', max_length=16, choices=STATUS, default='new')
    route = models.JSONField('маршрут согласования', default=list, blank=True)
    comment = models.TextField('комментарий', blank=True, default='')

    class Meta:
        verbose_name = 'внутренняя заявка'
        verbose_name_plural = 'внутренние заявки'
        ordering = ('-date', '-created_at')

    def __str__(self):
        return f'{self.number} — {self.subject}'

    def save(self, *args, **kwargs):
        if not self.type_name:
            self.type_name = dict(self.TYPE).get(self.type, self.type)
        super().save(*args, **kwargs)


class Notification(CompanyModel):
    """Уведомление для ленты и внешних каналов (Telegram / Email / SMS)."""

    ID_PREFIX = 'ntf'

    KIND = (('info', 'Информация'), ('ok', 'Успех'), ('warn', 'Внимание'), ('danger', 'Важно'))

    kind = models.CharField('вид', max_length=16, choices=KIND, default='info')
    icon = models.CharField('иконка', max_length=32, blank=True, default='bell')
    title = models.CharField('заголовок', max_length=180)
    text = models.CharField('текст', max_length=400, blank=True, default='')
    ts = models.DateTimeField('время', auto_now_add=True)
    read = models.BooleanField('прочитано', default=False)
    link = models.CharField('ссылка', max_length=120, blank=True, default='')

    class Meta:
        verbose_name = 'уведомление'
        verbose_name_plural = 'уведомления'
        ordering = ('-ts',)

    def __str__(self):
        return self.title


class AuditLog(CompanyModel):
    """Журнал действий пользователей: кто, что и когда сделал."""

    ID_PREFIX = 'aud'

    ts = models.DateTimeField('время', auto_now_add=True)
    user = models.CharField('пользователь', max_length=180, blank=True, default='')
    user_ref = models.ForeignKey(
        'accounts.User', verbose_name='учётная запись',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_records',
    )
    role = models.CharField('роль', max_length=40, blank=True, default='')
    action = models.CharField('действие', max_length=32, blank=True, default='')
    action_text = models.CharField('описание действия', max_length=180, blank=True, default='')
    entity = models.CharField('коллекция', max_length=60, blank=True, default='')
    entity_title = models.CharField('объект', max_length=120, blank=True, default='')
    entity_id = models.CharField('идентификатор объекта', max_length=48, blank=True, default='')
    label = models.CharField('метка объекта', max_length=180, blank=True, default='')
    details = models.CharField('изменённые поля', max_length=255, blank=True, default='')
    ip = models.CharField('IP-адрес', max_length=64, blank=True, default='')

    class Meta:
        verbose_name = 'запись журнала'
        verbose_name_plural = 'аудит действий'
        ordering = ('-ts',)
        indexes = [models.Index(fields=['-ts']), models.Index(fields=['entity'])]

    def __str__(self):
        return f'{self.user} {self.action_text} {self.entity_title}'

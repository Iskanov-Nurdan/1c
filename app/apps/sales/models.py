"""Продажи, возвраты и CRM (ТЗ п. 11, 12)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class Sale(CompanyModel):
    """Документ реализации."""

    ID_PREFIX = 'sal'

    STATUS = (('paid', 'Оплачено'), ('partial', 'Частично'), ('unpaid', 'Не оплачено'))

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='клиент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='sales',
    )
    warehouse = models.ForeignKey(
        'directories.Warehouse', verbose_name='склад отгрузки',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='sales',
    )
    items = models.JSONField('товары', default=list, blank=True)

    total = models.DecimalField('сумма без скидки', **MONEY)
    discount = models.DecimalField('скидка', **MONEY)
    amount = models.DecimalField('итого', **MONEY)
    vat = models.DecimalField('в том числе НДС', **MONEY)
    paid = models.DecimalField('оплачено', **MONEY)

    due_date = models.DateField('срок оплаты', null=True, blank=True)
    status = models.CharField('статус оплаты', max_length=16, choices=STATUS, default='unpaid')
    manager = models.CharField('менеджер', max_length=180, blank=True, default='')
    posted = models.BooleanField('проведён', default=False)

    class Meta:
        verbose_name = 'продажа'
        verbose_name_plural = 'продажи'
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['date']), models.Index(fields=['status'])]

    def __str__(self):
        return self.number

    @property
    def debt(self):
        return self.amount - self.paid


class Return(CompanyModel):
    """Возврат товара от покупателя."""

    ID_PREFIX = 'ret'

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    sale = models.ForeignKey(
        Sale, verbose_name='документ продажи',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='returns',
    )
    sale_number = models.CharField('номер продажи', max_length=40, blank=True, default='')
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='клиент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='returns',
    )
    amount = models.DecimalField('сумма возврата', **MONEY)
    reason = models.CharField('причина', max_length=180, blank=True, default='')
    status = models.CharField('статус', max_length=16, default='review')

    class Meta:
        verbose_name = 'возврат'
        verbose_name_plural = 'возвраты'
        ordering = ('-date',)

    def __str__(self):
        return self.number


class Deal(CompanyModel):
    """Сделка CRM."""

    ID_PREFIX = 'del'

    STAGE = (
        ('new', 'Новая'), ('contact', 'Контакт установлен'), ('offer', 'КП отправлено'),
        ('negotiation', 'Переговоры'), ('won', 'Выиграна'), ('lost', 'Проиграна'),
    )

    title = models.CharField('название сделки', max_length=255)
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='клиент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='deals',
    )
    stage = models.CharField('стадия', max_length=16, choices=STAGE, default='new')
    amount = models.DecimalField('сумма', **MONEY)
    probability = models.PositiveSmallIntegerField('вероятность, %', default=10)
    manager = models.CharField('менеджер', max_length=180, blank=True, default='')
    date = models.DateField('дата создания', null=True, blank=True)
    next_step = models.CharField('следующий шаг', max_length=180, blank=True, default='')
    next_date = models.DateField('дата шага', null=True, blank=True)
    activities = models.JSONField('история общения', default=list, blank=True)

    class Meta:
        verbose_name = 'сделка'
        verbose_name_plural = 'сделки'
        ordering = ('-created_at',)

    def __str__(self):
        return self.title


class Task(CompanyModel):
    """Задача менеджера с контролем срока."""

    ID_PREFIX = 'tsk'

    STATUS = (('new', 'Новая'), ('progress', 'В работе'), ('done', 'Выполнена'))
    PRIORITY = (('low', 'Низкий'), ('normal', 'Обычный'), ('high', 'Высокий'))

    title = models.CharField('задача', max_length=255)
    deal = models.ForeignKey(
        Deal, verbose_name='сделка', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks',
    )
    assignee = models.CharField('исполнитель', max_length=180, blank=True, default='')
    due_date = models.DateField('срок', null=True, blank=True)
    priority = models.CharField('приоритет', max_length=16, choices=PRIORITY, default='normal')
    status = models.CharField('статус', max_length=16, choices=STATUS, default='new')

    class Meta:
        verbose_name = 'задача'
        verbose_name_plural = 'задачи'
        ordering = ('due_date',)

    def __str__(self):
        return self.title

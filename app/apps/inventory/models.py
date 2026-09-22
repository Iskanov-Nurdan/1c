"""Складской учёт и закупки (ТЗ п. 9, 10)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}
QTY = {'max_digits': 14, 'decimal_places': 3, 'default': 0}


class Stock(CompanyModel):
    """Остаток товара на складе."""

    ID_PREFIX = 'stk'

    product = models.ForeignKey(
        'directories.Product', verbose_name='товар',
        on_delete=models.CASCADE, related_name='stocks',
    )
    warehouse = models.ForeignKey(
        'directories.Warehouse', verbose_name='склад',
        on_delete=models.CASCADE, related_name='stocks',
    )
    qty = models.DecimalField('количество', **QTY)

    class Meta:
        verbose_name = 'остаток'
        verbose_name_plural = 'остатки'
        unique_together = (('product', 'warehouse'),)
        ordering = ('product__name',)

    def __str__(self):
        return f'{self.product} — {self.qty}'


class StockMove(CompanyModel):
    """Движение товара: приход, расход, перемещение, списание."""

    ID_PREFIX = 'mov'

    TYPE = (
        ('in', 'Поступление'), ('out', 'Отгрузка'),
        ('move', 'Перемещение'), ('writeoff', 'Списание'),
    )

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    type = models.CharField('операция', max_length=16, choices=TYPE, default='in')

    product = models.ForeignKey(
        'directories.Product', verbose_name='товар',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='moves',
    )
    product_name = models.CharField('наименование товара', max_length=255, blank=True, default='')
    unit = models.CharField('единица', max_length=20, blank=True, default='шт')
    qty = models.DecimalField('количество', **QTY)

    from_warehouse = models.ForeignKey(
        'directories.Warehouse', verbose_name='склад-источник',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='moves_out',
    )
    to_warehouse = models.ForeignKey(
        'directories.Warehouse', verbose_name='склад-получатель',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='moves_in',
    )

    price = models.DecimalField('цена', **MONEY)
    amount = models.DecimalField('сумма', **MONEY)
    reason = models.CharField('причина / основание', max_length=255, blank=True, default='')

    class Meta:
        verbose_name = 'движение товара'
        verbose_name_plural = 'движения товара'
        ordering = ('-date', '-created_at')

    def __str__(self):
        return f'{self.number} — {self.product_name}'


class Inventory(CompanyModel):
    """Инвентаризационная ведомость."""

    ID_PREFIX = 'inv'

    STATUS = (('draft', 'Черновик'), ('done', 'Завершена'))

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    warehouse = models.ForeignKey(
        'directories.Warehouse', verbose_name='склад',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='inventories',
    )
    responsible = models.CharField('ответственный', max_length=180, blank=True, default='')
    status = models.CharField('статус', max_length=16, choices=STATUS, default='draft')
    lines = models.JSONField('позиции', default=list, blank=True)

    class Meta:
        verbose_name = 'инвентаризация'
        verbose_name_plural = 'инвентаризации'
        ordering = ('-date',)

    def __str__(self):
        return self.number


class PurchaseRequest(CompanyModel):
    """Заявка на закупку."""

    ID_PREFIX = 'prq'

    STATUS = (
        ('new', 'Новая'), ('review', 'На проверке'), ('approved', 'Одобрена'),
        ('done', 'Выполнена'), ('rejected', 'Отклонена'),
    )

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    product = models.ForeignKey(
        'directories.Product', verbose_name='товар',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requests',
    )
    product_name = models.CharField('наименование', max_length=255, blank=True, default='')
    qty = models.DecimalField('количество', **QTY)
    unit = models.CharField('единица', max_length=20, blank=True, default='шт')
    amount = models.DecimalField('сумма', **MONEY)
    need = models.DateField('нужно к дате', null=True, blank=True)
    status = models.CharField('статус', max_length=16, choices=STATUS, default='new')
    comment = models.TextField('обоснование', blank=True, default='')

    class Meta:
        verbose_name = 'заявка на закупку'
        verbose_name_plural = 'заявки на закупку'
        ordering = ('-date',)

    def __str__(self):
        return self.number


class PurchaseOrder(CompanyModel):
    """Заказ поставщику."""

    ID_PREFIX = 'pos'

    STATUS = (
        ('new', 'Новый'), ('sent', 'Отправлен'),
        ('received', 'Получен'), ('cancelled', 'Отменён'),
    )

    number = models.CharField('номер', max_length=40)
    date = models.DateField('дата')
    supplier = models.ForeignKey(
        'directories.Counterparty', verbose_name='поставщик',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders',
    )
    items = models.JSONField('позиции', default=list, blank=True)
    amount = models.DecimalField('сумма', **MONEY)
    paid = models.DecimalField('оплачено', **MONEY)
    delivery_date = models.DateField('дата поставки', null=True, blank=True)
    status = models.CharField('статус', max_length=16, choices=STATUS, default='new')
    manager = models.CharField('ответственный', max_length=180, blank=True, default='')

    class Meta:
        verbose_name = 'заказ поставщику'
        verbose_name_plural = 'заказы поставщикам'
        ordering = ('-date',)

    def __str__(self):
        return self.number

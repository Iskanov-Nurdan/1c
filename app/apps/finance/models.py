"""Касса, банк, платежи, бюджет (ТЗ п. 7, 8, 18)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class CashOrder(CompanyModel):
    """Приходный (ПКО) или расходный (РКО) кассовый ордер."""

    ID_PREFIX = 'cor'

    KIND = (('in', 'Приходный'), ('out', 'Расходный'))

    number = models.CharField('номер', max_length=40)
    kind = models.CharField('вид', max_length=8, choices=KIND, default='in')
    date = models.DateField('дата')
    amount = models.DecimalField('сумма', **MONEY)
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='контрагент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_orders',
    )
    person = models.CharField('от кого / кому', max_length=200, blank=True, default='')
    basis = models.CharField('основание', max_length=255, blank=True, default='')
    cashier = models.CharField('кассир', max_length=180, blank=True, default='')
    status = models.CharField('статус', max_length=16, default='posted')

    class Meta:
        verbose_name = 'кассовый ордер'
        verbose_name_plural = 'кассовые ордера'
        ordering = ('-date', '-created_at')

    def __str__(self):
        return self.number

    @property
    def signed_amount(self):
        return self.amount if self.kind == 'in' else -self.amount


class Payment(CompanyModel):
    """Платёж по расчётному счёту (платёжное поручение)."""

    ID_PREFIX = 'pay'

    KIND = (('in', 'Поступление'), ('out', 'Списание'))
    STATUS = (('new', 'Новый'), ('executed', 'Исполнен'))

    number = models.CharField('номер', max_length=40)
    kind = models.CharField('направление', max_length=8, choices=KIND, default='out')
    date = models.DateField('дата')
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='контрагент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='payments',
    )
    amount = models.DecimalField('сумма', **MONEY)
    purpose = models.CharField('назначение платежа', max_length=400, blank=True, default='')
    account = models.CharField('расчётный счёт', max_length=40, blank=True, default='')
    bank = models.CharField('банк', max_length=150, blank=True, default='')
    matched = models.BooleanField('сопоставлен', default=False)
    status = models.CharField('статус', max_length=16, choices=STATUS, default='new')

    class Meta:
        verbose_name = 'платёж'
        verbose_name_plural = 'платежи'
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['date']), models.Index(fields=['kind'])]

    def __str__(self):
        return self.number


class BankStatement(CompanyModel):
    """Загруженная банковская выписка (обмен с банк-клиентом)."""

    ID_PREFIX = 'bst'

    STATUS = (('loaded', 'Загружена'), ('processed', 'Обработана'))

    date = models.DateField('дата выписки')
    file_name = models.CharField('файл', max_length=180)
    format = models.CharField('формат', max_length=60, default='1C-Bank Exchange')
    rows_count = models.PositiveIntegerField('операций', default=0)
    incoming = models.DecimalField('приход', **MONEY)
    outgoing = models.DecimalField('расход', **MONEY)
    matched = models.PositiveIntegerField('сопоставлено', default=0)
    status = models.CharField('статус', max_length=16, choices=STATUS, default='loaded')

    class Meta:
        verbose_name = 'банковская выписка'
        verbose_name_plural = 'банковские выписки'
        ordering = ('-date',)


class Budget(CompanyModel):
    """Плановая и фактическая сумма по статье бюджета."""

    ID_PREFIX = 'bdg'

    KIND = (('income', 'Доход'), ('expense', 'Расход'))

    period_key = models.CharField('ключ периода', max_length=10)
    period = models.CharField('период', max_length=40)
    kind = models.CharField('вид', max_length=16, choices=KIND, default='expense')
    item = models.CharField('статья', max_length=150)
    plan = models.DecimalField('план', **MONEY)
    fact = models.DecimalField('факт', **MONEY)

    class Meta:
        verbose_name = 'статья бюджета'
        verbose_name_plural = 'бюджет'
        ordering = ('-period_key', 'kind', 'item')

    def __str__(self):
        return f'{self.item} — {self.period}'

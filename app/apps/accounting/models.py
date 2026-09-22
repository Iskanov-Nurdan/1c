"""Бухгалтерский и налоговый учёт (ТЗ п. 5, 14)."""
from django.db import models

from apps.common.models import BaseModel, CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class Account(BaseModel):
    """Счёт плана счетов."""

    ID_PREFIX = 'acc'

    KIND = (('A', 'Активный'), ('P', 'Пассивный'), ('AP', 'Активно-пассивный'))

    code = models.CharField('код счёта', max_length=16, unique=True)
    name = models.CharField('наименование', max_length=180)
    kind = models.CharField('вид', max_length=4, choices=KIND, default='A')
    parent = models.CharField('родительский счёт', max_length=16, blank=True, default='')
    opening = models.DecimalField('входящее сальдо', **MONEY)

    class Meta:
        verbose_name = 'счёт'
        verbose_name_plural = 'план счетов'
        ordering = ('code',)

    def __str__(self):
        return f'{self.code} — {self.name}'


class Entry(CompanyModel):
    """Бухгалтерская проводка (двойная запись)."""

    ID_PREFIX = 'ent'

    number = models.CharField('номер', max_length=32, blank=True, default='')
    date = models.DateField('дата')
    debit = models.CharField('счёт дебета', max_length=16)
    credit = models.CharField('счёт кредита', max_length=16)
    amount = models.DecimalField('сумма', **MONEY)
    content = models.CharField('содержание операции', max_length=255)

    # Имя поля `doc` даёт в API ключ `docId` — так же, как в клиенте
    doc = models.ForeignKey(
        'documents.Document', verbose_name='документ-основание',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='entries',
    )
    auto = models.BooleanField('создана автоматически', default=False)
    posted = models.BooleanField('проведена', default=False)

    class Meta:
        verbose_name = 'проводка'
        verbose_name_plural = 'проводки'
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['date']), models.Index(fields=['debit']), models.Index(fields=['credit'])]

    def __str__(self):
        return f'{self.debit} / {self.credit} — {self.amount}'


class Period(CompanyModel):
    """Учётный период: закрытие месяца блокирует изменения."""

    ID_PREFIX = 'per'

    key = models.CharField('ключ периода', max_length=10)      # 2026-07
    name = models.CharField('название', max_length=40)
    year = models.PositiveSmallIntegerField('год')
    month = models.PositiveSmallIntegerField('месяц')          # 0..11, как в интерфейсе

    revenue = models.DecimalField('доходы', **MONEY)
    expense = models.DecimalField('расходы', **MONEY)

    closed = models.BooleanField('закрыт', default=False)
    closed_by = models.CharField('кто закрыл', max_length=180, blank=True, default='')
    closed_at = models.DateTimeField('когда закрыт', null=True, blank=True)

    class Meta:
        verbose_name = 'период'
        verbose_name_plural = 'периоды'
        ordering = ('-key',)
        unique_together = (('company', 'key'),)

    def __str__(self):
        return self.name


class Tax(CompanyModel):
    """Налоговое обязательство за период (ТЗ п. 14)."""

    ID_PREFIX = 'tax'

    STATUS = (('planned', 'Запланирован'), ('paid', 'Уплачен'), ('overdue', 'Просрочен'))

    name = models.CharField('налог', max_length=120)
    rate = models.DecimalField('ставка, %', max_digits=6, decimal_places=2, default=0)
    period_key = models.CharField('ключ периода', max_length=10)
    period = models.CharField('период', max_length=40)
    frequency = models.CharField('периодичность', max_length=40, blank=True, default='')
    base = models.DecimalField('налоговая база', **MONEY)
    amount = models.DecimalField('сумма налога', **MONEY)
    due_date = models.DateField('срок уплаты')
    status = models.CharField('статус', max_length=16, choices=STATUS, default='planned')
    declaration = models.CharField('декларация', max_length=40, blank=True, default='Не сдана')

    class Meta:
        verbose_name = 'налог'
        verbose_name_plural = 'налоги'
        ordering = ('-due_date',)

    def __str__(self):
        return f'{self.name} — {self.period}'


class FixedAsset(CompanyModel):
    """Объект основных средств (МСФО (IAS) 16, ТЗ п. 5).

    Накопленная амортизация хранится полем, а не считается по журналу
    начислений: остаточную стоимость показывают в списках и отчётах, и
    пересчёт по всей истории на каждой строке обошёлся бы дороже, чем
    поддержание одного поля при начислении.
    """

    ID_PREFIX = 'fa'

    GROUP = (
        ('building', 'Здания и сооружения'),
        ('vehicle', 'Транспортные средства'),
        ('machine', 'Машины и оборудование'),
        ('computer', 'Компьютерная техника'),
        ('furniture', 'Мебель и инвентарь'),
        ('other', 'Прочие основные средства'),
    )
    METHOD = (
        ('straight', 'Линейный'),
        ('declining', 'Уменьшаемого остатка'),
        ('sumYears', 'По сумме чисел лет'),
        ('units', 'Производственный'),
    )
    STATUS = (
        ('operation', 'В эксплуатации'),
        ('conserved', 'На консервации'),
        ('sold', 'Продан'),
        ('written_off', 'Списан'),
    )

    inv_number = models.CharField('инвентарный номер', max_length=32)
    name = models.CharField('наименование', max_length=180)
    group = models.CharField('группа', max_length=16, choices=GROUP, default='other')

    # --- Учётные счета: значения по умолчанию соответствуют плану счетов ---
    account = models.CharField('счёт учёта', max_length=16, default='01')
    depreciation_account = models.CharField('счёт амортизации', max_length=16, default='02')
    expense_account = models.CharField('счёт затрат', max_length=16, default='26')

    # --- Стоимость и срок ---------------------------------------------------
    commissioned_at = models.DateField('дата ввода в эксплуатацию')
    initial_cost = models.DecimalField('первоначальная стоимость', **MONEY)
    salvage_value = models.DecimalField('ликвидационная стоимость', **MONEY)
    life_months = models.PositiveSmallIntegerField('срок полезного использования, мес.', default=60)

    method = models.CharField('метод амортизации', max_length=16, choices=METHOD, default='straight')
    # Коэффициент ускорения для метода уменьшаемого остатка (IAS 16 §62)
    declining_rate = models.DecimalField('коэффициент ускорения', max_digits=4, decimal_places=2, default=2)
    # Плановая и фактическая выработка для производственного метода
    total_units = models.DecimalField('плановая выработка', max_digits=16, decimal_places=2, default=0)
    used_units = models.DecimalField('фактическая выработка', max_digits=16, decimal_places=2, default=0)
    units_name = models.CharField('единица выработки', max_length=32, blank=True, default='')

    accumulated = models.DecimalField('накопленная амортизация', **MONEY)

    # --- Эксплуатация --------------------------------------------------------
    location = models.CharField('местонахождение', max_length=180, blank=True, default='')
    responsible = models.CharField('материально ответственное лицо', max_length=180, blank=True, default='')
    status = models.CharField('состояние', max_length=16, choices=STATUS, default='operation')
    disposed_at = models.DateField('дата выбытия', null=True, blank=True)
    disposal_reason = models.CharField('причина выбытия', max_length=255, blank=True, default='')
    note = models.CharField('примечание', max_length=255, blank=True, default='')

    class Meta:
        verbose_name = 'основное средство'
        verbose_name_plural = 'основные средства'
        ordering = ('inv_number',)
        indexes = [models.Index(fields=['status']), models.Index(fields=['group'])]

    def __str__(self):
        return f'{self.inv_number} — {self.name}'

    @property
    def residual(self):
        """Остаточная (балансовая) стоимость."""
        return self.initial_cost - self.accumulated


class Depreciation(CompanyModel):
    """Начисление амортизации за один месяц по одному объекту.

    Отдельная запись на объект и месяц: так видно, за какой период объект
    уже самортизирован, и повторное начисление отсекается по ключу периода.
    """

    ID_PREFIX = 'dep'

    asset = models.ForeignKey(
        FixedAsset, verbose_name='основное средство',
        on_delete=models.CASCADE, related_name='depreciations',
    )
    asset_name = models.CharField('объект', max_length=180, blank=True, default='')
    period_key = models.CharField('ключ периода', max_length=10)     # 2026-08
    period = models.CharField('период', max_length=40)               # Август 2026
    date = models.DateField('дата начисления')

    method = models.CharField('метод', max_length=16, default='straight')
    amount = models.DecimalField('сумма амортизации', **MONEY)
    units = models.DecimalField('выработка за период', max_digits=16, decimal_places=2, default=0)
    accumulated_after = models.DecimalField('накоплено после начисления', **MONEY)
    residual_after = models.DecimalField('остаточная стоимость после', **MONEY)

    entry = models.ForeignKey(
        Entry, verbose_name='проводка',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='depreciations',
    )
    posted = models.BooleanField('проведено', default=True)

    class Meta:
        verbose_name = 'начисление амортизации'
        verbose_name_plural = 'амортизация'
        ordering = ('-period_key', 'asset_name')
        unique_together = (('asset', 'period_key'),)
        indexes = [models.Index(fields=['period_key'])]

    def __str__(self):
        return f'{self.asset_name} — {self.period}'

"""Справочники: организации, контрагенты, товары, склады, сотрудники, интеграции.

ТЗ п. 6, 9, 13, 27, 29.
"""
from django.db import models

from apps.common.models import BaseModel, CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class Company(BaseModel):
    """Организация. Система поддерживает несколько юрлиц и филиалов."""

    ID_PREFIX = 'co'

    name = models.CharField('наименование', max_length=200)
    inn = models.CharField('ИНН', max_length=20, blank=True, default='')
    address = models.CharField('юридический адрес', max_length=255, blank=True, default='')
    phone = models.CharField('телефон', max_length=40, blank=True, default='')
    director = models.CharField('директор', max_length=180, blank=True, default='')
    accountant = models.CharField('главный бухгалтер', max_length=180, blank=True, default='')
    tax_mode = models.CharField('режим налогообложения', max_length=80, blank=True, default='')
    bank = models.CharField('банк', max_length=150, blank=True, default='')
    account = models.CharField('расчётный счёт', max_length=40, blank=True, default='')
    bik = models.CharField('БИК', max_length=20, blank=True, default='')

    class Meta:
        verbose_name = 'организация'
        verbose_name_plural = 'организации'
        ordering = ('name',)

    def __str__(self):
        return self.name


class Counterparty(CompanyModel):
    """Клиент или поставщик: реквизиты, условия работы, рейтинг."""

    ID_PREFIX = 'cp'

    KIND = (('client', 'Клиент'), ('supplier', 'Поставщик'))

    name = models.CharField('наименование', max_length=200)
    kind = models.CharField('тип', max_length=16, choices=KIND, default='client')
    inn = models.CharField('ИНН', max_length=20, blank=True, default='')
    address = models.CharField('адрес', max_length=255, blank=True, default='')
    phone = models.CharField('телефон', max_length=40, blank=True, default='')
    email = models.CharField('email', max_length=120, blank=True, default='')
    contact = models.CharField('контактное лицо', max_length=150, blank=True, default='')

    bank = models.CharField('банк', max_length=150, blank=True, default='')
    account = models.CharField('расчётный счёт', max_length=40, blank=True, default='')
    bik = models.CharField('БИК', max_length=20, blank=True, default='')

    rating = models.PositiveSmallIntegerField('рейтинг', default=4)
    credit_limit = models.DecimalField('кредитный лимит', **MONEY)
    due_days = models.PositiveSmallIntegerField('отсрочка платежа, дней', default=14)
    debt = models.DecimalField('задолженность', **MONEY)
    active = models.BooleanField('активен', default=True)
    notes = models.TextField('примечания', blank=True, default='')

    class Meta:
        verbose_name = 'контрагент'
        verbose_name_plural = 'контрагенты'
        ordering = ('name',)
        indexes = [models.Index(fields=['kind']), models.Index(fields=['inn'])]

    def __str__(self):
        return self.name


class Category(BaseModel):
    ID_PREFIX = 'cat'
    name = models.CharField('название', max_length=120)

    class Meta:
        verbose_name = 'категория товаров'
        verbose_name_plural = 'категории товаров'
        ordering = ('name',)


class Unit(BaseModel):
    ID_PREFIX = 'unit'
    name = models.CharField('обозначение', max_length=20)

    class Meta:
        verbose_name = 'единица измерения'
        verbose_name_plural = 'единицы измерения'
        ordering = ('name',)


class Warehouse(CompanyModel):
    ID_PREFIX = 'wh'

    name = models.CharField('название', max_length=150)
    branch = models.CharField('филиал', max_length=120, blank=True, default='')
    address = models.CharField('адрес', max_length=255, blank=True, default='')
    manager = models.CharField('ответственный', max_length=180, blank=True, default='')

    class Meta:
        verbose_name = 'склад'
        verbose_name_plural = 'склады'
        ordering = ('name',)


class Product(CompanyModel):
    """Номенклатура: артикул, штрихкод, цены (ТЗ п. 9)."""

    ID_PREFIX = 'prd'

    sku = models.CharField('артикул', max_length=40)
    barcode = models.CharField('штрихкод', max_length=40, blank=True, default='')
    name = models.CharField('наименование', max_length=255)
    category = models.ForeignKey(
        Category, verbose_name='категория', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='products',
    )
    unit = models.CharField('единица', max_length=20, default='шт')
    cost = models.DecimalField('себестоимость', **MONEY)
    price = models.DecimalField('цена продажи', **MONEY)
    vat = models.DecimalField('НДС, %', max_digits=5, decimal_places=2, default=12)
    min_stock = models.DecimalField('минимальный запас', max_digits=14, decimal_places=3, default=0)
    active = models.BooleanField('активен', default=True)

    class Meta:
        verbose_name = 'товар'
        verbose_name_plural = 'товары'
        ordering = ('name',)
        indexes = [models.Index(fields=['barcode']), models.Index(fields=['sku'])]

    def __str__(self):
        return self.name


class Employee(CompanyModel):
    """Сотрудник (ТЗ п. 13)."""

    ID_PREFIX = 'emp'

    STATUS = (('work', 'Работает'), ('vacation', 'В отпуске'), ('sick', 'Больничный'))

    full_name = models.CharField('ФИО', max_length=180)
    position = models.CharField('должность', max_length=120, blank=True, default='')
    department = models.CharField('отдел', max_length=120, blank=True, default='')
    hire_date = models.DateField('дата приёма', null=True, blank=True)
    salary = models.DecimalField('оклад', **MONEY)
    phone = models.CharField('телефон', max_length=40, blank=True, default='')
    email = models.CharField('email', max_length=120, blank=True, default='')
    inn = models.CharField('ИНН', max_length=20, blank=True, default='')
    contract_no = models.CharField('трудовой договор', max_length=40, blank=True, default='')
    status = models.CharField('статус', max_length=16, choices=STATUS, default='work')

    class Meta:
        verbose_name = 'сотрудник'
        verbose_name_plural = 'сотрудники'
        ordering = ('full_name',)

    def __str__(self):
        return self.full_name


class Integration(BaseModel):
    """Внешняя система: банк-клиент, ЭЦП, ККМ, сканеры, API (ТЗ п. 27)."""

    ID_PREFIX = 'int'

    STATUS = (('connected', 'Подключено'), ('disabled', 'Отключено'), ('pending', 'Настраивается'))

    name = models.CharField('название', max_length=150)
    kind = models.CharField('тип', max_length=32, default='api')
    status = models.CharField('состояние', max_length=16, choices=STATUS, default='disabled')
    description = models.CharField('описание', max_length=255, blank=True, default='')
    last_sync = models.DateTimeField('последняя синхронизация', null=True, blank=True)

    class Meta:
        verbose_name = 'интеграция'
        verbose_name_plural = 'интеграции'
        ordering = ('name',)


class AppSettings(BaseModel):
    """Единая запись настроек системы (валюта, ставки, оповещения)."""

    ID_PREFIX = 'set'

    currency = models.CharField('валюта', max_length=16, default='сом')
    language = models.CharField('язык интерфейса', max_length=8, default='ru')
    theme = models.CharField('тема', max_length=16, default='dark')
    density = models.CharField('плотность интерфейса', max_length=16, default='comfortable')

    vat_rate = models.DecimalField('НДС, %', max_digits=5, decimal_places=2, default=12)
    sales_tax_rate = models.DecimalField('налог с продаж, %', max_digits=5, decimal_places=2, default=2)
    income_tax_rate = models.DecimalField('подоходный налог, %', max_digits=5, decimal_places=2, default=10)
    social_fund_rate = models.DecimalField('соцфонд, %', max_digits=5, decimal_places=2, default=27.25)

    notify_telegram = models.BooleanField('уведомления в Telegram', default=True)
    notify_email = models.BooleanField('уведомления на email', default=True)
    notify_sms = models.BooleanField('уведомления по SMS', default=False)
    telegram_bot = models.CharField('Telegram-бот', max_length=80, blank=True, default='')
    smtp_host = models.CharField('SMTP-сервер', max_length=120, blank=True, default='')

    auto_backup = models.BooleanField('автоматический бэкап', default=True)
    backup_time = models.CharField('время бэкапа', max_length=10, default='03:00')
    session_timeout = models.PositiveSmallIntegerField('тайм-аут сессии, мин', default=30)
    require2fa = models.BooleanField('обязательная 2FA', default=False)
    password_policy = models.CharField('политика пароля', max_length=255, blank=True, default='')
    doc_number_format = models.CharField('формат номера документа', max_length=60, blank=True, default='')
    fiscal_year_start = models.CharField('начало финансового года', max_length=10, default='01-01')

    class Meta:
        verbose_name = 'настройки системы'
        verbose_name_plural = 'настройки системы'

    def __str__(self):
        return 'Настройки системы'

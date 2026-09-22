"""Документооборот, договоры и электронная подпись (ТЗ п. 3, 4, 16, 22)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}

DOC_TYPES = (
    ('invoice', 'Счёт на оплату'),
    ('waybill', 'Накладная'),
    ('act', 'Акт выполненных работ'),
    ('contract', 'Договор'),
    ('payment', 'Платёжный документ'),
    ('cash_order', 'Кассовый ордер'),
    ('vat_invoice', 'Счёт-фактура'),
    ('poa', 'Доверенность'),
    ('statement', 'Банковская выписка'),
    ('hr', 'Кадровый документ'),
)

DOC_STATUSES = (
    ('draft', 'Черновик'),
    ('review', 'На проверке'),
    ('approved', 'Одобрено'),
    ('rejected', 'Отклонено'),
    ('posted', 'Проведено'),
)


class Document(CompanyModel):
    """Электронный документ: файл, OCR-текст, маршрут согласования, история."""

    ID_PREFIX = 'doc'

    number = models.CharField('номер', max_length=60)
    type = models.CharField('тип', max_length=24, choices=DOC_TYPES, default='invoice')
    type_name = models.CharField('название типа', max_length=80, blank=True, default='')
    date = models.DateField('дата')
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='контрагент',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='documents',
    )
    amount = models.DecimalField('сумма', **MONEY)
    status = models.CharField('статус', max_length=16, choices=DOC_STATUSES, default='draft')

    file = models.FileField('файл', upload_to='documents/%Y/%m/', null=True, blank=True)
    file_name = models.CharField('имя файла', max_length=180, blank=True, default='')
    file_size = models.PositiveIntegerField('размер, КБ', default=0)

    ocr = models.BooleanField('распознан', default=False)
    ocr_text = models.TextField('распознанный текст', blank=True, default='')
    signed = models.BooleanField('подписан ЭЦП', default=False)

    tags = models.JSONField('метки', default=list, blank=True)
    route = models.JSONField('маршрут согласования', default=list, blank=True)
    history = models.JSONField('история изменений', default=list, blank=True)

    class Meta:
        verbose_name = 'документ'
        verbose_name_plural = 'документы'
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['type']), models.Index(fields=['status']), models.Index(fields=['date'])]

    def __str__(self):
        return f'{self.type_name or self.get_type_display()} {self.number}'

    def save(self, *args, **kwargs):
        if not self.type_name:
            self.type_name = dict(DOC_TYPES).get(self.type, self.type)
        super().save(*args, **kwargs)


class Contract(CompanyModel):
    """Договор: срок действия, сумма, связь с контрагентом (ТЗ п. 4)."""

    ID_PREFIX = 'ctr'

    SIDE = (('client', 'С покупателем'), ('supplier', 'С поставщиком'))
    STATUS = (('active', 'Действует'), ('expired', 'Истёк'), ('closed', 'Закрыт'))

    number = models.CharField('номер', max_length=60)
    date = models.DateField('дата заключения')
    counterparty = models.ForeignKey(
        'directories.Counterparty', verbose_name='контрагент',
        on_delete=models.CASCADE, related_name='contracts',
    )
    side = models.CharField('сторона', max_length=16, choices=SIDE, default='client')
    type = models.CharField('тип договора', max_length=80, blank=True, default='')
    subject = models.TextField('предмет договора', blank=True, default='')
    amount = models.DecimalField('сумма', **MONEY)
    currency = models.CharField('валюта', max_length=8, default='KGS')

    start_date = models.DateField('действует с', null=True, blank=True)
    end_date = models.DateField('действует до')
    auto_renew = models.BooleanField('автопролонгация', default=False)
    signed = models.BooleanField('подписан', default=False)
    status = models.CharField('статус', max_length=16, choices=STATUS, default='active')

    responsible = models.CharField('ответственный', max_length=180, blank=True, default='')
    template = models.CharField('шаблон', max_length=120, blank=True, default='')
    notes = models.TextField('примечания', blank=True, default='')

    class Meta:
        verbose_name = 'договор'
        verbose_name_plural = 'договоры'
        ordering = ('-date',)

    def __str__(self):
        return f'Договор {self.number}'


class Signature(CompanyModel):
    """Электронная подпись документа (ТЗ п. 22)."""

    ID_PREFIX = 'sig'

    # Имя поля `doc` даёт в API ключ `docId` — так же, как в клиенте
    doc = models.ForeignKey(
        Document, verbose_name='документ', on_delete=models.CASCADE, related_name='signatures',
    )
    doc_number = models.CharField('номер документа', max_length=60, blank=True, default='')
    doc_type = models.CharField('тип документа', max_length=80, blank=True, default='')
    signer = models.CharField('подписал', max_length=180)
    cert = models.CharField('сертификат', max_length=80)
    issuer = models.CharField('издатель', max_length=180, blank=True, default='')
    algorithm = models.CharField('алгоритм', max_length=60, blank=True, default='ГОСТ Р 34.10-2012')
    valid_until = models.DateField('действителен до', null=True, blank=True)
    ts = models.DateTimeField('дата подписи')
    valid = models.BooleanField('подпись действительна', default=True)

    class Meta:
        verbose_name = 'электронная подпись'
        verbose_name_plural = 'электронные подписи'
        ordering = ('-ts',)

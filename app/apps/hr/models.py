"""Расчёт зарплаты и учёт рабочего времени (ТЗ п. 13)."""
from django.db import models

from apps.common.models import CompanyModel

MONEY = {'max_digits': 16, 'decimal_places': 2, 'default': 0}


class Payroll(CompanyModel):
    """Начисление заработной платы сотруднику за период."""

    ID_PREFIX = 'prl'

    STATUS = (('calculated', 'Рассчитано'), ('paid', 'Выплачено'))

    period_key = models.CharField('ключ периода', max_length=10)
    period = models.CharField('период', max_length=40)
    employee = models.ForeignKey(
        'directories.Employee', verbose_name='сотрудник',
        on_delete=models.CASCADE, related_name='payrolls',
    )
    employee_name = models.CharField('ФИО', max_length=180, blank=True, default='')
    position = models.CharField('должность', max_length=120, blank=True, default='')

    base = models.DecimalField('оклад', **MONEY)
    bonus = models.DecimalField('премия', **MONEY)
    gross = models.DecimalField('начислено', **MONEY)
    income_tax = models.DecimalField('подоходный налог', **MONEY)
    social = models.DecimalField('соцфонд', **MONEY)
    net = models.DecimalField('к выплате', **MONEY)

    status = models.CharField('статус', max_length=16, choices=STATUS, default='calculated')
    paid_at = models.DateField('дата выплаты', null=True, blank=True)

    class Meta:
        verbose_name = 'расчёт зарплаты'
        verbose_name_plural = 'расчёты зарплаты'
        ordering = ('-period_key', 'employee_name')
        unique_together = (('period_key', 'employee'),)

    def __str__(self):
        return f'{self.employee_name} — {self.period}'


class Timesheet(CompanyModel):
    """Табель: рабочий день, отпуск или больничный."""

    ID_PREFIX = 'tim'

    TYPE = (('work', 'Рабочий день'), ('vacation', 'Отпуск'), ('sick', 'Больничный'))

    employee = models.ForeignKey(
        'directories.Employee', verbose_name='сотрудник',
        on_delete=models.CASCADE, related_name='timesheets',
    )
    employee_name = models.CharField('ФИО', max_length=180, blank=True, default='')
    date = models.DateField('дата')
    type = models.CharField('вид дня', max_length=16, choices=TYPE, default='work')
    hours = models.DecimalField('часов', max_digits=5, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'запись табеля'
        verbose_name_plural = 'табель рабочего времени'
        ordering = ('-date',)
        unique_together = (('employee', 'date'),)

    def __str__(self):
        return f'{self.employee_name} — {self.date}'

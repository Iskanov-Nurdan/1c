"""Сервисы API: агрегаты для дашборда (ТЗ п. 17, 19)."""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import F, Q, Sum

from apps.finance.models import CashOrder, Payment
from apps.inventory.models import PurchaseOrder
from apps.sales.models import Sale


def _zero(value):
    return value or Decimal('0')


def dashboard_summary(user):
    """Ключевые показатели: выручка, расходы, прибыль, долги, остатки денег."""
    today = date.today()
    month_start = today.replace(day=1)
    prev_end = month_start - timedelta(days=1)
    prev_start = prev_end.replace(day=1)

    sales = Sale.objects.all()
    orders = PurchaseOrder.objects.exclude(status='cancelled')
    cash = CashOrder.objects.all()
    payments = Payment.objects.filter(status='executed')

    if not user.is_superuser:
        company_ids = list(user.companies.values_list('id', flat=True))
        if company_ids:
            scope = Q(company_id__in=company_ids) | Q(company__isnull=True)
            sales, orders = sales.filter(scope), orders.filter(scope)
            cash, payments = cash.filter(scope), payments.filter(scope)

    def revenue(start, end):
        return _zero(sales.filter(date__gte=start, date__lte=end).aggregate(s=Sum('amount'))['s'])

    def expense(start, end):
        purchases = _zero(orders.filter(date__gte=start, date__lte=end).aggregate(s=Sum('amount'))['s'])
        cash_out = _zero(
            cash.filter(kind='out', date__gte=start, date__lte=end).aggregate(s=Sum('amount'))['s']
        )
        return purchases + cash_out

    revenue_now, revenue_prev = revenue(month_start, today), revenue(prev_start, prev_end)
    expense_now, expense_prev = expense(month_start, today), expense(prev_start, prev_end)

    receivable = _zero(
        sales.filter(amount__gt=F('paid')).aggregate(s=Sum(F('amount') - F('paid')))['s']
    )
    overdue = _zero(
        sales.filter(amount__gt=F('paid'), due_date__lt=today)
        .aggregate(s=Sum(F('amount') - F('paid')))['s']
    )
    payable = _zero(
        orders.filter(amount__gt=F('paid')).aggregate(s=Sum(F('amount') - F('paid')))['s']
    )

    cash_in = _zero(cash.filter(kind='in').aggregate(s=Sum('amount'))['s'])
    cash_out_total = _zero(cash.filter(kind='out').aggregate(s=Sum('amount'))['s'])
    bank_in = _zero(payments.filter(kind='in').aggregate(s=Sum('amount'))['s'])
    bank_out = _zero(payments.filter(kind='out').aggregate(s=Sum('amount'))['s'])

    return {
        'revenue': float(revenue_now),
        'revenuePrev': float(revenue_prev),
        'expense': float(expense_now),
        'expensePrev': float(expense_prev),
        'profit': float(revenue_now - expense_now),
        'receivable': float(receivable),
        'overdue': float(overdue),
        'payable': float(payable),
        'cashBalance': float(cash_in - cash_out_total),
        'bankBalance': float(bank_in - bank_out),
        'salesCount': sales.count(),
        'period': month_start.isoformat(),
    }

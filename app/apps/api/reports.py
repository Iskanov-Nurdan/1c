"""Сервисы отчётности (ТЗ п. 4).

Здесь собрана вся бухгалтерская математика: оборотно-сальдовая ведомость,
баланс, отчёт о прибылях и убытках, движение денежных средств и расшифровка
задолженности. Представления только разбирают параметры запроса и отдают
результат — бизнес-логика не выходит за пределы этого модуля.

Источник данных для учётных отчётов — проведённые проводки (двойная запись),
для денежных — кассовые ордера и исполненные платежи.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import F, Q, Sum

from apps.accounting.models import Account, Entry
from apps.finance.models import CashOrder, Payment
from apps.inventory.models import PurchaseOrder
from apps.sales.models import Sale

ZERO = Decimal('0')

#: Разделы баланса: код группы счёта → (сторона, раздел).
BALANCE_SECTIONS = {
    '01': ('asset', 'Внеоборотные активы'),
    '02': ('asset', 'Внеоборотные активы'),      # контрактив: уменьшает актив
    '04': ('asset', 'Внеоборотные активы'),
    '10': ('asset', 'Запасы'),
    '20': ('asset', 'Запасы'),
    '26': ('asset', 'Запасы'),
    '41': ('asset', 'Запасы'),
    '43': ('asset', 'Запасы'),
    '44': ('asset', 'Запасы'),
    '50': ('asset', 'Денежные средства'),
    '51': ('asset', 'Денежные средства'),
    '52': ('asset', 'Денежные средства'),
    '60': ('both', 'Расчёты с поставщиками'),
    '62': ('both', 'Расчёты с покупателями'),
    '71': ('both', 'Расчёты с подотчётными лицами'),
    '76': ('both', 'Прочие расчёты'),
    '66': ('liability', 'Кредиты и займы'),
    '68': ('both', 'Расчёты по налогам'),
    '69': ('liability', 'Расчёты по соцстрахованию'),
    '70': ('liability', 'Расчёты с персоналом'),
    '80': ('liability', 'Капитал'),
    '84': ('liability', 'Капитал'),
    '99': ('liability', 'Капитал'),
}

#: Счета результата — в баланс не попадают, закрываются в прибыль.
RESULT_GROUPS = ('90', '91')

#: Классификация денежных потоков по назначению операции (ТЗ п. 4, ДДС).
FLOW_RULES = (
    ('investing', ('основн', 'оборудован', 'станок', 'автомоб', 'строительс')),
    ('financing', ('кредит', 'займ', 'дивиденд', 'уставн', 'лизинг')),
)


# --- Вспомогательное -------------------------------------------------------

def scope(queryset, user):
    """Ограничение выборки организациями пользователя (ТЗ п. 29)."""
    if user.is_superuser:
        return queryset
    company_ids = list(user.companies.values_list('id', flat=True))
    if not company_ids:
        return queryset
    return queryset.filter(Q(company_id__in=company_ids) | Q(company__isnull=True))


def parse_range(params):
    """Разбирает from/to из query-параметров; по умолчанию — текущий год."""
    today = date.today()
    date_from = parse_date(params.get('from')) or today.replace(month=1, day=1)
    date_to = parse_date(params.get('to')) or today
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    return date_from, date_to


def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _group(code):
    """Группа счёта: 41.1 → 41."""
    return str(code).split('.')[0]


def _money(value):
    return float(value or ZERO)


def _neg(value):
    """Расходная строка отчёта: со знаком минус, но без «-0»."""
    amount = _money(value)
    return -amount if amount else 0.0


# --- Оборотно-сальдовая ведомость -----------------------------------------

def turnover_sheet(user, date_from, date_to):
    """ОСВ: сальдо на начало, обороты за период, сальдо на конец по каждому счёту."""
    accounts = list(Account.objects.all().order_by('code'))
    entries = scope(Entry.objects.filter(posted=True), user)

    before = entries.filter(date__lt=date_from)
    inside = entries.filter(date__gte=date_from, date__lte=date_to)

    debit_before = _sum_by(before, 'debit')
    credit_before = _sum_by(before, 'credit')
    debit_now = _sum_by(inside, 'debit')
    credit_now = _sum_by(inside, 'credit')

    rows = []
    for account in accounts:
        code = account.code
        opening = _opening(account) + debit_before.get(code, ZERO) - credit_before.get(code, ZERO)
        turn_debit = debit_now.get(code, ZERO)
        turn_credit = credit_now.get(code, ZERO)
        closing = opening + turn_debit - turn_credit

        if not (opening or turn_debit or turn_credit or closing):
            continue

        rows.append({
            'code': code,
            'name': account.name,
            'kind': account.kind,
            'openingDebit': _money(opening if opening > 0 else ZERO),
            'openingCredit': _money(-opening if opening < 0 else ZERO),
            'turnoverDebit': _money(turn_debit),
            'turnoverCredit': _money(turn_credit),
            'closingDebit': _money(closing if closing > 0 else ZERO),
            'closingCredit': _money(-closing if closing < 0 else ZERO),
        })

    totals = {
        key: round(sum(row[key] for row in rows), 2)
        for key in ('openingDebit', 'openingCredit', 'turnoverDebit', 'turnoverCredit',
                    'closingDebit', 'closingCredit')
    }
    return {
        'from': date_from.isoformat(),
        'to': date_to.isoformat(),
        'rows': rows,
        'totals': totals,
        'balanced': abs(totals['turnoverDebit'] - totals['turnoverCredit']) < 0.01,
    }


def _sum_by(queryset, field):
    """Суммы проводок по счёту: {'41.1': Decimal(...)}."""
    result = {}
    for row in queryset.values(field).annotate(total=Sum('amount')):
        result[row[field]] = row['total'] or ZERO
    return result


def _opening(account):
    """Входящее сальдо со знаком: плюс — дебетовое, минус — кредитовое.

    В справочнике сальдо хранится модулем, сторону задаёт вид счёта:
    у пассивного она кредитовая, у активного и активно-пассивного — дебетовая.
    """
    base = account.opening or ZERO
    return -base if account.kind == 'P' else base


# --- Бухгалтерский баланс --------------------------------------------------

def balance_sheet(user, on_date):
    """Баланс на дату: актив и пассив, сгруппированные по разделам."""
    sheet = turnover_sheet(user, date(1970, 1, 1), on_date)

    assets = defaultdict(float)
    liabilities = defaultdict(float)
    profit = 0.0

    for row in sheet['rows']:
        group = _group(row['code'])
        balance = row['closingDebit'] - row['closingCredit']

        if group in RESULT_GROUPS:
            profit -= balance          # дебет 90.2 — расход, кредит 90.1 — доход
            continue

        side, section = BALANCE_SECTIONS.get(group, ('both', 'Прочие активы и обязательства'))

        if group == '02':              # амортизация уменьшает внеоборотные активы
            assets[section] += balance
            continue

        if side == 'asset' or (side == 'both' and balance >= 0):
            assets[section] += balance
        else:
            liabilities[section] += -balance

    if abs(profit) > 0.005:
        liabilities['Капитал'] += profit

    asset_rows = _sections(assets)
    liability_rows = _sections(liabilities)
    asset_total = round(sum(item['amount'] for item in asset_rows), 2)
    liability_total = round(sum(item['amount'] for item in liability_rows), 2)

    return {
        'date': on_date.isoformat(),
        'assets': asset_rows,
        'liabilities': liability_rows,
        'assetTotal': asset_total,
        'liabilityTotal': liability_total,
        'difference': round(asset_total - liability_total, 2),
        'balanced': abs(asset_total - liability_total) < 0.01,
        'profit': round(profit, 2),
    }


def _sections(mapping):
    return [
        {'section': name, 'amount': round(amount, 2)}
        for name, amount in sorted(mapping.items(), key=lambda pair: -abs(pair[1]))
        if abs(amount) > 0.005
    ]


# --- Отчёт о прибылях и убытках -------------------------------------------

def profit_and_loss(user, date_from, date_to):
    """ОПУ: выручка, себестоимость, расходы, налог, чистая прибыль."""
    entries = scope(Entry.objects.filter(posted=True, date__gte=date_from, date__lte=date_to), user)
    debit = _sum_by(entries, 'debit')
    credit = _sum_by(entries, 'credit')

    def by_group(mapping, group):
        return sum((value for code, value in mapping.items() if _group(code) == group), ZERO)

    revenue = credit.get('90.1', ZERO) or by_group(credit, '90')
    cost = debit.get('90.2', ZERO)
    selling = by_group(debit, '44')
    admin = by_group(debit, '26')
    other_income = by_group(credit, '91')
    other_expense = by_group(debit, '91')
    tax = debit.get('68.2', ZERO)

    gross = revenue - cost
    operating = gross - selling - admin
    before_tax = operating + other_income - other_expense
    net = before_tax - tax

    lines = [
        {'code': '2110', 'name': 'Выручка', 'amount': _money(revenue), 'level': 0},
        {'code': '2120', 'name': 'Себестоимость продаж', 'amount': _neg(cost), 'level': 1},
        {'code': '2100', 'name': 'Валовая прибыль', 'amount': _money(gross), 'level': 0, 'total': True},
        {'code': '2210', 'name': 'Коммерческие расходы', 'amount': _neg(selling), 'level': 1},
        {'code': '2220', 'name': 'Управленческие расходы', 'amount': _neg(admin), 'level': 1},
        {'code': '2200', 'name': 'Прибыль от продаж', 'amount': _money(operating), 'level': 0, 'total': True},
        {'code': '2340', 'name': 'Прочие доходы', 'amount': _money(other_income), 'level': 1},
        {'code': '2350', 'name': 'Прочие расходы', 'amount': _neg(other_expense), 'level': 1},
        {'code': '2300', 'name': 'Прибыль до налогообложения', 'amount': _money(before_tax),
         'level': 0, 'total': True},
        {'code': '2410', 'name': 'Налог на прибыль', 'amount': _neg(tax), 'level': 1},
        {'code': '2400', 'name': 'Чистая прибыль', 'amount': _money(net), 'level': 0, 'total': True},
    ]

    return {
        'from': date_from.isoformat(),
        'to': date_to.isoformat(),
        'lines': lines,
        'revenue': _money(revenue),
        'net': _money(net),
        'margin': round(_money(gross) / _money(revenue) * 100, 1) if revenue else 0.0,
    }


# --- Движение денежных средств --------------------------------------------

def cash_flow(user, date_from, date_to):
    """ДДС: остаток на начало, притоки и оттоки по видам деятельности, остаток на конец."""
    cash = scope(CashOrder.objects.all(), user)
    bank = scope(Payment.objects.filter(status='executed'), user)

    opening = (
        _total(cash.filter(date__lt=date_from, kind='in'))
        - _total(cash.filter(date__lt=date_from, kind='out'))
        + _total(bank.filter(date__lt=date_from, kind='in'))
        - _total(bank.filter(date__lt=date_from, kind='out'))
    )

    inflow = defaultdict(float)
    outflow = defaultdict(float)

    for order in cash.filter(date__gte=date_from, date__lte=date_to):
        target = inflow if order.kind == 'in' else outflow
        target[_activity(order.basis)] += float(order.amount)

    for payment in bank.filter(date__gte=date_from, date__lte=date_to):
        target = inflow if payment.kind == 'in' else outflow
        target[_activity(payment.purpose)] += float(payment.amount)

    titles = (
        ('operating', 'Операционная деятельность'),
        ('investing', 'Инвестиционная деятельность'),
        ('financing', 'Финансовая деятельность'),
    )

    rows = []
    for key, title in titles:
        income, expense = round(inflow.get(key, 0.0), 2), round(outflow.get(key, 0.0), 2)
        if not income and not expense:
            continue
        rows.append({'activity': key, 'name': title, 'inflow': income,
                     'outflow': expense, 'net': round(income - expense, 2)})

    total_in = round(sum(row['inflow'] for row in rows), 2)
    total_out = round(sum(row['outflow'] for row in rows), 2)

    return {
        'from': date_from.isoformat(),
        'to': date_to.isoformat(),
        'opening': round(float(opening), 2),
        'rows': rows,
        'inflow': total_in,
        'outflow': total_out,
        'net': round(total_in - total_out, 2),
        'closing': round(float(opening) + total_in - total_out, 2),
        'cashBalance': round(float(_total(cash.filter(kind='in')) - _total(cash.filter(kind='out'))), 2),
        'bankBalance': round(float(_total(bank.filter(kind='in')) - _total(bank.filter(kind='out'))), 2),
    }


def _total(queryset):
    return queryset.aggregate(s=Sum('amount'))['s'] or ZERO


def _activity(text):
    lowered = str(text or '').lower()
    for activity, markers in FLOW_RULES:
        if any(marker in lowered for marker in markers):
            return activity
    return 'operating'


# --- Задолженность ---------------------------------------------------------

def debt_report(user, on_date=None):
    """Дебиторская и кредиторская задолженность с выделением просрочки (ТЗ п. 4)."""
    on_date = on_date or date.today()

    sales = scope(Sale.objects.filter(amount__gt=F('paid')), user).select_related('counterparty')
    orders = scope(
        PurchaseOrder.objects.filter(amount__gt=F('paid')).exclude(status='cancelled'), user
    ).select_related('supplier')

    receivable = _debt_rows(sales, on_date, 'counterparty')
    payable = _debt_rows(orders, on_date, 'supplier')

    return {
        'date': on_date.isoformat(),
        'receivable': receivable,
        'payable': payable,
        'receivableTotal': round(sum(row['debt'] for row in receivable), 2),
        'payableTotal': round(sum(row['debt'] for row in payable), 2),
        'overdueTotal': round(sum(row['overdue'] for row in receivable), 2),
    }


def _debt_rows(queryset, on_date, party_field):
    grouped = defaultdict(lambda: {'debt': 0.0, 'overdue': 0.0, 'docs': 0, 'days': 0})

    for doc in queryset:
        party = getattr(doc, party_field, None)
        name = party.name if party else 'Без контрагента'
        debt = float(doc.amount - doc.paid)
        due = getattr(doc, 'due_date', None)
        overdue_days = (on_date - due).days if due and due < on_date else 0

        row = grouped[name]
        row['debt'] += debt
        row['docs'] += 1
        if overdue_days > 0:
            row['overdue'] += debt
            row['days'] = max(row['days'], overdue_days)

    return [
        {'name': name, 'debt': round(data['debt'], 2), 'overdue': round(data['overdue'], 2),
         'docs': data['docs'], 'daysOverdue': data['days']}
        for name, data in sorted(grouped.items(), key=lambda pair: -pair[1]['debt'])
    ]


# --- Реестр отчётов --------------------------------------------------------

REPORTS = {
    'turnover': lambda user, params: turnover_sheet(user, *parse_range(params)),
    'balance': lambda user, params: balance_sheet(user, parse_date(params.get('to')) or date.today()),
    'pnl': lambda user, params: profit_and_loss(user, *parse_range(params)),
    'cashflow': lambda user, params: cash_flow(user, *parse_range(params)),
    'debts': lambda user, params: debt_report(user, parse_date(params.get('to'))),
}

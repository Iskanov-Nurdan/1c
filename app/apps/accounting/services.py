"""Расчёт амортизации основных средств (МСФО (IAS) 16).

Здесь только вычисления и запись результата — представления остаются
тонкими. Те же формулы продублированы в браузере (static/js/core/depreciation.js),
потому что демо-режим работает без сервера; расхождения не допускаются, при
правке одной стороны правится и вторая.

СОГЛАШЕНИЯ УЧЁТА
1. Начисление идёт с месяца, следующего за вводом в эксплуатацию, и
   прекращается в месяце выбытия — так ведут учёт в КР и РФ.
2. Амортизируемая база — первоначальная стоимость минус ликвидационная
   (IAS 16 §53). Ниже ликвидационной стоимость объекта не опускается.
3. В последнем месяце срока доначисляется весь остаток базы: иначе
   копеечные погрешности округления оставляют «хвост» на счёте 02.
"""
from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from apps.accounting.models import Depreciation, Entry, FixedAsset

CENT = Decimal('0.01')
MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


def period_key(day: date) -> str:
    return f'{day.year:04d}-{day.month:02d}'


def period_name(day: date) -> str:
    return f'{MONTHS_NOM[day.month - 1]} {day.year}'


def month_end(day: date) -> date:
    return day.replace(day=monthrange(day.year, day.month)[1])


def months_between(start: date, end: date) -> int:
    """Полных календарных месяцев между двумя датами."""
    return (end.year - start.year) * 12 + (end.month - start.month)


def month_number(asset: FixedAsset, day: date) -> int:
    """Номер месяца эксплуатации: 1 — первый месяц начисления.

    0 или меньше означает, что месяц наступил до начала начисления.
    """
    return months_between(asset.commissioned_at, day)


def depreciable_base(asset: FixedAsset) -> Decimal:
    return max(money(asset.initial_cost) - money(asset.salvage_value), Decimal('0'))


def is_accruable(asset: FixedAsset, day: date) -> bool:
    """Начисляется ли амортизация по объекту в этом месяце."""
    if asset.status in ('sold', 'written_off', 'conserved'):
        return False
    if asset.disposed_at and period_key(asset.disposed_at) <= period_key(day):
        return False
    if month_number(asset, day) < 1:
        return False
    return money(asset.accumulated) < depreciable_base(asset)


def monthly_amount(asset: FixedAsset, day: date, units=None, accumulated=None) -> Decimal:
    """Сумма амортизации за месяц ``day`` по методу объекта.

    ``accumulated`` позволяет считать прогноз, не трогая объект в базе.
    """
    base = depreciable_base(asset)
    done = money(asset.accumulated if accumulated is None else accumulated)
    left = base - done
    if left <= 0:
        return Decimal('0')

    life = max(int(asset.life_months or 0), 1)
    number = month_number(asset, day)
    # Месяц ввода в эксплуатацию не амортизируется: начисление идёт со следующего
    if number < 1:
        return Decimal('0')
    method = asset.method

    if method == 'declining':
        # Остаточная балансовая стоимость, а не база: ускоренный метод
        # считается от неё (IAS 16 §62).
        book = money(asset.initial_cost) - done
        rate = Decimal(asset.declining_rate or 2)
        amount = book * rate / Decimal(life)
    elif method == 'sumYears':
        years = max((life + 11) // 12, 1)
        year_no = min((number - 1) // 12 + 1, years)
        syd = Decimal(years * (years + 1) / 2)
        amount = base * Decimal(years - year_no + 1) / syd / Decimal('12')
    elif method == 'units':
        total = Decimal(asset.total_units or 0)
        if total <= 0 or units is None:
            return Decimal('0')
        amount = base * Decimal(units) / total
    else:  # straight
        amount = base / Decimal(life)

    amount = money(amount)

    # Последний месяц срока и любой перебор закрываются остатком базы
    if number >= life or amount > left:
        amount = left
    return money(max(amount, Decimal('0')))


def schedule(asset: FixedAsset, limit: int = 120):
    """Прогноз начислений по месяцам — для карточки объекта.

    Считается «с нуля», от даты ввода в эксплуатацию, поэтому график не
    зависит от того, за какие месяцы начисление уже выполнено.
    """
    rows = []
    accumulated = Decimal('0')
    base = depreciable_base(asset)
    life = max(int(asset.life_months or 0), 1)
    cursor = asset.commissioned_at

    for i in range(1, min(life, limit) + 1):
        year = cursor.year + (cursor.month - 1 + i) // 12
        month = (cursor.month - 1 + i) % 12 + 1
        day = date(year, month, monthrange(year, month)[1])
        # Производственный метод без факта выработки прогнозируется равномерно
        units = (Decimal(asset.total_units or 0) / Decimal(life)) if asset.method == 'units' else None
        amount = monthly_amount(asset, day, units=units, accumulated=accumulated)
        if amount <= 0:
            break
        accumulated += amount
        rows.append({
            'periodKey': period_key(day),
            'period': period_name(day),
            'date': day.isoformat(),
            'amount': float(amount),
            'accumulated': float(accumulated),
            'residual': float(money(asset.initial_cost) - accumulated),
        })
        if accumulated >= base:
            break
    return rows


def accrue(company, day: date, assets=None, units_by_asset=None, author: str = ''):
    """Начисляет амортизацию за месяц и создаёт проводки Дт затрат Кт 02.

    Возвращает список созданных начислений. Объекты, по которым за период
    уже начисляли, пропускаются: ключ (объект, период) уникален.
    """
    day = month_end(day)
    key = period_key(day)
    units_by_asset = units_by_asset or {}

    queryset = assets if assets is not None else FixedAsset.objects.filter(status='operation')
    if company is not None and assets is None:
        queryset = queryset.filter(company=company)

    done_keys = set(
        Depreciation.objects.filter(period_key=key, asset__in=queryset).values_list('asset_id', flat=True)
    )

    created = []
    for asset in queryset:
        if asset.id in done_keys or not is_accruable(asset, day):
            continue

        amount = monthly_amount(asset, day, units=units_by_asset.get(asset.id))
        if amount <= 0:
            continue

        entry = Entry.objects.create(
            company=asset.company,
            date=day,
            debit=asset.expense_account,
            credit=asset.depreciation_account,
            amount=amount,
            content=f'Начислена амортизация: {asset.name} ({period_name(day)})',
            auto=True,
            posted=True,
            author=author,
        )

        asset.accumulated = money(asset.accumulated) + amount
        if asset.method == 'units' and units_by_asset.get(asset.id):
            asset.used_units = Decimal(asset.used_units or 0) + Decimal(units_by_asset[asset.id])
        asset.save(update_fields=['accumulated', 'used_units', 'updated_at'])

        created.append(Depreciation.objects.create(
            company=asset.company,
            asset=asset,
            asset_name=asset.name,
            period_key=key,
            period=period_name(day),
            date=day,
            method=asset.method,
            amount=amount,
            units=Decimal(units_by_asset.get(asset.id) or 0),
            accumulated_after=asset.accumulated,
            residual_after=money(asset.initial_cost) - asset.accumulated,
            entry=entry,
            posted=True,
            author=author,
        ))

    return created

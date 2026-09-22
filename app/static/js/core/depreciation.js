/* =============================================================================
   РАСЧЁТ АМОРТИЗАЦИИ ОСНОВНЫХ СРЕДСТВ — МСФО (IAS) 16

   Только вычисления: ни DOM, ни хранилища. Формулы нужны и генератору
   демо-данных, и интерфейсу, поэтому лежат в ядре, а не в модуле раздела.
   Зеркало серверной реализации apps/accounting/services.py — при правке
   одной стороны правится и вторая, иначе демо-режим и боевой контур
   разойдутся в суммах.

   СОГЛАШЕНИЯ УЧЁТА
   1. Начисление идёт с месяца, следующего за вводом в эксплуатацию, и
      прекращается в месяце выбытия — так ведут учёт в КР и РФ.
   2. Амортизируемая база = первоначальная − ликвидационная стоимость
      (IAS 16 §53). Ниже ликвидационной стоимость объекта не опускается.
   3. В последнем месяце срока доначисляется весь остаток базы: иначе
      копеечные погрешности округления оставляют «хвост» на счёте 02.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;

  const GROUPS = [
    { v: 'building', t: 'Здания и сооружения' },
    { v: 'vehicle', t: 'Транспортные средства' },
    { v: 'machine', t: 'Машины и оборудование' },
    { v: 'computer', t: 'Компьютерная техника' },
    { v: 'furniture', t: 'Мебель и инвентарь' },
    { v: 'other', t: 'Прочие основные средства' }
  ];

  const METHODS = [
    { v: 'straight', t: 'Линейный', hint: 'Равными долями за весь срок службы' },
    { v: 'declining', t: 'Уменьшаемого остатка', hint: 'От остаточной стоимости с коэффициентом ускорения' },
    { v: 'sumYears', t: 'По сумме чисел лет', hint: 'Ускоренный: доля года убывает пропорционально остатку срока' },
    { v: 'units', t: 'Производственный', hint: 'Пропорционально фактической выработке за период' }
  ];

  const STATUSES = [
    { v: 'operation', t: 'В эксплуатации', tone: 'ok' },
    { v: 'conserved', t: 'На консервации', tone: 'warn' },
    { v: 'sold', t: 'Продан', tone: 'info' },
    { v: 'written_off', t: 'Списан', tone: '' }
  ];

  /* Типовые сроки полезного использования по группам, месяцев. Подсказка
     при приёме к учёту: окончательный срок задаёт учётная политика. */
  const TYPICAL_LIFE = {
    building: 480, vehicle: 84, machine: 120, computer: 48, furniture: 84, other: 60
  };

  function label(list, v) {
    const found = list.filter(function (x) { return x.v === v; })[0];
    return found ? found.t : (v || '—');
  }

  function money(v) { return U.round(Number(v) || 0, 2); }

  /** Последний день месяца по ключу «2026-08» */
  function monthEnd(key) {
    const parts = String(key).split('-');
    return U.iso(new Date(Number(parts[0]), Number(parts[1]), 0));
  }

  function monthsBetween(fromIso, toIso) {
    const a = new Date(fromIso), b = new Date(toIso);
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  /** Номер месяца эксплуатации: 1 — первый месяц начисления */
  function monthNumber(asset, dateIso) {
    return monthsBetween(asset.commissionedAt, dateIso);
  }

  function depreciableBase(asset) {
    return Math.max(money(asset.initialCost) - money(asset.salvageValue), 0);
  }

  function residual(asset) {
    return money(money(asset.initialCost) - money(asset.accumulated));
  }

  /** Начисляется ли амортизация по объекту в этом месяце */
  function isAccruable(asset, dateIso) {
    if (['sold', 'written_off', 'conserved'].indexOf(asset.status) > -1) return false;
    if (asset.disposedAt && U.ym(asset.disposedAt) <= U.ym(dateIso)) return false;
    if (monthNumber(asset, dateIso) < 1) return false;
    return money(asset.accumulated) < depreciableBase(asset);
  }

  /**
   * Сумма амортизации за месяц.
   * @param {object} opts  units — выработка за период (производственный метод),
   *                       accumulated — накоплено на начало месяца; передаётся
   *                       при построении прогноза, чтобы не трогать объект.
   */
  function monthlyAmount(asset, dateIso, opts) {
    const o = opts || {};
    const base = depreciableBase(asset);
    const done = money(o.accumulated === undefined ? asset.accumulated : o.accumulated);
    const left = money(base - done);
    if (left <= 0) return 0;

    const life = Math.max(Number(asset.lifeMonths) || 0, 1);
    const number = monthNumber(asset, dateIso);
    // Месяц ввода в эксплуатацию не амортизируется: начисление идёт со следующего
    if (number < 1) return 0;
    let amount;

    if (asset.method === 'declining') {
      // Ускоренный метод считается от остаточной балансовой стоимости (IAS 16 §62)
      const book = money(asset.initialCost) - done;
      amount = book * (Number(asset.decliningRate) || 2) / life;
    } else if (asset.method === 'sumYears') {
      const years = Math.max(Math.ceil(life / 12), 1);
      const yearNo = Math.min(Math.floor((number - 1) / 12) + 1, years);
      const syd = years * (years + 1) / 2;
      amount = base * (years - yearNo + 1) / syd / 12;
    } else if (asset.method === 'units') {
      const total = Number(asset.totalUnits) || 0;
      if (total <= 0 || o.units === undefined || o.units === null) return 0;
      amount = base * Number(o.units) / total;
    } else {
      amount = base / life;
    }

    amount = money(amount);
    // Последний месяц срока и любой перебор закрываются остатком базы
    if (number >= life || amount > left) amount = left;
    return money(Math.max(amount, 0));
  }

  /**
   * Помесячный прогноз до конца срока. Считается «с нуля», от даты ввода в
   * эксплуатацию, поэтому не зависит от того, за какие месяцы начисление
   * уже выполнено.
   */
  function schedule(asset, limit) {
    const rows = [];
    const cap = limit || 600;
    const base = depreciableBase(asset);
    const life = Math.max(Number(asset.lifeMonths) || 0, 1);
    const start = new Date(asset.commissionedAt);
    let accumulated = 0;

    for (let i = 1; i <= Math.min(life, cap); i++) {
      const iso = U.iso(new Date(start.getFullYear(), start.getMonth() + i + 1, 0));
      // Производственный метод прогнозируется равномерной выработкой
      const units = asset.method === 'units' ? (Number(asset.totalUnits) || 0) / life : undefined;
      const amount = monthlyAmount(asset, iso, { accumulated: accumulated, units: units });
      if (amount <= 0) break;
      accumulated = money(accumulated + amount);
      rows.push({
        periodKey: U.ym(iso),
        period: periodLabel(U.ym(iso)),
        date: iso,
        amount: amount,
        accumulated: accumulated,
        residual: money(money(asset.initialCost) - accumulated)
      });
      if (accumulated >= base) break;
    }
    return rows;
  }

  /** «2026-08» → «Август 2026». Дубль H.periodLabel: helpers грузятся позже ядра. */
  function periodLabel(key) {
    const parts = String(key).split('-');
    return U.monthName(Number(parts[1]) - 1) + ' ' + parts[0];
  }

  /** Среднемесячная плановая выработка — подставляется по умолчанию */
  function plannedUnits(asset) {
    if (asset.method !== 'units') return undefined;
    return U.round((Number(asset.totalUnits) || 0) / Math.max(Number(asset.lifeMonths) || 1, 1), 2);
  }

  App.Depreciation = {
    GROUPS: GROUPS, METHODS: METHODS, STATUSES: STATUSES, TYPICAL_LIFE: TYPICAL_LIFE,
    groupName: function (v) { return label(GROUPS, v); },
    methodName: function (v) { return label(METHODS, v); },
    statusOf: function (v) { return STATUSES.filter(function (s) { return s.v === v; })[0] || STATUSES[0]; },
    money: money, monthEnd: monthEnd, monthNumber: monthNumber, periodLabel: periodLabel,
    depreciableBase: depreciableBase, residual: residual, isAccruable: isAccruable,
    monthlyAmount: monthlyAmount, schedule: schedule, plannedUnits: plannedUnits
  };
})(window.App);

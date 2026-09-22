/* =============================================================================
   ОТЧЁТНОСТЬ (ТЗ п. 4)
   Бухгалтерские отчёты: оборотно-сальдовая ведомость, баланс,
   отчёт о прибылях и убытках, журнал операций.
   Финансовые отчёты: доходы и расходы, движение денежных средств,
   задолженность клиентов и поставщиков.

   Все расчёты строятся на проведённых проводках — тех же данных, что видит
   пользователь в разделе «Проводки», поэтому отчёты всегда сходятся с учётом.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* Разделы баланса: группа счёта → [сторона, название строки].
     `asset` и `liability` — сторона задана видом счёта, `both` — определяется
     знаком сальдо: дебетовое идёт в актив, кредитовое в пассив. */
  const BALANCE_SECTIONS = {
    '01': ['asset', 'Внеоборотные активы'], '02': ['asset', 'Внеоборотные активы'],
    '04': ['asset', 'Внеоборотные активы'],
    '10': ['asset', 'Запасы'], '20': ['asset', 'Запасы'], '26': ['asset', 'Запасы'],
    '41': ['asset', 'Запасы'], '43': ['asset', 'Запасы'], '44': ['asset', 'Запасы'],
    '50': ['asset', 'Денежные средства'], '51': ['asset', 'Денежные средства'],
    '52': ['asset', 'Денежные средства'],
    '60': ['both', 'Расчёты с поставщиками'], '62': ['both', 'Расчёты с покупателями'],
    '71': ['both', 'Расчёты с подотчётными лицами'], '76': ['both', 'Прочие расчёты'],
    '68': ['both', 'Расчёты по налогам'],
    '66': ['liability', 'Кредиты и займы'], '69': ['liability', 'Расчёты по соцстрахованию'],
    '70': ['liability', 'Расчёты с персоналом'],
    '80': ['liability', 'Капитал'], '84': ['liability', 'Капитал'], '99': ['liability', 'Капитал']
  };

  /* Счета финансового результата — в баланс не входят, формируют прибыль. */
  const RESULT_GROUPS = ['90', '91'];

  /* Правила классификации денежных потоков по назначению операции. */
  const FLOW_RULES = [
    { key: 'investing', markers: ['основн', 'оборудован', 'станок', 'автомоб', 'строительс'] },
    { key: 'financing', markers: ['кредит', 'займ', 'дивиденд', 'уставн', 'лизинг'] }
  ];

  const ACTIVITY_NAMES = {
    operating: 'Операционная деятельность',
    investing: 'Инвестиционная деятельность',
    financing: 'Финансовая деятельность'
  };

  /* =========================================================================
     ПЕРИОД ОТЧЁТА
     ====================================================================== */
  function yearStart() {
    const d = new Date();
    return d.getFullYear() + '-01-01';
  }

  /** Период из адреса: #/report-balance?from=…&to=… */
  function range(ctx) {
    const p = (ctx && ctx.params) || App.Router.current().params;
    let from = p.from || yearStart();
    let to = p.to || U.today();
    if (from > to) { const swap = from; from = to; to = swap; }
    return { from: from, to: to };
  }

  /** Панель выбора периода — общая для всех отчётов. */
  function periodPicker(path, period, extra) {
    function go(from, to) {
      App.Router.go(path, Object.assign({ from: from, to: to }, extra || {}));
    }
    const fromInput = el('input.input', {
      type: 'date', value: period.from, 'aria-label': 'Начало периода',
      onchange: function (e) { go(e.target.value, period.to); }
    });
    const toInput = el('input.input', {
      type: 'date', value: period.to, 'aria-label': 'Конец периода',
      onchange: function (e) { go(period.from, e.target.value); }
    });
    const presets = el('select.select', {
      'aria-label': 'Быстрый выбор периода',
      onchange: function (e) {
        const v = e.target.value;
        if (!v) return;
        const now = new Date();
        if (v === 'month') go(U.iso(new Date(now.getFullYear(), now.getMonth(), 1)), U.today());
        else if (v === 'quarter') go(U.iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), U.today());
        else if (v === 'year') go(yearStart(), U.today());
        else if (v === 'all') go('2000-01-01', U.today());
      }
    }, [
      el('option', { value: '', text: 'Период' }),
      el('option', { value: 'month', text: 'Текущий месяц' }),
      el('option', { value: 'quarter', text: 'Квартал' }),
      el('option', { value: 'year', text: 'С начала года' }),
      el('option', { value: 'all', text: 'За всё время' })
    ]);

    return el('div.row.row--wrap', { style: { alignItems: 'flex-end' } }, [
      el('label.field', { style: { margin: 0 } }, [el('span.field__label', { text: 'С' }), fromInput]),
      el('label.field', { style: { margin: 0 } }, [el('span.field__label', { text: 'По' }), toInput]),
      el('label.field', { style: { margin: 0 } }, [el('span.field__label', { text: 'Быстрый выбор' }), presets])
    ]);
  }

  /* =========================================================================
     РАСЧЁТЫ ПО ПРОВОДКАМ
     ====================================================================== */
  function postedEntries() {
    return App.Store.all('entries').filter(function (e) { return e.posted; });
  }

  function group(code) { return String(code || '').split('.')[0]; }

  /** Входящее сальдо счёта со знаком: «+» — дебетовое, «−» — кредитовое. */
  function openingOf(account) {
    const base = Number(account.opening) || 0;
    return account.kind === 'P' ? -base : base;
  }

  /**
   * Оборотно-сальдовая ведомость за период.
   * Возвращает строки по счетам и итоги; равенство оборотов — контроль двойной записи.
   */
  function turnoverSheet(from, to) {
    const entries = postedEntries();
    const acc = {};

    App.Store.all('accounts').forEach(function (a) {
      acc[a.code] = {
        code: a.code, name: a.name, kind: a.kind,
        opening: openingOf(a), turnoverDebit: 0, turnoverCredit: 0
      };
    });

    function ensure(code) {
      if (!acc[code]) {
        acc[code] = { code: code, name: 'Счёт вне плана счетов', kind: 'AP',
          opening: 0, turnoverDebit: 0, turnoverCredit: 0 };
      }
      return acc[code];
    }

    entries.forEach(function (e) {
      const amount = Number(e.amount) || 0;
      const debit = ensure(e.debit), credit = ensure(e.credit);
      if (e.date < from) {
        debit.opening += amount;
        credit.opening -= amount;
      } else if (e.date <= to) {
        debit.turnoverDebit += amount;
        credit.turnoverCredit += amount;
      }
    });

    const rows = Object.keys(acc).map(function (code) {
      const a = acc[code];
      const closing = a.opening + a.turnoverDebit - a.turnoverCredit;
      return {
        code: a.code, name: a.name, kind: a.kind,
        openingDebit: a.opening > 0 ? a.opening : 0,
        openingCredit: a.opening < 0 ? -a.opening : 0,
        turnoverDebit: a.turnoverDebit,
        turnoverCredit: a.turnoverCredit,
        closingDebit: closing > 0 ? closing : 0,
        closingCredit: closing < 0 ? -closing : 0,
        closing: closing
      };
    }).filter(function (r) {
      return r.openingDebit || r.openingCredit || r.turnoverDebit || r.turnoverCredit ||
        r.closingDebit || r.closingCredit;
    });

    return U.sortBy(rows, function (r) { return r.code; }, 'asc');
  }

  function totalsOf(rows) {
    const keys = ['openingDebit', 'openingCredit', 'turnoverDebit', 'turnoverCredit',
      'closingDebit', 'closingCredit'];
    const out = {};
    keys.forEach(function (k) { out[k] = U.sum(rows, function (r) { return r[k]; }); });
    return out;
  }

  /** Баланс на дату: актив и пассив по разделам. */
  function balanceSheet(to) {
    const rows = turnoverSheet('2000-01-01', to);
    const assets = {}, liabilities = {};
    let profit = 0;

    rows.forEach(function (r) {
      const g = group(r.code);
      const balance = r.closing;

      if (RESULT_GROUPS.indexOf(g) > -1) { profit -= balance; return; }

      const rule = BALANCE_SECTIONS[g] || ['both', 'Прочие активы и обязательства'];
      const side = rule[0], section = rule[1];

      // Амортизация — контрактив: уменьшает стоимость внеоборотных активов
      if (g === '02' || side === 'asset' || (side === 'both' && balance >= 0)) {
        assets[section] = (assets[section] || 0) + balance;
      } else {
        liabilities[section] = (liabilities[section] || 0) - balance;
      }
    });

    if (Math.abs(profit) > 0.005) liabilities['Капитал'] = (liabilities['Капитал'] || 0) + profit;

    const assetRows = sections(assets), liabilityRows = sections(liabilities);
    const assetTotal = U.sum(assetRows, function (r) { return r.amount; });
    const liabilityTotal = U.sum(liabilityRows, function (r) { return r.amount; });

    return {
      date: to, assets: assetRows, liabilities: liabilityRows,
      assetTotal: assetTotal, liabilityTotal: liabilityTotal,
      difference: U.round(assetTotal - liabilityTotal, 2),
      balanced: Math.abs(assetTotal - liabilityTotal) < 0.01,
      profit: profit
    };
  }

  function sections(map) {
    return Object.keys(map)
      .map(function (name) { return { section: name, amount: U.round(map[name], 2) }; })
      .filter(function (r) { return Math.abs(r.amount) > 0.005; })
      .sort(function (a, b) { return Math.abs(b.amount) - Math.abs(a.amount); });
  }

  /** Отчёт о прибылях и убытках за период. */
  function profitAndLoss(from, to) {
    const debit = {}, credit = {};
    postedEntries().forEach(function (e) {
      if (e.date < from || e.date > to) return;
      const amount = Number(e.amount) || 0;
      debit[e.debit] = (debit[e.debit] || 0) + amount;
      credit[e.credit] = (credit[e.credit] || 0) + amount;
    });

    function byGroup(map, g) {
      return Object.keys(map).reduce(function (sum, code) {
        return group(code) === g ? sum + map[code] : sum;
      }, 0);
    }

    const revenue = credit['90.1'] || byGroup(credit, '90');
    const cost = debit['90.2'] || 0;
    const selling = byGroup(debit, '44');
    const admin = byGroup(debit, '26');
    const otherIncome = byGroup(credit, '91');
    const otherExpense = byGroup(debit, '91');
    const tax = debit['68.2'] || 0;

    const gross = revenue - cost;
    const operating = gross - selling - admin;
    const beforeTax = operating + otherIncome - otherExpense;
    const net = beforeTax - tax;

    // Расходные строки показываем со знаком минус, но без «-0»
    const neg = function (v) { return v ? -v : 0; };

    return {
      revenue: revenue, cost: cost, gross: gross, net: net,
      margin: revenue ? gross / revenue * 100 : 0,
      lines: [
        { code: '2110', name: 'Выручка', amount: revenue },
        { code: '2120', name: 'Себестоимость продаж', amount: neg(cost) },
        { code: '2100', name: 'Валовая прибыль', amount: gross, total: true },
        { code: '2210', name: 'Коммерческие расходы', amount: neg(selling) },
        { code: '2220', name: 'Управленческие расходы', amount: neg(admin) },
        { code: '2200', name: 'Прибыль от продаж', amount: operating, total: true },
        { code: '2340', name: 'Прочие доходы', amount: otherIncome },
        { code: '2350', name: 'Прочие расходы', amount: neg(otherExpense) },
        { code: '2300', name: 'Прибыль до налогообложения', amount: beforeTax, total: true },
        { code: '2410', name: 'Налог на прибыль', amount: neg(tax) },
        { code: '2400', name: 'Чистая прибыль', amount: net, total: true }
      ]
    };
  }

  /** Вид деятельности по назначению операции. */
  function activityOf(text) {
    const lowered = U.norm(text);
    for (let i = 0; i < FLOW_RULES.length; i++) {
      const rule = FLOW_RULES[i];
      for (let j = 0; j < rule.markers.length; j++) {
        if (lowered.indexOf(rule.markers[j]) > -1) return rule.key;
      }
    }
    return 'operating';
  }

  /** Все денежные операции: кассовые ордера и исполненные платежи. */
  function moneyOperations() {
    const cash = App.Store.all('cashOrders').map(function (o) {
      return { date: o.date, kind: o.kind, amount: Number(o.amount) || 0,
        source: 'cash', text: o.basis, number: o.number };
    });
    const bank = App.Store.all('payments')
      .filter(function (p) { return p.status === 'executed'; })
      .map(function (p) {
        return { date: p.date, kind: p.kind, amount: Number(p.amount) || 0,
          source: 'bank', text: p.purpose, number: p.number };
      });
    return cash.concat(bank);
  }

  /** Отчёт о движении денежных средств за период. */
  function cashFlow(from, to) {
    const ops = moneyOperations();
    let opening = 0;
    const buckets = {};

    ops.forEach(function (op) {
      const sign = op.kind === 'in' ? 1 : -1;
      if (op.date < from) { opening += sign * op.amount; return; }
      if (op.date > to) return;

      const key = activityOf(op.text);
      const bucket = buckets[key] || (buckets[key] = { inflow: 0, outflow: 0, cash: 0, bank: 0 });
      if (op.kind === 'in') bucket.inflow += op.amount; else bucket.outflow += op.amount;
      bucket[op.source] += sign * op.amount;
    });

    const rows = Object.keys(ACTIVITY_NAMES)
      .filter(function (key) { return buckets[key]; })
      .map(function (key) {
        const b = buckets[key];
        return { activity: key, name: ACTIVITY_NAMES[key], inflow: b.inflow,
          outflow: b.outflow, net: b.inflow - b.outflow };
      });

    const inflow = U.sum(rows, function (r) { return r.inflow; });
    const outflow = U.sum(rows, function (r) { return r.outflow; });

    return {
      opening: opening, rows: rows, inflow: inflow, outflow: outflow,
      net: inflow - outflow, closing: opening + inflow - outflow,
      cashBalance: H.cashBalance(), bankBalance: H.bankBalance()
    };
  }


  /* =========================================================================
     ВЫГРУЗКА В EXCEL
     Все формы одной книгой: бухгалтеру не нужно собирать шесть файлов,
     а числа приходят числами и сразу считаются формулами.
     ====================================================================== */
  function moneyCol(k, t) { return { k: k, t: t, num: true }; }

  function exportWorkbook(period) {
    const label = 'с ' + U.fmtDate(period.from) + ' по ' + U.fmtDate(period.to);
    const turnover = turnoverSheet(period.from, period.to);
    const sheet = balanceSheet(period.to);
    const pnlReport = profitAndLoss(period.from, period.to);
    const flow = cashFlow(period.from, period.to);
    const receivable = H.receivables();
    const payable = H.payables();

    return App.Xlsx.save('otchetnost-' + period.to, [
      {
        name: 'Оборотно-сальдовая',
        title: 'Оборотно-сальдовая ведомость ' + label,
        columns: [
          { k: 'code', t: 'Счёт', money: false },
          { k: 'name', t: 'Наименование' },
          moneyCol('openingDebit', 'Сальдо нач. Дт'),
          moneyCol('openingCredit', 'Сальдо нач. Кт'),
          moneyCol('turnoverDebit', 'Оборот Дт'),
          moneyCol('turnoverCredit', 'Оборот Кт'),
          moneyCol('closingDebit', 'Сальдо кон. Дт'),
          moneyCol('closingCredit', 'Сальдо кон. Кт')
        ],
        rows: turnover,
        totals: ['Итого', '',
          totalsOf(turnover).openingDebit, totalsOf(turnover).openingCredit,
          totalsOf(turnover).turnoverDebit, totalsOf(turnover).turnoverCredit,
          totalsOf(turnover).closingDebit, totalsOf(turnover).closingCredit]
      },
      {
        name: 'Баланс',
        title: 'Бухгалтерский баланс на ' + U.fmtDateLong(period.to),
        columns: [
          { k: 'side', t: 'Сторона', money: false },
          { k: 'section', t: 'Раздел' },
          moneyCol('amount', 'Сумма')
        ],
        rows: sheet.assets.map(function (r) { return { side: 'Актив', section: r.section, amount: r.amount }; })
          .concat([{ side: 'Актив', section: 'Итого актив', amount: sheet.assetTotal }])
          .concat(sheet.liabilities.map(function (r) { return { side: 'Пассив', section: r.section, amount: r.amount }; }))
          .concat([{ side: 'Пассив', section: 'Итого пассив', amount: sheet.liabilityTotal }])
      },
      {
        name: 'Прибыли и убытки',
        title: 'Отчёт о прибылях и убытках ' + label,
        columns: [
          { k: 'code', t: 'Код', money: false },
          { k: 'name', t: 'Показатель' },
          moneyCol('amount', 'За период')
        ],
        rows: pnlReport.lines
      },
      {
        name: 'Движение денег',
        title: 'Движение денежных средств ' + label,
        columns: [
          { k: 'name', t: 'Вид деятельности' },
          moneyCol('inflow', 'Поступления'),
          moneyCol('outflow', 'Выплаты'),
          moneyCol('net', 'Чистый поток')
        ],
        rows: [{ name: 'Остаток на начало', inflow: '', outflow: '', net: flow.opening }]
          .concat(flow.rows)
          .concat([{ name: 'Остаток на конец', inflow: flow.inflow, outflow: flow.outflow, net: flow.closing }])
      },
      {
        name: 'Дебиторка',
        title: 'Задолженность клиентов на ' + U.fmtDateLong(period.to),
        columns: [
          { k: 'name', t: 'Контрагент' },
          moneyCol('debt', 'Долг'),
          moneyCol('overdue', 'В том числе просрочено'),
          { k: 'daysOverdue', t: 'Дней просрочки', money: false },
          { k: 'docs', t: 'Документов', money: false }
        ],
        rows: receivable
      },
      {
        name: 'Кредиторка',
        title: 'Задолженность поставщикам на ' + U.fmtDateLong(period.to),
        columns: [
          { k: 'name', t: 'Поставщик' },
          moneyCol('debt', 'Долг'),
          { k: 'docs', t: 'Документов', money: false }
        ],
        rows: payable
      }
    ]);
  }

  /* =========================================================================
     ЦЕНТР ОТЧЁТНОСТИ
     ====================================================================== */
  const CATALOG = [
    {
      title: 'Бухгалтерские отчёты',
      items: [
        { path: 'report-turnover', icon: 'book', name: 'Оборотно-сальдовая ведомость',
          text: 'Сальдо и обороты по всем счетам плана счетов за период' },
        { path: 'report-balance', icon: 'scale', name: 'Бухгалтерский баланс',
          text: 'Актив и пассив на дату с контролем сходимости' },
        { path: 'report-pnl', icon: 'trend', name: 'Отчёт о прибылях и убытках',
          text: 'Выручка, себестоимость, расходы и чистая прибыль' },
        { path: 'journal', icon: 'history', name: 'Журнал операций',
          text: 'Хронология всех хозяйственных операций', module: 'accounting' }
      ]
    },
    {
      title: 'Финансовые отчёты',
      items: [
        { path: 'analytics', icon: 'chart', name: 'Доходы и расходы',
          text: 'Динамика выручки, затрат и рентабельности', module: 'analytics' },
        { path: 'report-cashflow', icon: 'cash', name: 'Движение денежных средств',
          text: 'Притоки и оттоки по кассе и расчётному счёту' },
        { path: 'debts', icon: 'users', name: 'Задолженность клиентов',
          text: 'Дебиторская задолженность с выделением просрочки', module: 'debts' },
        { path: 'debts', icon: 'truck', name: 'Задолженность поставщикам',
          text: 'Кредиторская задолженность и приоритет оплаты', module: 'debts' }
      ]
    }
  ];

  function reports(ctx) {
    const period = range(ctx);
    const sheet = balanceSheet(period.to);
    const pnl = profitAndLoss(period.from, period.to);
    const flow = cashFlow(period.from, period.to);
    const receivable = U.sum(H.receivables(), function (r) { return r.debt; });
    const payable = U.sum(H.payables(), function (r) { return r.debt; });

    function reportRow(item) {
      const allowed = !item.module || App.Auth.can(item.module);
      return el('div.list__item', {
        style: { cursor: allowed ? 'pointer' : 'not-allowed', opacity: allowed ? '1' : '.55' },
        onclick: function () {
          if (!allowed) return UI.toast({ kind: 'warn', title: 'Раздел недоступен вашей роли' });
          App.Router.go(item.path, Object.assign({}, period, item.params || {}));
        }
      }, [
        el('div.notif__icon', null, [App.Icons.get(item.icon)]),
        el('div.list__main', null, [
          el('div.list__title', { text: item.name }),
          el('div.list__sub', { text: allowed ? item.text : 'Раздел недоступен вашей роли' })
        ]),
        App.Icons.get('chevronRight')
      ]);
    }

    return UI.page({
      title: 'Отчётность',
      subtitle: 'Бухгалтерские и финансовые отчёты за выбранный период',
      actions: [
        periodPicker('reports', period),
        UI.btn('Выгрузить всё в Excel', {
          kind: 'primary', icon: 'grid',
          onClick: function () { exportWorkbook(period); }
        })
      ],
      children: [
        UI.statGrid([
          { label: 'Валюта баланса', value: U.moneyShort(sheet.assetTotal), icon: 'scale',
            tone: sheet.balanced ? 'ok' : 'danger',
            meta: sheet.balanced ? 'актив = пассив' : 'расхождение ' + U.money(sheet.difference, { digits: 0 }) },
          { label: 'Выручка за период', value: U.moneyShort(pnl.revenue), icon: 'trend', tone: 'info' },
          { label: 'Чистая прибыль', value: U.moneyShort(pnl.net), icon: 'wallet',
            tone: pnl.net >= 0 ? 'ok' : 'danger', meta: 'рентабельность ' + U.pct(pnl.margin) },
          { label: 'Денежные средства', value: U.moneyShort(flow.cashBalance + flow.bankBalance),
            icon: 'cash', tone: 'violet', meta: 'касса и расчётный счёт' },
          { label: 'Дебиторская задолженность', value: U.moneyShort(receivable), icon: 'users', tone: 'warn' },
          { label: 'Кредиторская задолженность', value: U.moneyShort(payable), icon: 'truck', tone: 'warn' }
        ], 3),

        el('div.grid.grid--2.mt-4', null, CATALOG.map(function (block) {
          return UI.card({
            title: block.title,
            flush: true,
            body: [el('div.list', null, block.items.map(reportRow))]
          });
        }))
      ]
    });
  }

  /* =========================================================================
     ОБОРОТНО-САЛЬДОВАЯ ВЕДОМОСТЬ
     ====================================================================== */
  function turnover(ctx) {
    const period = range(ctx);
    const rows = turnoverSheet(period.from, period.to);
    const totals = totalsOf(rows);
    const balanced = Math.abs(totals.turnoverDebit - totals.turnoverCredit) < 0.01;

    function moneyCol(key, title) {
      return {
        k: key, t: title, num: true,
        render: function (r) { return r[key] ? U.money(r[key], { digits: 0 }) : '—'; }
      };
    }

    return UI.page({
      title: 'Оборотно-сальдовая ведомость',
      subtitle: 'Период с ' + U.fmtDate(period.from) + ' по ' + U.fmtDate(period.to),
      breadcrumbs: ['Отчётность', 'Бухгалтерские отчёты'],
      actions: [periodPicker('report-turnover', period)],
      children: [
        balanced ? null : el('div.alert.alert--danger', {
          text: 'Обороты по дебету и кредиту не совпадают: ' +
            U.money(totals.turnoverDebit - totals.turnoverCredit) +
            '. Проверьте проводки в разделе «Проверка ошибок».'
        }),

        UI.statGrid([
          { label: 'Счетов в обороте', value: String(rows.length), icon: 'book', tone: 'info' },
          { label: 'Оборот по дебету', value: U.moneyShort(totals.turnoverDebit), icon: 'arrowDown', tone: 'ok' },
          { label: 'Оборот по кредиту', value: U.moneyShort(totals.turnoverCredit), icon: 'arrowUp', tone: 'warn' },
          { label: 'Контроль двойной записи', value: balanced ? 'Сходится' : 'Ошибка',
            icon: 'shield', tone: balanced ? 'ok' : 'danger' }
        ], 4),

        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'code', t: 'Счёт', w: '90px', render: function (r) { return el('strong', { text: r.code }); } },
            { k: 'name', t: 'Наименование' },
            moneyCol('openingDebit', 'Сальдо нач. Дт'),
            moneyCol('openingCredit', 'Сальдо нач. Кт'),
            moneyCol('turnoverDebit', 'Оборот Дт'),
            moneyCol('turnoverCredit', 'Оборот Кт'),
            moneyCol('closingDebit', 'Сальдо кон. Дт'),
            moneyCol('closingCredit', 'Сальдо кон. Кт'),
            { id: 'act', t: '', w: '54px', sortable: false, render: function (r) {
              return UI.rowActions([{ icon: 'eye', title: 'Проводки по счёту', onClick: function () { accountEntries(r, period); } }]);
            } }
          ],
          rows: rows, pageSize: 0, search: ['code', 'name'],
          searchPlaceholder: 'Счёт или наименование…',
          exportName: 'turnover-sheet.csv',
          totals: {
            name: function () { return 'Итого'; },
            openingDebit: function (list) { return U.money(U.sum(list, function (r) { return r.openingDebit; }), { digits: 0 }); },
            openingCredit: function (list) { return U.money(U.sum(list, function (r) { return r.openingCredit; }), { digits: 0 }); },
            turnoverDebit: function (list) { return U.money(U.sum(list, function (r) { return r.turnoverDebit; }), { digits: 0 }); },
            turnoverCredit: function (list) { return U.money(U.sum(list, function (r) { return r.turnoverCredit; }), { digits: 0 }); },
            closingDebit: function (list) { return U.money(U.sum(list, function (r) { return r.closingDebit; }), { digits: 0 }); },
            closingCredit: function (list) { return U.money(U.sum(list, function (r) { return r.closingCredit; }), { digits: 0 }); }
          }
        })])
      ]
    });
  }

  /** Расшифровка счёта: проводки за период. */
  function accountEntries(row, period) {
    const list = postedEntries().filter(function (e) {
      return (e.debit === row.code || e.credit === row.code) &&
        e.date >= period.from && e.date <= period.to;
    });

    UI.modal({
      title: 'Счёт ' + row.code + ' — ' + row.name,
      size: 'xl',
      body: [
        UI.kv([
          ['Сальдо на начало', U.money(row.openingDebit - row.openingCredit, { digits: 0 })],
          ['Оборот по дебету', U.money(row.turnoverDebit, { digits: 0 })],
          ['Оборот по кредиту', U.money(row.turnoverCredit, { digits: 0 })],
          ['Сальдо на конец', el('strong', { text: U.money(row.closing, { digits: 0 }) })]
        ]),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'date', t: 'Дата', w: '110px', render: function (e) { return U.fmtDate(e.date); } },
            { k: 'number', t: '№', w: '90px' },
            { k: 'content', t: 'Содержание операции' },
            { k: 'debit', t: 'Дт', w: '70px' },
            { k: 'credit', t: 'Кт', w: '70px' },
            { k: 'amount', t: 'Сумма', num: true, render: function (e) { return U.money(e.amount, { digits: 0 }); } }
          ],
          rows: U.sortBy(list, function (e) { return e.date; }, 'desc'),
          pageSize: 12, exportName: 'account-' + row.code + '.csv'
        })])
      ],
      buttons: [{ text: 'Закрыть', kind: 'ghost' }]
    });
  }

  /* =========================================================================
     БУХГАЛТЕРСКИЙ БАЛАНС
     ====================================================================== */
  function balance(ctx) {
    const period = range(ctx);
    const sheet = balanceSheet(period.to);

    function sideTable(title, rows, total, tone) {
      return UI.card({
        title: title,
        subtitle: 'на ' + U.fmtDateLong(period.to),
        flush: true,
        body: [UI.table({
          columns: [
            { k: 'section', t: 'Раздел' },
            { k: 'amount', t: 'Сумма', num: true, w: '190px',
              render: function (r) { return el('strong', { text: U.money(r.amount, { digits: 0 }) }); } },
            { id: 'share', t: 'Доля', w: '130px', sortable: false, render: function (r) {
              return el('div', null, [
                UI.progress(Math.abs(r.amount), Math.abs(total) || 1, tone),
                el('span.fs-xs.muted-2', { text: U.pct(total ? r.amount / total * 100 : 0, 0) })
              ]);
            } }
          ],
          rows: rows, pageSize: 0, exportName: false, printable: false,
          totals: {
            section: function () { return 'Баланс'; },
            amount: function (list) { return U.money(U.sum(list, function (r) { return r.amount; }), { digits: 0 }); }
          }
        })]
      });
    }

    return UI.page({
      title: 'Бухгалтерский баланс',
      subtitle: 'Актив и пассив организации на выбранную дату',
      breadcrumbs: ['Отчётность', 'Бухгалтерские отчёты'],
      actions: [
        periodPicker('report-balance', period),
        UI.btn('Excel', { icon: 'grid', onClick: function () { exportBalance(sheet); } }),
        UI.btn('Печать', { icon: 'print', kind: 'ghost', onClick: function () { window.print(); } })
      ],
      children: [
        sheet.balanced
          ? el('div.alert.alert--ok', { text: 'Баланс сходится: актив равен пассиву — ' + U.money(sheet.assetTotal, { digits: 0 }) })
          : el('div.alert.alert--danger', { text: 'Баланс не сходится. Расхождение: ' + U.money(sheet.difference, { digits: 0 }) + '. Проверьте проводки.' }),

        UI.statGrid([
          { label: 'Актив', value: U.moneyShort(sheet.assetTotal), icon: 'box', tone: 'info' },
          { label: 'Пассив', value: U.moneyShort(sheet.liabilityTotal), icon: 'scale', tone: 'violet' },
          { label: 'Финансовый результат', value: U.moneyShort(sheet.profit), icon: 'trend',
            tone: sheet.profit >= 0 ? 'ok' : 'danger', meta: 'прибыль текущего периода' },
          { label: 'Контроль', value: sheet.balanced ? 'Сходится' : 'Расхождение',
            icon: 'shield', tone: sheet.balanced ? 'ok' : 'danger' }
        ], 4),

        el('div.grid.grid--2.mt-4', null, [
          sideTable('Актив', sheet.assets, sheet.assetTotal, 'ok'),
          sideTable('Пассив', sheet.liabilities, sheet.liabilityTotal, 'violet')
        ]),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Структура актива',
            body: [C.donut({
              items: sheet.assets.map(function (r) { return { name: r.section, value: Math.abs(r.amount) }; }),
              size: 200, centerTop: U.moneyShort(sheet.assetTotal), centerBottom: 'актив'
            })]
          }),
          UI.card({
            title: 'Структура пассива',
            body: [C.donut({
              items: sheet.liabilities.map(function (r) { return { name: r.section, value: Math.abs(r.amount) }; }),
              size: 200, centerTop: U.moneyShort(sheet.liabilityTotal), centerBottom: 'пассив'
            })]
          })
        ])
      ]
    });
  }

  function exportBalance(sheet) {
    App.Xlsx.save('balance-' + sheet.date, {
      name: 'Баланс',
      title: 'Бухгалтерский баланс на ' + U.fmtDateLong(sheet.date),
      columns: [
        { k: 'side', t: 'Сторона', money: false },
        { k: 'section', t: 'Раздел' },
        { k: 'amount', t: 'Сумма', num: true }
      ],
      rows: sheet.assets.map(function (r) { return { side: 'Актив', section: r.section, amount: r.amount }; })
        .concat([{ side: 'Актив', section: 'Итого актив', amount: sheet.assetTotal }])
        .concat(sheet.liabilities.map(function (r) { return { side: 'Пассив', section: r.section, amount: r.amount }; }))
        .concat([{ side: 'Пассив', section: 'Итого пассив', amount: sheet.liabilityTotal }])
    });
  }

  /* =========================================================================
     ОТЧЁТ О ПРИБЫЛЯХ И УБЫТКАХ
     ====================================================================== */
  function pnl(ctx) {
    const period = range(ctx);
    const report = profitAndLoss(period.from, period.to);
    const months = U.lastMonths(12);
    const series = months.map(function (m) {
      const monthFrom = m.key + '-01';
      const next = new Date(m.year, m.month + 1, 0);
      return profitAndLoss(monthFrom, U.iso(next));
    });

    return UI.page({
      title: 'Отчёт о прибылях и убытках',
      subtitle: 'Период с ' + U.fmtDate(period.from) + ' по ' + U.fmtDate(period.to),
      breadcrumbs: ['Отчётность', 'Бухгалтерские отчёты'],
      actions: [
        periodPicker('report-pnl', period),
        UI.btn('Печать', { icon: 'print', kind: 'ghost', onClick: function () { window.print(); } })
      ],
      children: [
        UI.statGrid([
          { label: 'Выручка', value: U.moneyShort(report.revenue), icon: 'trend', tone: 'ok' },
          { label: 'Себестоимость', value: U.moneyShort(report.cost), icon: 'box', tone: 'warn' },
          { label: 'Валовая прибыль', value: U.moneyShort(report.gross), icon: 'chart', tone: 'info' },
          { label: 'Чистая прибыль', value: U.moneyShort(report.net), icon: 'wallet',
            tone: report.net >= 0 ? 'ok' : 'danger', meta: 'рентабельность ' + U.pct(report.margin) }
        ], 4),

        el('div.mt-4', null, [UI.card({
          title: 'Форма №2 — финансовые результаты',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'code', t: 'Код', w: '80px' },
              { k: 'name', t: 'Показатель', render: function (r) {
                return r.total ? el('strong', { text: r.name }) : el('span', { text: r.name });
              } },
              { k: 'amount', t: 'За период', num: true, w: '220px', render: function (r) {
                const node = H.moneyCell(r.amount, { colorize: r.total, digits: 0 });
                return r.total ? el('strong', null, [node]) : node;
              } }
            ],
            rows: report.lines, pageSize: 0, sort: null, exportName: 'pnl.csv'
          })]
        })]),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Выручка и прибыль по месяцам',
            body: [C.line({
              labels: months.map(function (m) { return m.label; }), height: 260,
              series: [
                { name: 'Выручка', values: series.map(function (s) { return s.revenue; }), color: 'var(--c1)' },
                { name: 'Валовая прибыль', values: series.map(function (s) { return s.gross; }), color: 'var(--c2)' },
                { name: 'Чистая прибыль', values: series.map(function (s) { return s.net; }), color: 'var(--c3)', area: false }
              ]
            })]
          }),
          UI.card({
            title: 'Структура выручки',
            body: [C.donut({
              items: [
                { name: 'Себестоимость', value: Math.max(report.cost, 0) },
                { name: 'Валовая прибыль', value: Math.max(report.gross, 0) }
              ],
              size: 200, centerTop: U.pct(report.margin), centerBottom: 'маржа'
            })]
          })
        ])
      ]
    });
  }

  /* =========================================================================
     ДВИЖЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ
     ====================================================================== */
  function cashflow(ctx) {
    const period = range(ctx);
    const report = cashFlow(period.from, period.to);
    const months = U.lastMonths(12);
    const ops = moneyOperations();

    function monthSum(key, kind) {
      return U.sum(ops.filter(function (o) {
        return U.ym(o.date) === key && o.kind === kind;
      }), function (o) { return o.amount; });
    }

    const inflow = months.map(function (m) { return monthSum(m.key, 'in'); });
    const outflow = months.map(function (m) { return monthSum(m.key, 'out'); });

    const detail = ops.filter(function (o) { return o.date >= period.from && o.date <= period.to; })
      .map(function (o) {
        return {
          date: o.date, number: o.number,
          source: o.source === 'cash' ? 'Касса' : 'Банк',
          activity: ACTIVITY_NAMES[activityOf(o.text)],
          text: o.text || '—',
          inflow: o.kind === 'in' ? o.amount : 0,
          outflow: o.kind === 'out' ? o.amount : 0
        };
      });

    return UI.page({
      title: 'Движение денежных средств',
      subtitle: 'Период с ' + U.fmtDate(period.from) + ' по ' + U.fmtDate(period.to),
      breadcrumbs: ['Отчётность', 'Финансовые отчёты'],
      actions: [
        periodPicker('report-cashflow', period),
        UI.btn('Печать', { icon: 'print', kind: 'ghost', onClick: function () { window.print(); } })
      ],
      children: [
        UI.statGrid([
          { label: 'Остаток на начало', value: U.moneyShort(report.opening), icon: 'wallet', tone: 'info' },
          { label: 'Поступило', value: U.moneyShort(report.inflow), icon: 'arrowDown', tone: 'ok' },
          { label: 'Израсходовано', value: U.moneyShort(report.outflow), icon: 'arrowUp', tone: 'warn' },
          { label: 'Чистый поток', value: U.moneyShort(report.net), icon: 'refresh',
            tone: report.net >= 0 ? 'ok' : 'danger' },
          { label: 'Остаток на конец', value: U.moneyShort(report.closing), icon: 'cash', tone: 'violet',
            meta: 'касса ' + U.moneyShort(report.cashBalance) + ' · банк ' + U.moneyShort(report.bankBalance) }
        ], 4),

        el('div.mt-4', null, [UI.card({
          title: 'Потоки по видам деятельности',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'name', t: 'Вид деятельности' },
              { k: 'inflow', t: 'Поступления', num: true, render: function (r) { return U.money(r.inflow, { digits: 0 }); } },
              { k: 'outflow', t: 'Выплаты', num: true, render: function (r) { return U.money(r.outflow, { digits: 0 }); } },
              { k: 'net', t: 'Чистый поток', num: true, render: function (r) { return H.moneyCell(r.net, { colorize: true, digits: 0 }); } }
            ],
            rows: report.rows, pageSize: 0, exportName: 'cashflow.csv',
            totals: {
              name: function () { return 'Итого'; },
              inflow: function (list) { return U.money(U.sum(list, function (r) { return r.inflow; }), { digits: 0 }); },
              outflow: function (list) { return U.money(U.sum(list, function (r) { return r.outflow; }), { digits: 0 }); },
              net: function (list) { return U.money(U.sum(list, function (r) { return r.net; }), { digits: 0 }); }
            }
          })]
        })]),

        el('div.mt-4', null, [UI.card({
          title: 'Поступления и выплаты по месяцам',
          body: [C.bars({
            labels: months.map(function (m) { return m.label; }), height: 240,
            series: [
              { name: 'Поступления', values: inflow, color: 'var(--c1)' },
              { name: 'Выплаты', values: outflow, color: 'var(--c4)' }
            ]
          })]
        })]),

        el('div.mt-4', null, [UI.card({
          title: 'Расшифровка операций',
          subtitle: detail.length + ' операций за период',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
              { k: 'number', t: '№ документа', w: '120px' },
              { k: 'source', t: 'Источник', w: '90px', render: function (r) { return UI.badge(r.source, r.source === 'Касса' ? 'warn' : 'info'); } },
              { k: 'activity', t: 'Вид деятельности', w: '190px' },
              { k: 'text', t: 'Основание / назначение' },
              { k: 'inflow', t: 'Приход', num: true, render: function (r) { return r.inflow ? U.money(r.inflow, { digits: 0 }) : '—'; } },
              { k: 'outflow', t: 'Расход', num: true, render: function (r) { return r.outflow ? U.money(r.outflow, { digits: 0 }) : '—'; } }
            ],
            rows: U.sortBy(detail, function (r) { return r.date; }, 'desc'),
            pageSize: 15, search: ['number', 'text', 'activity'],
            searchPlaceholder: 'Документ, назначение…',
            exportName: 'cashflow-detail.csv'
          })]
        })])
      ]
    });
  }

  /* =========================================================================
     РЕГИСТРАЦИЯ МАРШРУТОВ
     ====================================================================== */
  App.Router.add('reports', { title: 'Отчётность', module: 'reports', render: reports });
  App.Router.add('report-turnover', { title: 'Оборотно-сальдовая ведомость', module: 'reports', render: turnover });
  App.Router.add('report-balance', { title: 'Бухгалтерский баланс', module: 'reports', render: balance });
  App.Router.add('report-pnl', { title: 'Отчёт о прибылях и убытках', module: 'reports', render: pnl });
  App.Router.add('report-cashflow', { title: 'Движение денежных средств', module: 'reports', render: cashflow });

  App.Reports = {
    turnoverSheet: turnoverSheet, balanceSheet: balanceSheet,
    profitAndLoss: profitAndLoss, cashFlow: cashFlow, totalsOf: totalsOf
  };
})(window.App);

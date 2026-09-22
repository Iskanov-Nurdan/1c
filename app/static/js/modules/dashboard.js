/* =============================================================================
   МОДУЛЬ: Дашборд · Финансовая аналитика · Бюджетирование · Задолженность
   ТЗ п. 17, 18, 19
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* =========================================================================
     ГЛАВНЫЙ ЭКРАН
     ====================================================================== */
  function dashboard() {
    const sales = App.Store.all('sales');
    const m6 = U.lastMonths(6);
    const cur = m6[m6.length - 1].key;
    const prev = m6[m6.length - 2].key;

    const revSeries = H.monthly('sales', 'date', function (s) { return s.amount; }, 6);
    const expSeries = H.monthly('purchaseOrders', 'date', function (o) { return o.status === 'cancelled' ? 0 : o.amount; }, 6);
    const cashOutSeries = H.monthly('cashOrders', 'date', function (c) { return c.kind === 'out' ? c.amount : 0; }, 6);
    const totalExp = expSeries.values.map(function (v, i) { return v + cashOutSeries.values[i]; });
    const profit = revSeries.values.map(function (v, i) { return v - totalExp[i]; });

    const revCur = revSeries.values[5], revPrev = revSeries.values[4] || 1;
    const profCur = profit[5], profPrev = profit[4] || 1;

    const rec = H.receivables();
    const pay = H.payables();
    const recTotal = U.sum(rec, function (r) { return r.debt; });
    const payTotal = U.sum(pay, function (r) { return r.debt; });
    const cash = H.cashBalance(), bank = H.bankBalance();

    const pendingDocs = App.Store.all('documents').filter(function (d) { return d.status === 'review'; });
    const pendingReq = App.Store.all('requests').filter(function (r) { return r.status === 'review' || r.status === 'new'; });
    const myTasks = App.Store.all('tasks').filter(function (t) { return t.status !== 'done'; });
    const issues = H.runChecks();

    const kpis = UI.statGrid([
      { label: 'Выручка за месяц', value: U.moneyShort(revCur), icon: 'trend', tone: 'ok',
        delta: revPrev ? (revCur - revPrev) / revPrev * 100 : 0, spark: revSeries.values },
      { label: 'Расходы за месяц', value: U.moneyShort(totalExp[5]), icon: 'wallet', tone: 'warn',
        delta: totalExp[4] ? (totalExp[5] - totalExp[4]) / totalExp[4] * 100 : 0, invert: true, spark: totalExp },
      { label: 'Прибыль за месяц', value: U.moneyShort(profCur), icon: 'chart', tone: profCur >= 0 ? 'ok' : 'danger',
        delta: profPrev ? (profCur - profPrev) / Math.abs(profPrev) * 100 : 0, spark: profit },
      { label: 'Остаток денег', value: U.moneyShort(cash + bank), icon: 'cash', tone: 'info',
        meta: 'касса ' + U.moneyShort(cash) + ' · банк ' + U.moneyShort(bank) },
      { label: 'Долги клиентов', value: U.moneyShort(recTotal), icon: 'users', tone: 'violet',
        meta: rec.length + ' контрагентов · просрочка ' + U.moneyShort(U.sum(rec, function (r) { return r.overdue; })) },
      { label: 'Долги поставщикам', value: U.moneyShort(payTotal), icon: 'truck', tone: 'danger',
        meta: pay.length + ' поставщиков' }
    ], 4);

    /* --- Графики --- */
    const chartMoney = UI.card({
      title: 'Продажи, расходы и прибыль',
      subtitle: 'помесячно за последние 6 месяцев',
      tools: [UI.btn('Подробнее', { size: 'sm', kind: 'ghost', icon: 'arrowRight', onClick: function () { App.Router.go('analytics'); } })],
      body: [C.bars({
        labels: revSeries.labels,
        height: 260,
        series: [
          { name: 'Выручка', values: revSeries.values, color: 'var(--c1)' },
          { name: 'Расходы', values: totalExp, color: 'var(--c3)' },
          { name: 'Прибыль', values: profit, color: 'var(--c2)' }
        ]
      })]
    });

    const cashFlow = H.monthly('payments', 'date', function (p) { return p.kind === 'in' ? p.amount : 0; }, 6);
    const cashOutFlow = H.monthly('payments', 'date', function (p) { return p.kind === 'out' ? p.amount : 0; }, 6);
    const chartFlow = UI.card({
      title: 'Движение денежных средств',
      subtitle: 'поступления и списания по расчётному счёту',
      body: [C.line({
        labels: cashFlow.labels, height: 220,
        series: [
          { name: 'Поступления', values: cashFlow.values, color: 'var(--c2)' },
          { name: 'Списания', values: cashOutFlow.values, color: 'var(--c4)' }
        ]
      })]
    });

    /* --- Топ клиентов --- */
    const byClient = U.groupBy(sales, function (s) { return s.counterpartyId; });
    const topClients = Object.keys(byClient).map(function (k) {
      return { name: H.cpName(k), value: U.sum(byClient[k], function (s) { return s.amount; }) };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 6);

    const structure = UI.card({
      title: 'Структура выручки',
      subtitle: 'топ-6 клиентов за всё время',
      body: [C.hbars({ items: topClients })]
    });

    /* --- Требует внимания --- */
    const attention = UI.card({
      title: 'Требует внимания',
      tools: [issues.length ? UI.badge(issues.length + ' проблем', 'danger') : UI.badge('всё в порядке', 'ok')],
      flush: true,
      body: [el('div.list', null, [
        listRow('clipboard', 'Документы на согласование', pendingDocs.length + ' шт.', pendingDocs.length ? 'warn' : 'ok', function () { App.Router.go('approvals'); }),
        listRow('inbox', 'Заявки в работе', pendingReq.length + ' шт.', pendingReq.length ? 'info' : 'ok', function () { App.Router.go('requests'); }),
        listRow('alert', 'Ошибки автопроверки', issues.filter(function (i) { return i.level === 'error'; }).length + ' критичных', 'danger', function () { App.Router.go('validation'); }),
        listRow('clock', 'Просроченные платежи', U.moneyShort(U.sum(rec, function (r) { return r.overdue; })), 'danger', function () { App.Router.go('debts'); }),
        listRow('contract', 'Договоры к продлению', App.Store.all('contracts').filter(function (c) {
          const l = U.daysLeft(c.endDate); return l >= 0 && l <= 30;
        }).length + ' шт.', 'warn', function () { App.Router.go('contracts'); }),
        listRow('check', 'Мои задачи', myTasks.length + ' активных', 'info', function () { App.Router.go('tasks'); })
      ])]
    });

    /* --- Последние операции --- */
    const recent = UI.card({
      title: 'Последние операции',
      flush: true,
      body: [UI.table({
        columns: [
          { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
          { k: 'number', t: '№', w: '110px' },
          { k: 'client', t: 'Контрагент', render: function (r) { return H.cpName(r.counterpartyId); } },
          { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
          { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } }
        ],
        rows: U.sortBy(sales, function (s) { return s.date; }, 'desc').slice(0, 8),
        pageSize: 0, exportName: false, printable: false,
        onRow: function (r) { App.Router.go('sales'); }
      })]
    });

    return UI.page({
      title: 'Дашборд',
      subtitle: App.Store.company().name + ' · данные на ' + U.fmtDateLong(U.today()),
      actions: [
        UI.btn('AI-помощник', { icon: 'cpu', onClick: function () { App.Shell.openAI(); } }),
        UI.btn('Обновить', { icon: 'refresh', kind: 'ghost', onClick: function () { App.Router.render(); } })
      ],
      children: [
        kpis,
        el('div.grid.grid--sidebar.mt-4', null, [chartMoney, attention]),
        el('div.grid.grid--sidebar.mt-4', null, [chartFlow, structure]),
        el('div.mt-4', null, [recent])
      ]
    });
  }

  function listRow(icon, title, value, tone, onClick) {
    return el('div.list__item', { style: { cursor: 'pointer' }, onclick: onClick }, [
      el('div.notif__icon', null, [App.Icons.get(icon)]),
      el('div.list__main', null, [
        el('div.list__title', { text: title }),
        el('div.list__sub', { text: value })
      ]),
      App.Icons.get('chevronRight')
    ]);
  }

  /* =========================================================================
     ФИНАНСОВАЯ АНАЛИТИКА
     ====================================================================== */
  function analytics() {
    const months = 12;
    const rev = H.monthly('sales', 'date', function (s) { return s.amount; }, months);
    const cost = H.monthly('sales', 'date', function (s) {
      return U.sum(s.items, function (i) {
        const p = H.product(i.productId);
        return (p ? p.cost : i.price * 0.7) * i.qty;
      });
    }, months);
    const purch = H.monthly('purchaseOrders', 'date', function (o) { return o.status === 'cancelled' ? 0 : o.amount; }, months);
    const cashOut = H.monthly('cashOrders', 'date', function (c) { return c.kind === 'out' ? c.amount : 0; }, months);
    const exp = purch.values.map(function (v, i) { return v + cashOut.values[i]; });
    const gross = rev.values.map(function (v, i) { return v - cost.values[i]; });
    const net = rev.values.map(function (v, i) { return v - exp[i]; });

    const totalRev = U.sum(rev.values), totalExp = U.sum(exp), totalGross = U.sum(gross);
    const margin = totalRev ? totalGross / totalRev * 100 : 0;

    const expByItem = U.groupBy(App.Store.all('cashOrders').filter(function (c) { return c.kind === 'out'; }), function (c) { return c.basis; });
    const expItems = Object.keys(expByItem).map(function (k) {
      return { name: k, value: U.sum(expByItem[k], function (c) { return c.amount; }) };
    }).sort(function (a, b) { return b.value - a.value; });

    const salesByManager = U.groupBy(App.Store.all('sales'), function (s) { return s.manager; });
    const managers = Object.keys(salesByManager).map(function (k) {
      return { name: k, value: U.sum(salesByManager[k], function (s) { return s.amount; }) };
    }).sort(function (a, b) { return b.value - a.value; });

    return UI.page({
      title: 'Финансовая аналитика',
      subtitle: 'Динамика доходов, расходов и прибыли за 12 месяцев',
      actions: [UI.btn('Выгрузить отчёт', {
        icon: 'download', onClick: function () {
          const rows = rev.labels.map(function (l, i) {
            return { period: l, revenue: rev.values[i], expense: exp[i], gross: gross[i], net: net[i] };
          });
          U.download('analytics.csv', U.toCSV(rows, [
            { k: 'period', t: 'Период' }, { k: 'revenue', t: 'Выручка' },
            { k: 'expense', t: 'Расходы' }, { k: 'gross', t: 'Валовая прибыль' }, { k: 'net', t: 'Чистая прибыль' }
          ]));
          UI.toast({ kind: 'ok', title: 'Отчёт выгружен' });
        }
      })],
      children: [
        UI.statGrid([
          { label: 'Выручка за 12 мес.', value: U.moneyShort(totalRev), icon: 'trend', tone: 'ok' },
          { label: 'Расходы за 12 мес.', value: U.moneyShort(totalExp), icon: 'wallet', tone: 'warn' },
          { label: 'Валовая прибыль', value: U.moneyShort(totalGross), icon: 'chart', tone: 'info' },
          { label: 'Рентабельность', value: U.pct(margin), icon: 'percent', tone: margin > 20 ? 'ok' : 'warn',
            meta: 'валовая маржа' },
          { label: 'Средний чек', value: U.moneyShort(totalRev / (App.Store.all('sales').length || 1)), icon: 'cart', tone: 'violet' }
        ], 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Доходы и расходы',
            subtitle: 'помесячная динамика',
            body: [C.line({
              labels: rev.labels, height: 280,
              series: [
                { name: 'Выручка', values: rev.values, color: 'var(--c1)' },
                { name: 'Расходы', values: exp, color: 'var(--c4)' },
                { name: 'Чистая прибыль', values: net, color: 'var(--c2)', area: false }
              ]
            })]
          }),
          UI.card({
            title: 'Структура расходов',
            body: [C.donut({
              items: expItems.slice(0, 6),
              size: 190,
              centerTop: U.moneyShort(U.sum(expItems, function (i) { return i.value; })),
              centerBottom: 'расходы'
            })]
          })
        ]),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({ title: 'Продажи по менеджерам', body: [C.hbars({ items: managers })] }),
          UI.card({
            title: 'Прибыль по месяцам',
            body: [C.bars({
              labels: rev.labels, height: 220,
              series: [{ name: 'Чистая прибыль', values: net, color: 'var(--c2)' }]
            })]
          })
        ]),

        el('div.mt-4', null, [UI.card({
          title: 'Отчёт о финансовых результатах',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'period', t: 'Период' },
              { k: 'revenue', t: 'Выручка', num: true, render: function (r) { return U.money(r.revenue, { digits: 0 }); } },
              { k: 'cost', t: 'Себестоимость', num: true, render: function (r) { return U.money(r.cost, { digits: 0 }); } },
              { k: 'gross', t: 'Валовая прибыль', num: true, render: function (r) { return H.moneyCell(r.gross, { colorize: true, digits: 0 }); } },
              { k: 'expense', t: 'Расходы', num: true, render: function (r) { return U.money(r.expense, { digits: 0 }); } },
              { k: 'net', t: 'Чистая прибыль', num: true, render: function (r) { return H.moneyCell(r.net, { colorize: true, digits: 0 }); } },
              { k: 'margin', t: 'Маржа', num: true, render: function (r) { return U.pct(r.revenue ? r.gross / r.revenue * 100 : 0); } }
            ],
            rows: rev.labels.map(function (l, i) {
              return {
                period: l + ' ' + U.lastMonths(months)[i].year, revenue: rev.values[i], cost: cost.values[i],
                gross: gross[i], expense: exp[i], net: net[i]
              };
            }),
            pageSize: 0, sort: null, exportName: 'pnl.csv',
            totals: {
              revenue: function (rows) { return U.money(U.sum(rows, function (r) { return r.revenue; }), { digits: 0 }); },
              cost: function (rows) { return U.money(U.sum(rows, function (r) { return r.cost; }), { digits: 0 }); },
              gross: function (rows) { return U.money(U.sum(rows, function (r) { return r.gross; }), { digits: 0 }); },
              expense: function (rows) { return U.money(U.sum(rows, function (r) { return r.expense; }), { digits: 0 }); },
              net: function (rows) { return U.money(U.sum(rows, function (r) { return r.net; }), { digits: 0 }); }
            }
          })]
        })])
      ]
    });
  }

  /* =========================================================================
     БЮДЖЕТИРОВАНИЕ
     ====================================================================== */
  function budget() {
    const all = App.Store.all('budgets');
    const periods = U.uniq(all.map(function (b) { return b.periodKey; })).sort().reverse();
    let periodKey = App.Router.current().params.period || periods[0];
    const rows = all.filter(function (b) { return b.periodKey === periodKey; });

    const inc = rows.filter(function (r) { return r.kind === 'income'; });
    const exp = rows.filter(function (r) { return r.kind === 'expense'; });
    const planInc = U.sum(inc, function (r) { return r.plan; }), factInc = U.sum(inc, function (r) { return r.fact; });
    const planExp = U.sum(exp, function (r) { return r.plan; }), factExp = U.sum(exp, function (r) { return r.fact; });

    const overruns = exp.filter(function (r) { return r.fact > r.plan; });

    const periodSelect = el('select.select', {
      style: { width: 'auto' },
      onchange: function (e) { App.Router.go('budget', { period: e.target.value }); }
    }, periods.map(function (p) {
      return el('option', { value: p, text: H.periodLabel(p), selected: p === periodKey });
    }));

    function budgetTable(kind, list) {
      return UI.table({
        columns: [
          { k: 'item', t: 'Статья' },
          { k: 'plan', t: 'План', num: true, render: function (r) { return U.money(r.plan, { digits: 0 }); } },
          { k: 'fact', t: 'Факт', num: true, render: function (r) { return U.money(r.fact, { digits: 0 }); } },
          {
            k: 'diff', t: 'Отклонение', num: true,
            sort: function (r) { return r.fact - r.plan; },
            render: function (r) {
              const d = r.fact - r.plan;
              const bad = kind === 'expense' ? d > 0 : d < 0;
              return el('span', { class: 'num ' + (bad ? 'down' : 'up'), text: (d > 0 ? '+' : '') + U.money(d, { digits: 0 }) });
            }
          },
          {
            id: 'exec', t: 'Исполнение', w: '180px',
            render: function (r) {
              const p = r.plan ? r.fact / r.plan * 100 : 0;
              const tone = kind === 'expense' ? (p > 100 ? 'danger' : p > 90 ? 'warn' : 'ok') : (p >= 100 ? 'ok' : p > 80 ? 'warn' : 'danger');
              return el('div', null, [
                UI.progress(Math.min(r.fact, r.plan * 1.5), r.plan * 1.5, tone),
                el('span.fs-xs.muted-2', { text: U.pct(p, 0) })
              ]);
            }
          }
        ],
        rows: list,
        pageSize: 0, exportName: kind + '-budget.csv',
        rowClass: function (r) { return kind === 'expense' && r.fact > r.plan ? 'is-danger' : ''; },
        dangerRows: true,
        totals: {
          plan: function (rs) { return U.money(U.sum(rs, function (r) { return r.plan; }), { digits: 0 }); },
          fact: function (rs) { return U.money(U.sum(rs, function (r) { return r.fact; }), { digits: 0 }); },
          diff: function (rs) { return U.money(U.sum(rs, function (r) { return r.fact - r.plan; }), { digits: 0 }); }
        }
      });
    }

    const trend = U.lastMonths(6);
    const trendPlan = trend.map(function (m) {
      return U.sum(all.filter(function (b) { return b.periodKey === m.key && b.kind === 'expense'; }), function (b) { return b.plan; });
    });
    const trendFact = trend.map(function (m) {
      return U.sum(all.filter(function (b) { return b.periodKey === m.key && b.kind === 'expense'; }), function (b) { return b.fact; });
    });

    return UI.page({
      title: 'Бюджетирование',
      subtitle: 'Планирование доходов и расходов, контроль превышения бюджета',
      actions: [periodSelect, UI.btn('Добавить статью', {
        kind: 'primary', icon: 'plus',
        onClick: function () { editBudget({ periodKey: periodKey }); }
      })],
      children: [
        UI.statGrid([
          { label: 'План доходов', value: U.moneyShort(planInc), icon: 'target', tone: 'info' },
          { label: 'Факт доходов', value: U.moneyShort(factInc), icon: 'trend', tone: factInc >= planInc ? 'ok' : 'warn',
            delta: planInc ? (factInc - planInc) / planInc * 100 : 0, meta: 'исполнение плана' },
          { label: 'План расходов', value: U.moneyShort(planExp), icon: 'target', tone: 'info' },
          { label: 'Факт расходов', value: U.moneyShort(factExp), icon: 'wallet', tone: factExp > planExp ? 'danger' : 'ok',
            delta: planExp ? (factExp - planExp) / planExp * 100 : 0, invert: true, meta: 'превышение бюджета' }
        ], 4),

        overruns.length ? el('div.alert.alert--danger.mt-4', null, [
          App.Icons.get('alert'),
          el('div', null, [
            el('strong', { text: 'Превышение бюджета по ' + overruns.length + ' статьям: ' }),
            overruns.map(function (o) { return o.item; }).join(', ')
          ])
        ]) : null,

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'План / факт расходов',
            subtitle: 'динамика за 6 месяцев',
            body: [C.bars({
              labels: trend.map(function (m) { return m.label; }), height: 230,
              series: [
                { name: 'План', values: trendPlan, color: 'var(--c8)' },
                { name: 'Факт', values: trendFact, color: 'var(--c3)' }
              ]
            })]
          }),
          UI.card({
            title: 'Исполнение бюджета',
            body: [el('div.col', null, [
              UI.meter({ label: 'Доходы', value: factInc, max: planInc || 1, tone: factInc >= planInc ? 'ok' : 'warn' }),
              UI.meter({ label: 'Расходы', value: factExp, max: planExp || 1, tone: factExp > planExp ? 'danger' : 'ok' }),
              el('hr'),
              UI.kv([
                ['Плановая прибыль', U.money(planInc - planExp, { digits: 0 })],
                ['Фактическая прибыль', U.money(factInc - factExp, { digits: 0 })],
                ['Отклонение', H.moneyCell((factInc - factExp) - (planInc - planExp), { colorize: true, digits: 0 })]
              ])
            ])]
          })
        ]),

        el('div.mt-4', null, [UI.card({
          title: 'Доходы · ' + H.periodLabel(periodKey), flush: true, body: [budgetTable('income', inc)]
        })]),
        el('div.mt-4', null, [UI.card({
          title: 'Расходы · ' + H.periodLabel(periodKey), flush: true, body: [budgetTable('expense', exp)]
        })])
      ]
    });
  }

  function editBudget(values) {
    UI.formModal({
      title: values.id ? 'Статья бюджета' : 'Новая статья бюджета',
      values: values,
      fields: [
        { k: 'kind', t: 'Вид', type: 'select', required: true, col: 6, empty: false,
          options: [{ v: 'income', t: 'Доход' }, { v: 'expense', t: 'Расход' }] },
        { k: 'item', t: 'Статья', required: true, col: 6, placeholder: 'например, Аренда офиса' },
        { k: 'plan', t: 'План, сом', type: 'money', required: true, col: 6 },
        { k: 'fact', t: 'Факт, сом', type: 'money', col: 6 }
      ],
      onSave: function (v) {
        v.period = H.periodLabel(values.periodKey);
        v.periodKey = values.periodKey;
        v.fact = v.fact || 0;
        if (values.id) App.Store.update('budgets', values.id, v);
        else App.Store.insert('budgets', v);
        UI.toast({ kind: 'ok', title: 'Статья бюджета сохранена' });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     УПРАВЛЕНИЕ ЗАДОЛЖЕННОСТЬЮ
     ====================================================================== */
  function debts() {
    const rec = H.receivables();
    const pay = H.payables();
    const recTotal = U.sum(rec, function (r) { return r.debt; });
    const overdueTotal = U.sum(rec, function (r) { return r.overdue; });
    const payTotal = U.sum(pay, function (r) { return r.debt; });

    const clientTable = UI.table({
      search: ['name'],
      searchPlaceholder: 'Поиск клиента…',
      columns: [
        { k: 'name', t: 'Клиент' },
        { k: 'docs', t: 'Документов', num: true },
        { k: 'debt', t: 'Сумма долга', num: true, render: function (r) { return U.money(r.debt, { digits: 0 }); } },
        { k: 'overdue', t: 'Просрочено', num: true, render: function (r) { return r.overdue ? el('span.num.down', { text: U.money(r.overdue, { digits: 0 }) }) : '—'; } },
        { k: 'oldest', t: 'Срок оплаты', render: function (r) { return U.fmtDate(r.oldest); } },
        { k: 'daysOverdue', t: 'Дней просрочки', num: true,
          render: function (r) { return r.daysOverdue ? UI.badge(r.daysOverdue + ' дн.', r.daysOverdue > 30 ? 'danger' : 'warn') : UI.badge('в сроке', 'ok'); } },
        { id: 'act', t: '', w: '90px', sortable: false, render: function (r) {
          return UI.rowActions([
            { icon: 'message', title: 'Напомнить об оплате', onClick: function () { remind(r); } },
            { icon: 'file', title: 'Акт сверки', onClick: function () { reconciliation(r); } }
          ]);
        } }
      ],
      rows: rec,
      sort: { k: 'debt', dir: 'desc' },
      pageSize: 12,
      exportName: 'receivables.csv',
      rowClass: function (r) { return r.overdue > 0 ? 'is-danger' : ''; },
      dangerRows: true,
      emptyTitle: 'Задолженности нет',
      emptyText: 'Все счета клиентов оплачены.'
    });

    const supplierTable = UI.table({
      search: ['name'],
      searchPlaceholder: 'Поиск поставщика…',
      columns: [
        { k: 'name', t: 'Поставщик' },
        { k: 'docs', t: 'Заказов', num: true },
        { k: 'debt', t: 'Сумма к оплате', num: true, render: function (r) { return U.money(r.debt, { digits: 0 }); } },
        { k: 'nearest', t: 'Дата платежа', render: function (r) { return U.fmtDate(r.nearest); } },
        { k: 'priority', t: 'Приоритет', render: function (r) {
          return UI.badge({ high: 'Высокий', normal: 'Средний', low: 'Низкий' }[r.priority],
            r.priority === 'high' ? 'danger' : r.priority === 'normal' ? 'warn' : '');
        } },
        { id: 'act', t: '', w: '60px', sortable: false, render: function (r) {
          return UI.rowActions([{ icon: 'send', title: 'Создать платёж', onClick: function () { App.Router.go('payments'); } }]);
        } }
      ],
      rows: pay,
      sort: { k: 'debt', dir: 'desc' },
      pageSize: 12,
      exportName: 'payables.csv'
    });

    const aging = [
      { name: 'В сроке', value: recTotal - overdueTotal, color: 'var(--c2)' },
      { name: 'До 30 дней', value: U.sum(rec.filter(function (r) { return r.daysOverdue > 0 && r.daysOverdue <= 30; }), function (r) { return r.overdue; }), color: 'var(--c3)' },
      { name: 'Свыше 30 дней', value: U.sum(rec.filter(function (r) { return r.daysOverdue > 30; }), function (r) { return r.overdue; }), color: 'var(--c4)' }
    ];

    return UI.page({
      title: 'Управление задолженностью',
      subtitle: 'Контроль долгов клиентов и обязательств перед поставщиками',
      children: [
        UI.statGrid([
          { label: 'Дебиторская задолженность', value: U.moneyShort(recTotal), icon: 'users', tone: 'info', meta: rec.length + ' клиентов' },
          { label: 'Просроченная дебиторка', value: U.moneyShort(overdueTotal), icon: 'alert', tone: 'danger',
            meta: U.pct(recTotal ? overdueTotal / recTotal * 100 : 0) + ' от общей суммы' },
          { label: 'Кредиторская задолженность', value: U.moneyShort(payTotal), icon: 'truck', tone: 'warn', meta: pay.length + ' поставщиков' },
          { label: 'Чистая позиция', value: U.moneyShort(recTotal - payTotal), icon: 'scale', tone: recTotal >= payTotal ? 'ok' : 'danger' }
        ], 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({ title: 'Долги клиентов', flush: true, body: [clientTable] }),
          UI.card({ title: 'Структура просрочки', body: [C.donut({ items: aging, size: 190, centerTop: U.moneyShort(recTotal), centerBottom: 'дебиторка' })] })
        ]),

        el('div.mt-4', null, [UI.card({ title: 'Долги поставщикам · приоритет оплаты', flush: true, body: [supplierTable] })])
      ]
    });
  }

  function remind(r) {
    UI.confirm({
      title: 'Напоминание об оплате',
      text: 'Отправить напоминание клиенту «' + r.name + '» о задолженности ' + U.money(r.debt, { digits: 0 }) + '? Уведомление уйдёт по Email и в Telegram.',
      okText: 'Отправить',
      onOk: function () {
        H.notify({ kind: 'info', icon: 'send', title: 'Напоминание отправлено', text: r.name + ' · ' + U.money(r.debt, { digits: 0 }), link: '#/debts' });
        App.Store.logAction('отправил напоминание об оплате', 'counterparties', { id: r.id, name: r.name });
        UI.toast({ kind: 'ok', title: 'Напоминание отправлено', text: 'Email + Telegram' });
      }
    });
  }

  function reconciliation(r) {
    const sales = App.Store.all('sales').filter(function (s) { return s.counterpartyId === r.id; });
    UI.modal({
      title: 'Акт сверки · ' + r.name,
      size: 'lg',
      body: [
        UI.kv([
          ['Контрагент', r.name],
          ['Период', 'с ' + U.fmtDate(U.addDays(new Date(), -365)) + ' по ' + U.fmtDate(U.today())],
          ['Всего отгружено', U.money(U.sum(sales, function (s) { return s.amount; }), { digits: 0 })],
          ['Всего оплачено', U.money(U.sum(sales, function (s) { return s.paid; }), { digits: 0 })],
          ['Задолженность на конец периода', el('strong', { text: U.money(r.debt, { digits: 0 }) })]
        ]),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'date', t: 'Дата', render: function (s) { return U.fmtDate(s.date); } },
            { k: 'number', t: 'Документ' },
            { k: 'amount', t: 'Отгрузка', num: true, render: function (s) { return U.money(s.amount, { digits: 0 }); } },
            { k: 'paid', t: 'Оплата', num: true, render: function (s) { return U.money(s.paid, { digits: 0 }); } },
            { id: 'debt', t: 'Долг', num: true, render: function (s) { return U.money(s.amount - s.paid, { digits: 0 }); } }
          ],
          rows: U.sortBy(sales, function (s) { return s.date; }, 'desc'),
          pageSize: 10, exportName: 'akt-sverki.csv'
        })])
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        { text: 'Печать акта', kind: 'primary', icon: 'print', close: false, onClick: function () { window.print(); } }
      ]
    });
  }

  /* --- Регистрация маршрутов ------------------------------------------------ */
  App.Router.add('dashboard', { title: 'Дашборд', module: 'dashboard', render: dashboard });
  App.Router.add('analytics', { title: 'Финансовая аналитика', module: 'analytics', render: analytics });
  App.Router.add('budget', { title: 'Бюджетирование', module: 'budget', render: budget });
  App.Router.add('debts', { title: 'Задолженность', module: 'debts', render: debts });
})(window.App);

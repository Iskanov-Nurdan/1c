/* =============================================================================
   МОДУЛЬ: Основные средства · Амортизация
   ТЗ п. 5. Учёт по МСФО (IAS) 16.

   Формулы продублированы с сервером (apps/accounting/services.py): демо-режим
   работает без бэкенда, поэтому расчёт обязан существовать и здесь. При
   правке одной стороны правится и вторая — иначе демо и боевой контур
   разойдутся в суммах.

   СОГЛАШЕНИЯ УЧЁТА
   1. Амортизация начисляется с месяца, следующего за вводом в эксплуатацию,
      и прекращается в месяце выбытия.
   2. Амортизируемая база = первоначальная − ликвидационная стоимость.
   3. В последнем месяце срока доначисляется весь остаток базы, чтобы на
      счёте 02 не оставался «хвост» от округлений.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  const D = App.Depreciation;
  const GROUPS = D.GROUPS, METHODS = D.METHODS, STATUSES = D.STATUSES;

  const groupName = D.groupName, methodName = D.methodName;
  const money = D.money, monthEnd = D.monthEnd, monthNumber = D.monthNumber;
  const depreciableBase = D.depreciableBase, residual = D.residual;
  const monthlyAmount = D.monthlyAmount, schedule = D.schedule;

  function statusBadge(a) {
    const s = D.statusOf(a.status);
    return UI.badge(s.t, s.tone);
  }

  /* --- Данные ------------------------------------------------------------- */
  function assetRows() {
    return App.Store.all('fixedAssets').map(function (a) {
      const base = depreciableBase(a);
      return Object.assign({}, a, {
        groupName: groupName(a.group),
        methodName: methodName(a.method),
        residualValue: residual(a),
        wear: base > 0 ? Math.min(money(a.accumulated) / base * 100, 100) : 0
      });
    });
  }

  function depreciationsOf(assetId) {
    return App.Store.all('depreciations')
      .filter(function (d) { return d.assetId === assetId; })
      .sort(function (a, b) { return b.periodKey.localeCompare(a.periodKey); });
  }

  /** Периоды, за которые начисление уже выполнено */
  function accruedKeys(periodKey) {
    const map = {};
    App.Store.all('depreciations').forEach(function (d) {
      if (d.periodKey === periodKey) map[d.assetId] = true;
    });
    return map;
  }

  /* =========================================================================
     РЕЕСТР ОБЪЕКТОВ
     ====================================================================== */
  function assets() {
    const rows = assetRows();
    const live = rows.filter(function (a) { return a.status === 'operation'; });
    const canEdit = App.Auth.canEdit('assets');

    const initial = U.sum(rows, function (a) { return money(a.initialCost); });
    const wear = U.sum(rows, function (a) { return money(a.accumulated); });

    return UI.page({
      title: 'Основные средства',
      subtitle: 'Здания, транспорт, оборудование и инвентарь: стоимость, износ и остаточная стоимость',
      actions: [
        canEdit ? UI.btn('Начислить амортизацию', { icon: 'percent', onClick: function () { accrueModal(); } }) : null,
        canEdit ? UI.btn('Принять к учёту', { kind: 'primary', icon: 'plus', onClick: function () { editAsset(null); } }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Объектов в учёте', value: rows.length, meta: live.length + ' в эксплуатации', icon: 'archive', tone: 'info' },
          { label: 'Первоначальная стоимость', value: U.moneyShort(initial), icon: 'wallet', tone: 'violet' },
          { label: 'Накопленная амортизация', value: U.moneyShort(wear), meta: initial ? U.pct(wear / initial * 100) + ' износа' : '', icon: 'trend', tone: 'warn' },
          { label: 'Остаточная стоимость', value: U.moneyShort(initial - wear), icon: 'scale', tone: 'ok' }
        ], 4),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Структура по группам',
            subtitle: 'Остаточная стоимость',
            body: [groupChart(rows)]
          }),
          UI.card({
            title: 'Начислено за последние 12 месяцев',
            subtitle: 'Дт счетов затрат — Кт 02',
            body: [historyChart()]
          })
        ]),

        el('div.mt-4', null, [UI.card({
          title: 'Реестр основных средств',
          flush: true,
          body: [UI.table({
            search: ['invNumber', 'name', 'responsible', 'location'],
            searchPlaceholder: 'Поиск по инвентарному номеру, наименованию, МОЛ…',
            filters: [
              { k: 'group', t: 'Группа', options: GROUPS },
              { k: 'method', t: 'Метод', options: METHODS.map(function (m) { return { v: m.v, t: m.t }; }) },
              { k: 'status', t: 'Состояние', options: STATUSES.map(function (s) { return { v: s.v, t: s.t }; }) }
            ],
            columns: [
              { k: 'invNumber', t: 'Инв. №', w: '96px', render: function (a) { return el('span.mono.strong', { text: a.invNumber }); } },
              { k: 'name', t: 'Наименование', render: function (a) {
                return el('div', null, [
                  el('strong.truncate', { text: a.name }),
                  el('div', null, [el('small', { text: a.groupName + (a.location ? ' · ' + a.location : '') })])
                ]);
              } },
              { k: 'commissionedAt', t: 'В эксплуатации с', w: '130px', render: function (a) { return U.fmtDate(a.commissionedAt); } },
              { k: 'methodName', t: 'Метод', w: '150px' },
              { k: 'initialCost', t: 'Первоначальная', num: true, render: function (a) { return U.money(a.initialCost, { digits: 0 }); } },
              { k: 'accumulated', t: 'Амортизация', num: true, render: function (a) { return U.money(a.accumulated, { digits: 0 }); } },
              { k: 'residualValue', t: 'Остаточная', num: true, render: function (a) { return H.moneyCell(a.residualValue, { digits: 0 }); } },
              { k: 'wear', t: 'Износ', w: '120px', render: function (a) { return UI.progress(a.wear, 100, a.wear > 90 ? 'danger' : a.wear > 60 ? 'warn' : 'ok'); } },
              { k: 'status', t: 'Состояние', w: '140px', render: statusBadge },
              { id: 'act', t: '', w: '96px', sortable: false, render: function (a) {
                return UI.rowActions([
                  { icon: 'eye', title: 'Карточка объекта', onClick: function () { assetCard(a); } },
                  canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editAsset(a); } } : null,
                  canEdit && a.status === 'operation' ? { icon: 'archive', title: 'Выбытие', kind: 'danger', onClick: function () { disposeAsset(a); } } : null
                ].filter(Boolean));
              } }
            ],
            rows: rows,
            pageSize: 15,
            sort: { k: 'invNumber', dir: 'asc' },
            exportName: 'fixed-assets',
            exportTitle: 'Реестр основных средств',
            onRow: assetCard,
            emptyTitle: 'Основных средств пока нет',
            emptyText: 'Примите к учёту здание, транспорт или оборудование',
            totals: {
              initialCost: function (list) { return U.money(U.sum(list, function (a) { return money(a.initialCost); }), { digits: 0 }); },
              accumulated: function (list) { return U.money(U.sum(list, function (a) { return money(a.accumulated); }), { digits: 0 }); },
              residualValue: function (list) { return U.money(U.sum(list, function (a) { return a.residualValue; }), { digits: 0 }); }
            }
          })]
        })])
      ]
    });
  }

  function groupChart(rows) {
    const byGroup = U.groupBy(rows, function (a) { return a.group; });
    const data = Object.keys(byGroup).map(function (g) {
      return { name: groupName(g), value: U.sum(byGroup[g], function (a) { return a.residualValue; }) };
    }).filter(function (d) { return d.value > 0; });
    if (!data.length) return UI.empty({ title: 'Нет данных для диаграммы' });
    return C.donut({ items: data });
  }

  function historyChart() {
    const months = U.lastMonths(12);
    const rows = App.Store.all('depreciations');
    const values = months.map(function (m) {
      return U.sum(rows.filter(function (d) { return d.periodKey === m.key; }), function (d) { return money(d.amount); });
    });
    if (!U.sum(values, function (v) { return v; })) {
      return UI.empty({ title: 'Амортизация ещё не начислялась', text: 'Нажмите «Начислить амортизацию» за нужный месяц' });
    }
    return C.bars({ labels: months.map(function (m) { return m.label; }), series: [{ name: 'Начислено', values: values }] });
  }

  /* =========================================================================
     КАРТОЧКА ОБЪЕКТА
     ====================================================================== */
  function assetCard(a) {
    const asset = App.Store.get('fixedAssets', a.id) || a;
    const base = depreciableBase(asset);
    const done = money(asset.accumulated);
    const history = depreciationsOf(asset.id);
    const plan = schedule(asset);
    const left = plan.filter(function (r) { return r.periodKey > U.ym(U.today()); });

    UI.modal({
      title: asset.invNumber + ' — ' + asset.name,
      size: 'xl',
      body: [
        UI.statGrid([
          { label: 'Первоначальная стоимость', value: U.money(asset.initialCost, { digits: 0 }), tone: 'violet' },
          { label: 'Накопленная амортизация', value: U.money(done, { digits: 0 }), tone: 'warn' },
          { label: 'Остаточная стоимость', value: U.money(residual(asset), { digits: 0 }), tone: 'ok' },
          { label: 'Износ', value: U.pct(base > 0 ? done / base * 100 : 0), tone: 'info' }
        ], 4),

        el('div.mt-4', null, [UI.tabs([
          {
            id: 'card', title: 'Карточка',
            render: function () {
              return el('div.grid.grid--2', null, [
                UI.card({
                  title: 'Объект',
                  body: [UI.kv([
                    ['Инвентарный номер', el('span.mono', { text: asset.invNumber })],
                    ['Группа', groupName(asset.group)],
                    ['Дата ввода в эксплуатацию', U.fmtDate(asset.commissionedAt)],
                    ['Местонахождение', asset.location],
                    ['Материально ответственный', asset.responsible],
                    ['Состояние', statusBadge(asset)],
                    asset.disposedAt ? ['Дата выбытия', U.fmtDate(asset.disposedAt)] : null,
                    asset.disposalReason ? ['Причина выбытия', asset.disposalReason] : null,
                    asset.note ? ['Примечание', asset.note] : null
                  ])]
                }),
                UI.card({
                  title: 'Амортизация',
                  body: [UI.kv([
                    ['Метод', methodName(asset.method)],
                    ['Срок полезного использования', asset.lifeMonths + ' мес. (' + U.round(asset.lifeMonths / 12, 1) + ' г.)'],
                    ['Ликвидационная стоимость', U.money(asset.salvageValue, { digits: 0 })],
                    ['Амортизируемая база', U.money(base, { digits: 0 })],
                    asset.method === 'declining' ? ['Коэффициент ускорения', asset.decliningRate] : null,
                    asset.method === 'units' ? ['Плановая выработка', U.num(asset.totalUnits) + ' ' + (asset.unitsName || '')] : null,
                    asset.method === 'units' ? ['Фактическая выработка', U.num(asset.usedUnits) + ' ' + (asset.unitsName || '')] : null,
                    ['Счета учёта', el('span.mono', { text: asset.account + ' / ' + asset.depreciationAccount })],
                    ['Счёт затрат', el('span.mono', { text: asset.expenseAccount })],
                    ['Осталось начислить', U.money(Math.max(base - done, 0), { digits: 0 }) + ' · ' + left.length + ' мес.']
                  ])]
                })
              ]);
            }
          },
          {
            id: 'plan', title: 'График амортизации', count: plan.length,
            render: function () {
              if (!plan.length) return UI.empty({ title: 'График не рассчитан', text: 'Проверьте срок полезного использования и стоимость объекта' });
              return el('div', null, [
                C.line({
                  labels: plan.map(function (r) { return r.period; }),
                  series: [{ name: 'Остаточная стоимость', values: plan.map(function (r) { return r.residual; }) }]
                }),
                el('div.mt-4', null, [UI.table({
                  columns: [
                    { k: 'period', t: 'Период', w: '160px', sort: function (r) { return r.periodKey; } },
                    { k: 'amount', t: 'Начисление', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
                    { k: 'accumulated', t: 'Накоплено', num: true, render: function (r) { return U.money(r.accumulated, { digits: 0 }); } },
                    { k: 'residual', t: 'Остаточная стоимость', num: true, render: function (r) { return U.money(r.residual, { digits: 0 }); } }
                  ],
                  rows: plan, pageSize: 12, exportName: 'depreciation-plan-' + asset.invNumber
                })])
              ]);
            }
          },
          {
            id: 'history', title: 'Начислено', count: history.length,
            render: function () {
              if (!history.length) return UI.empty({ title: 'Начислений ещё не было', text: 'Амортизация начисляется помесячно из реестра основных средств' });
              return UI.table({
                columns: [
                  { k: 'period', t: 'Период', w: '160px', sort: function (r) { return r.periodKey; } },
                  { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
                  { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
                  { k: 'residualAfter', t: 'Остаточная после', num: true, render: function (r) { return U.money(r.residualAfter, { digits: 0 }); } },
                  { id: 'entry', t: 'Проводка', w: '150px', sortable: false, render: function (r) {
                    return el('span.mono.fs-sm', { text: asset.expenseAccount + ' / ' + asset.depreciationAccount });
                  } }
                ],
                rows: history, pageSize: 12, exportName: 'depreciation-' + asset.invNumber,
                totals: { amount: function (list) { return U.money(U.sum(list, function (r) { return money(r.amount); }), { digits: 0 }); } }
              });
            }
          }
        ])])
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        App.Auth.canEdit('assets') ? { text: 'Изменить', kind: 'primary', icon: 'edit', onClick: function () { setTimeout(function () { editAsset(asset); }, 60); } } : null
      ].filter(Boolean)
    });
  }

  /* =========================================================================
     ПРИЁМ К УЧЁТУ И РЕДАКТИРОВАНИЕ
     ====================================================================== */
  /** Следующий инвентарный номер: H.nextNumber считает по полю number */
  function nextInvNumber() {
    let max = 0;
    App.Store.all('fixedAssets').forEach(function (a) {
      const m = String(a.invNumber || '').match(/(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'ОС-' + String(max + 1).padStart(4, '0');
  }

  function editAsset(a) {
    const isNew = !a;

    UI.formModal({
      title: isNew ? 'Приём основного средства к учёту' : 'Основное средство ' + a.invNumber,
      size: 'xl',
      saveText: isNew ? 'Принять к учёту' : 'Сохранить',
      values: a || {
        invNumber: nextInvNumber(),
        group: 'other', method: 'straight', status: 'operation',
        account: '01', depreciationAccount: '02', expenseAccount: '26',
        commissionedAt: U.today(), lifeMonths: 60, decliningRate: 2,
        initialCost: 0, salvageValue: 0, accumulated: 0, totalUnits: 0, usedUnits: 0
      },
      fields: [
        { k: 'invNumber', t: 'Инвентарный номер', required: true, col: 4 },
        { k: 'name', t: 'Наименование объекта', required: true, col: 8, placeholder: 'Автомобиль Toyota Camry' },
        { k: 'group', t: 'Группа', type: 'select', col: 4, empty: false, options: GROUPS,
          onChange: function (values, form) {
            // Срок подставляется только при первичном приёме, чтобы не
            // затирать уже принятое учётной политикой значение
            if (isNew) form.setValue('lifeMonths', D.TYPICAL_LIFE[values.group] || 60);
          } },
        { k: 'commissionedAt', t: 'Дата ввода в эксплуатацию', type: 'date', required: true, col: 4 },
        { k: 'status', t: 'Состояние', type: 'select', col: 4, empty: false, options: STATUSES.map(function (s) { return { v: s.v, t: s.t }; }) },

        { type: 'section', t: 'Стоимость и срок' },
        { k: 'initialCost', t: 'Первоначальная стоимость', type: 'money', required: true, col: 4 },
        { k: 'salvageValue', t: 'Ликвидационная стоимость', type: 'money', col: 4, hint: 'Сколько объект будет стоить в конце срока' },
        { k: 'lifeMonths', t: 'Срок полезного использования, мес.', type: 'number', required: true, col: 4, min: 1 },

        { type: 'section', t: 'Метод амортизации' },
        { k: 'method', t: 'Метод', type: 'select', col: 4, empty: false, options: METHODS.map(function (m) { return { v: m.v, t: m.t }; }),
          hint: 'Линейный — для зданий и мебели, уменьшаемого остатка — для транспорта' },
        { k: 'decliningRate', t: 'Коэффициент ускорения', type: 'number', col: 4, step: '0.1', hint: 'Только для метода уменьшаемого остатка' },
        { k: 'accumulated', t: 'Накоплено амортизации', type: 'money', col: 4, hint: 'Заполняется при переносе остатков из прежней системы' },
        { k: 'totalUnits', t: 'Плановая выработка', type: 'number', col: 4, hint: 'Только для производственного метода' },
        { k: 'unitsName', t: 'Единица выработки', col: 4, placeholder: 'моточас, км, шт' },
        { k: 'usedUnits', t: 'Фактическая выработка', type: 'number', col: 4 },

        { type: 'section', t: 'Учёт и эксплуатация' },
        { k: 'account', t: 'Счёт учёта', type: 'select', col: 4, empty: false, options: H.accountOptions() },
        { k: 'depreciationAccount', t: 'Счёт амортизации', type: 'select', col: 4, empty: false, options: H.accountOptions() },
        { k: 'expenseAccount', t: 'Счёт затрат', type: 'select', col: 4, empty: false, options: H.accountOptions(),
          hint: '26 — управленческие расходы, 20 — производство, 44 — расходы на продажу' },
        { k: 'location', t: 'Местонахождение', col: 6 },
        { k: 'responsible', t: 'Материально ответственное лицо', type: 'select', col: 6, options: H.employeeOptions().map(function (o) { return { v: o.t, t: o.t }; }) },
        { k: 'note', t: 'Примечание', type: 'textarea', col: 12, rows: 2 }
      ],
      onSave: function (values) {
        const patch = Object.assign({}, values);
        patch.initialCost = money(patch.initialCost);
        patch.salvageValue = money(patch.salvageValue);
        patch.accumulated = money(patch.accumulated);

        if (patch.salvageValue > patch.initialCost) {
          UI.toast({ kind: 'danger', title: 'Проверьте стоимость', text: 'Ликвидационная стоимость не может превышать первоначальную' });
          return false;
        }
        if (patch.method === 'units' && !(Number(patch.totalUnits) > 0)) {
          UI.toast({ kind: 'danger', title: 'Не задана выработка', text: 'Для производственного метода нужна плановая выработка' });
          return false;
        }

        if (isNew) {
          App.Store.insert('fixedAssets', patch);
          UI.toast({ kind: 'ok', title: 'Объект принят к учёту', text: patch.invNumber + ' — ' + patch.name });
        } else {
          App.Store.update('fixedAssets', a.id, patch);
          UI.toast({ kind: 'ok', title: 'Изменения сохранены' });
        }
        App.Router.render();
      }
    });
  }

  /* --- Выбытие ------------------------------------------------------------ */
  function disposeAsset(a) {
    const asset = App.Store.get('fixedAssets', a.id) || a;
    UI.formModal({
      title: 'Выбытие: ' + asset.name,
      size: 'lg',
      saveText: 'Провести выбытие',
      note: 'Остаточная стоимость ' + U.money(residual(asset), { digits: 0 }) +
        ' будет списана проводкой Дт 91 — Кт ' + asset.account + '. Амортизация по объекту прекращается.',
      values: { status: 'written_off', disposedAt: U.today(), disposalReason: '' },
      fields: [
        { k: 'status', t: 'Вид выбытия', type: 'select', col: 6, empty: false, options: [
          { v: 'written_off', t: 'Списание (износ, поломка)' },
          { v: 'sold', t: 'Продажа' },
          { v: 'conserved', t: 'Перевод на консервацию' }
        ] },
        { k: 'disposedAt', t: 'Дата выбытия', type: 'date', required: true, col: 6 },
        { k: 'disposalReason', t: 'Основание', required: true, col: 12, placeholder: 'Акт о списании № 12 от 25.08.2026' }
      ],
      onSave: function (values) {
        const rest = residual(asset);
        App.Store.update('fixedAssets', asset.id, {
          status: values.status,
          disposedAt: values.status === 'conserved' ? null : values.disposedAt,
          disposalReason: values.disposalReason
        });

        // Консервация не выбытие: объект остаётся на балансе, проводок нет
        if (values.status !== 'conserved') {
          const wear = money(asset.accumulated);
          if (wear > 0) {
            insertEntry({
              date: values.disposedAt, debit: asset.depreciationAccount, credit: asset.account,
              amount: wear, content: 'Списана накопленная амортизация: ' + asset.name
            });
          }
          if (rest > 0) {
            insertEntry({
              date: values.disposedAt, debit: '91', credit: asset.account,
              amount: rest, content: 'Списана остаточная стоимость: ' + asset.name
            });
          }
        }

        UI.toast({
          kind: 'ok',
          title: values.status === 'conserved' ? 'Объект переведён на консервацию' : 'Выбытие проведено',
          text: asset.invNumber + ' — ' + asset.name
        });
        App.Router.render();
      }
    });
  }

  function insertEntry(cfg) {
    return App.Store.insert('entries', {
      number: H.nextNumber('entries', '').replace('-', ''),
      date: cfg.date, debit: cfg.debit, credit: cfg.credit,
      amount: money(cfg.amount), content: cfg.content,
      auto: true, posted: true
    });
  }

  /* =========================================================================
     НАЧИСЛЕНИЕ АМОРТИЗАЦИИ ЗА ПЕРИОД
     ====================================================================== */
  function accrueModal(defaultKey) {
    const periodKey = defaultKey || U.ym(U.today());
    const box = el('div');

    function draw(key) {
      const dateIso = monthEnd(key);
      const already = accruedKeys(key);
      const list = App.Store.all('fixedAssets')
        .filter(function (a) { return a.status === 'operation'; })
        .map(function (a) {
          const skipReason = already[a.id] ? 'Уже начислено за этот период'
            : monthNumber(a, dateIso) < 1 ? 'Введён в эксплуатацию позже'
              : money(a.accumulated) >= depreciableBase(a) ? 'Самортизирован полностью'
                : a.method === 'units' && !(Number(a.totalUnits) > 0) ? 'Не задана плановая выработка'
                  : '';
          // Для производственного метода выработку вводит бухгалтер;
          // по умолчанию подставляется среднемесячная плановая.
          const units = D.plannedUnits(a);
          return Object.assign({}, a, {
            skipReason: skipReason,
            units: units,
            amount: skipReason ? 0 : monthlyAmount(a, dateIso, { units: units })
          });
        });

      const ready = list.filter(function (a) { return !a.skipReason && a.amount > 0; });
      const total = U.sum(ready, function (a) { return a.amount; });

      U.clear(box);
      U.append(box, [
        UI.statGrid([
          { label: 'Период', value: H.periodLabel(key), tone: 'info' },
          { label: 'Объектов к начислению', value: ready.length, meta: 'из ' + list.length + ' в эксплуатации', tone: 'violet' },
          { label: 'Сумма амортизации', value: U.money(total, { digits: 0 }), tone: 'warn' }
        ], 3),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'invNumber', t: 'Инв. №', w: '90px', render: function (a) { return el('span.mono', { text: a.invNumber }); } },
            { k: 'name', t: 'Объект' },
            { id: 'method', t: 'Метод', w: '150px', sortable: false, render: function (a) { return methodName(a.method); } },
            { id: 'accounts', t: 'Проводка', w: '110px', sortable: false, render: function (a) {
              return el('span.mono.fs-sm', { text: a.expenseAccount + ' / ' + a.depreciationAccount });
            } },
            { k: 'amount', t: 'Сумма', num: true, render: function (a) {
              return a.skipReason ? el('small.muted', { text: a.skipReason }) : U.money(a.amount, { digits: 0 });
            } }
          ],
          rows: list, pageSize: 10, exportName: 'depreciation-' + key,
          totals: { amount: function (rows) { return U.money(U.sum(rows, function (a) { return a.amount; }), { digits: 0 }); } }
        })])
      ]);

      box.__ready = ready;
      box.__key = key;
      box.__date = dateIso;
    }

    const months = U.lastMonths(12).slice().reverse();
    const picker = el('select.select', {
      'aria-label': 'Период начисления',
      onchange: function (e) { draw(e.target.value); }
    }, months.map(function (m) {
      return el('option', { value: m.key, text: m.label, selected: m.key === periodKey });
    }));

    draw(periodKey);

    UI.modal({
      title: 'Начисление амортизации',
      size: 'xl',
      body: [
        el('div.row.mb-4', null, [
          el('label.field__label', { text: 'Период начисления' }),
          picker
        ]),
        box
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        {
          text: 'Начислить и провести', kind: 'primary', icon: 'check',
          onClick: function () {
            const ready = box.__ready || [];
            if (!ready.length) {
              UI.toast({ kind: 'warn', title: 'Нечего начислять', text: 'За этот период амортизация уже начислена' });
              return false;
            }
            runAccrual(ready, box.__key, box.__date);
          }
        }
      ]
    });
  }

  /** Создаёт проводки и записи журнала амортизации за период */
  function runAccrual(list, periodKey, dateIso) {
    let total = 0;

    list.forEach(function (a) {
      const asset = App.Store.get('fixedAssets', a.id);
      if (!asset) return;

      const entry = insertEntry({
        date: dateIso,
        debit: asset.expenseAccount,
        credit: asset.depreciationAccount,
        amount: a.amount,
        content: 'Начислена амортизация: ' + asset.name + ' (' + H.periodLabel(periodKey) + ')'
      });

      const accumulated = money(money(asset.accumulated) + a.amount);
      App.Store.update('fixedAssets', asset.id, {
        accumulated: accumulated,
        usedUnits: asset.method === 'units'
          ? money((Number(asset.usedUnits) || 0) + (Number(a.units) || 0))
          : asset.usedUnits
      }, { silent: true });

      App.Store.insert('depreciations', {
        assetId: asset.id,
        assetName: asset.name,
        periodKey: periodKey,
        period: H.periodLabel(periodKey),
        date: dateIso,
        method: asset.method,
        amount: a.amount,
        units: money(a.units || 0),
        accumulatedAfter: accumulated,
        residualAfter: money(money(asset.initialCost) - accumulated),
        entryId: entry.id,
        posted: true
      }, { silent: true });

      total += a.amount;
    });

    App.Store.emit('fixedAssets');
    App.Store.emit('depreciations');
    App.Store.persist();

    UI.closeModal();
    UI.toast({
      kind: 'ok',
      title: 'Амортизация начислена',
      text: H.periodLabel(periodKey) + ': ' + list.length + ' об. на ' + U.money(total, { digits: 0 })
    });
    App.Router.render();
  }

  /* =========================================================================
     ВЕДОМОСТЬ АМОРТИЗАЦИИ
     ====================================================================== */
  function depreciation() {
    const rows = App.Store.all('depreciations').map(function (d) {
      const asset = App.Store.get('fixedAssets', d.assetId);
      return Object.assign({}, d, {
        invNumber: asset ? asset.invNumber : '—',
        groupName: asset ? groupName(asset.group) : '—',
        methodName: methodName(d.method),
        accounts: asset ? asset.expenseAccount + ' / ' + asset.depreciationAccount : '—'
      });
    });

    const byPeriod = U.groupBy(rows, function (d) { return d.periodKey; });
    const periods = Object.keys(byPeriod).sort().slice(-12);
    const current = U.ym(U.today());

    return UI.page({
      title: 'Амортизация',
      subtitle: 'Ведомость начисленной амортизации по объектам и периодам',
      actions: [
        App.Auth.canEdit('assets') ? UI.btn('Начислить за месяц', { kind: 'primary', icon: 'percent', onClick: function () { accrueModal(); } }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Начислено за всё время', value: U.moneyShort(U.sum(rows, function (d) { return money(d.amount); })), icon: 'trend', tone: 'warn' },
          { label: 'За текущий месяц', value: U.moneyShort(U.sum(byPeriod[current] || [], function (d) { return money(d.amount); })), meta: H.periodLabel(current), icon: 'calendar', tone: 'info' },
          { label: 'Записей в ведомости', value: rows.length, icon: 'clipboard', tone: 'violet' },
          { label: 'Периодов закрыто', value: Object.keys(byPeriod).length, icon: 'check', tone: 'ok' }
        ], 4),

        periods.length ? el('div.mt-4', null, [UI.card({
          title: 'Начисления по месяцам',
          body: [C.bars({
            labels: periods.map(function (k) { return H.periodLabel(k); }),
            series: [{ name: 'Начислено', values: periods.map(function (k) { return U.sum(byPeriod[k], function (d) { return money(d.amount); }); }) }]
          })]
        })]) : null,

        el('div.mt-4', null, [UI.card({
          title: 'Ведомость начислений',
          flush: true,
          body: [UI.table({
            search: ['assetName', 'invNumber', 'period'],
            searchPlaceholder: 'Поиск по объекту или периоду…',
            filters: [
              { k: 'periodKey', t: 'Период', options: Object.keys(byPeriod).sort().reverse().map(function (k) { return { v: k, t: H.periodLabel(k) }; }) },
              { k: 'method', t: 'Метод', options: METHODS.map(function (m) { return { v: m.v, t: m.t }; }) }
            ],
            columns: [
              { k: 'period', t: 'Период', w: '150px', sort: function (d) { return d.periodKey; } },
              { k: 'invNumber', t: 'Инв. №', w: '90px', render: function (d) { return el('span.mono', { text: d.invNumber }); } },
              { k: 'assetName', t: 'Объект' },
              { k: 'groupName', t: 'Группа', w: '190px' },
              { k: 'methodName', t: 'Метод', w: '150px' },
              { k: 'accounts', t: 'Проводка', w: '110px', render: function (d) { return el('span.mono.fs-sm', { text: d.accounts }); } },
              { k: 'amount', t: 'Начислено', num: true, render: function (d) { return U.money(d.amount, { digits: 0 }); } },
              { k: 'residualAfter', t: 'Остаточная после', num: true, render: function (d) { return U.money(d.residualAfter, { digits: 0 }); } }
            ],
            rows: rows,
            pageSize: 20,
            sort: { k: 'period', dir: 'desc' },
            exportName: 'depreciation-register',
            exportTitle: 'Ведомость начисления амортизации',
            emptyTitle: 'Амортизация ещё не начислялась',
            emptyText: 'Начислите её за нужный месяц из реестра основных средств',
            onRow: function (d) {
              const asset = App.Store.get('fixedAssets', d.assetId);
              if (asset) assetCard(asset);
            },
            totals: {
              amount: function (list) { return U.money(U.sum(list, function (d) { return money(d.amount); }), { digits: 0 }); }
            }
          })]
        })])
      ]
    });
  }

  /* --- Маршруты ------------------------------------------------------------------ */
  App.Router.add('assets', { title: 'Основные средства', module: 'assets', render: assets });
  App.Router.add('depreciation', { title: 'Амортизация', module: 'assets', render: depreciation });

  App.Assets = { card: assetCard, edit: editAsset, accrue: accrueModal, dispose: disposeAsset };
})(window.App);

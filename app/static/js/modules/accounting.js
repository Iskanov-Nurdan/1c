/* =============================================================================
   МОДУЛЬ: Бухгалтерский учёт · Налоги · Автопроверка ошибок
   ТЗ п. 5, 14, 20
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* --- Обороты по счёту ------------------------------------------------------ */
  function turnovers(from, to) {
    const map = {};
    const acc = function (code) {
      return map[code] = map[code] || { code: code, name: H.accountName(code), debit: 0, credit: 0 };
    };
    App.Store.all('entries').forEach(function (e) {
      if (from && e.date < from) return;
      if (to && e.date > to) return;
      acc(e.debit).debit += e.amount;
      acc(e.credit).credit += e.amount;
    });
    return Object.keys(map).map(function (k) {
      const r = map[k];
      r.balance = r.debit - r.credit;
      return r;
    }).sort(function (a, b) { return a.code.localeCompare(b.code, 'ru', { numeric: true }); });
  }

  /* =========================================================================
     ПЛАН СЧЕТОВ / ОБОРОТНО-САЛЬДОВАЯ ВЕДОМОСТЬ
     ====================================================================== */
  function chart() {
    const t = turnovers();
    const accounts = App.Store.all('accounts').map(function (a) {
      const tv = t.filter(function (x) { return x.code === a.code; })[0] || { debit: 0, credit: 0, balance: 0 };
      return Object.assign({}, a, { debit: tv.debit, credit: tv.credit, balance: tv.balance });
    });

    const KINDS = { A: 'Активный', P: 'Пассивный', AP: 'Активно-пассивный' };

    return UI.page({
      title: 'План счетов',
      subtitle: 'Оборотно-сальдовая ведомость по всем счетам бухгалтерского учёта',
      actions: [
        App.Auth.canEdit('accounting') ? UI.btn('Добавить счёт', { kind: 'primary', icon: 'plus', onClick: function () { editAccount(null); } }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Счетов в плане', value: accounts.length, icon: 'book', tone: 'info' },
          { label: 'Оборот по дебету', value: U.moneyShort(U.sum(accounts, function (a) { return a.debit; })), icon: 'arrowDown', tone: 'ok' },
          { label: 'Оборот по кредиту', value: U.moneyShort(U.sum(accounts, function (a) { return a.credit; })), icon: 'arrowUp', tone: 'warn' },
          { label: 'Проводок в базе', value: App.Store.all('entries').length, icon: 'calc', tone: 'violet' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          title: 'Оборотно-сальдовая ведомость',
          flush: true,
          body: [UI.table({
            search: ['code', 'name'],
            searchPlaceholder: 'Поиск по коду или названию счёта…',
            filters: [{ k: 'kind', t: 'Вид', options: [{ v: 'A', t: 'Активные' }, { v: 'P', t: 'Пассивные' }, { v: 'AP', t: 'Активно-пассивные' }] }],
            columns: [
              { k: 'code', t: 'Счёт', w: '90px', render: function (a) { return el('span.mono.strong', { text: a.code }); } },
              { k: 'name', t: 'Наименование' },
              { k: 'kind', t: 'Вид', w: '160px', render: function (a) { return KINDS[a.kind] || a.kind; } },
              { k: 'debit', t: 'Оборот Дт', num: true, render: function (a) { return a.debit ? U.money(a.debit, { digits: 0 }) : '—'; } },
              { k: 'credit', t: 'Оборот Кт', num: true, render: function (a) { return a.credit ? U.money(a.credit, { digits: 0 }) : '—'; } },
              { k: 'balance', t: 'Сальдо', num: true, render: function (a) { return a.balance ? H.moneyCell(a.balance, { colorize: true, digits: 0 }) : '—'; } },
              { id: 'act', t: '', w: '60px', sortable: false, render: function (a) {
                return UI.rowActions([{ icon: 'eye', title: 'Проводки по счёту', onClick: function () { accountCard(a); } }]);
              } }
            ],
            rows: accounts,
            pageSize: 20,
            exportName: 'chart-of-accounts.csv',
            onRow: accountCard,
            totals: {
              debit: function (rows) { return U.money(U.sum(rows, function (r) { return r.debit; }), { digits: 0 }); },
              credit: function (rows) { return U.money(U.sum(rows, function (r) { return r.credit; }), { digits: 0 }); },
              balance: function (rows) { return U.money(U.sum(rows, function (r) { return r.balance; }), { digits: 0 }); }
            }
          })]
        })])
      ]
    });
  }

  function accountCard(a) {
    const rows = App.Store.all('entries').filter(function (e) { return e.debit === a.code || e.credit === a.code; });
    UI.modal({
      title: 'Счёт ' + a.code + ' — ' + a.name,
      size: 'xl',
      body: [
        UI.statGrid([
          { label: 'Оборот по дебету', value: U.moneyShort(U.sum(rows.filter(function (e) { return e.debit === a.code; }), function (e) { return e.amount; })), tone: 'ok' },
          { label: 'Оборот по кредиту', value: U.moneyShort(U.sum(rows.filter(function (e) { return e.credit === a.code; }), function (e) { return e.amount; })), tone: 'warn' },
          { label: 'Проводок', value: rows.length, tone: 'info' }
        ], 3),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'date', t: 'Дата', w: '110px', render: function (e) { return U.fmtDate(e.date); } },
            { k: 'number', t: '№', w: '70px' },
            { k: 'content', t: 'Содержание операции' },
            { k: 'debit', t: 'Дт', w: '70px', render: function (e) { return el('span.mono', { text: e.debit }); } },
            { k: 'credit', t: 'Кт', w: '70px', render: function (e) { return el('span.mono', { text: e.credit }); } },
            { k: 'amount', t: 'Сумма', num: true, render: function (e) { return U.money(e.amount, { digits: 0 }); } }
          ],
          rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 12, exportName: 'account-' + a.code + '.csv'
        })])
      ]
    });
  }

  function editAccount(a) {
    UI.formModal({
      title: a ? 'Счёт ' + a.code : 'Новый счёт',
      values: a || { kind: 'A' },
      fields: [
        { k: 'code', t: 'Код счёта', required: true, col: 4, placeholder: '10.1' },
        { k: 'name', t: 'Наименование', required: true, col: 8 },
        { k: 'kind', t: 'Вид счёта', type: 'select', col: 6, empty: false, options: [
          { v: 'A', t: 'Активный' }, { v: 'P', t: 'Пассивный' }, { v: 'AP', t: 'Активно-пассивный' }
        ] },
        { k: 'parent', t: 'Родительский счёт', type: 'select', col: 6, options: H.accountOptions() }
      ],
      onSave: function (v) {
        if (a) App.Store.update('accounts', a.id, v);
        else App.Store.insert('accounts', v);
        UI.toast({ kind: 'ok', title: 'Счёт сохранён' });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ПРОВОДКИ
     ====================================================================== */
  function entries() {
    const canEdit = App.Auth.canEdit('accounting');
    const rows = App.Store.all('entries');
    const closed = App.Store.all('periods').filter(function (p) { return p.closed; }).map(function (p) { return p.key; });

    const tbl = UI.table({
      search: ['number', 'content', 'debit', 'credit'],
      searchPlaceholder: 'Поиск по содержанию, счёту, номеру…',
      filters: [
        { k: 'posted', t: 'Проведение', options: [{ v: 'yes', t: 'проведённые' }, { v: 'no', t: 'непроведённые' }],
          test: function (r, v) { return v === 'yes' ? !!r.posted : !r.posted; } },
        { k: 'auto', t: 'Источник', options: [{ v: 'yes', t: 'автоматические' }, { v: 'no', t: 'ручные' }],
          test: function (r, v) { return v === 'yes' ? !!r.auto : !r.auto; } }
      ],
      columns: [
        { k: 'date', t: 'Дата', w: '110px', render: function (e) { return U.fmtDate(e.date); } },
        { k: 'number', t: '№', w: '70px' },
        { k: 'content', t: 'Содержание операции' },
        { k: 'debit', t: 'Дебет', w: '160px', render: function (e) {
          return el('div', null, [el('span.mono.strong', { text: e.debit }), el('div.fs-xs.muted-2.truncate', { text: H.accountName(e.debit) })]);
        } },
        { k: 'credit', t: 'Кредит', w: '160px', render: function (e) {
          return el('div', null, [el('span.mono.strong', { text: e.credit }), el('div.fs-xs.muted-2.truncate', { text: H.accountName(e.credit) })]);
        } },
        { k: 'amount', t: 'Сумма', num: true, render: function (e) { return U.money(e.amount, { digits: 0 }); } },
        { k: 'auto', t: 'Источник', w: '110px', render: function (e) { return e.auto ? UI.badge('авто', 'info') : UI.badge('вручную', ''); } },
        { k: 'posted', t: 'Статус', w: '120px', render: function (e) { return e.posted ? UI.badge('проведена', 'ok') : UI.badge('черновик', 'warn'); } },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (e) {
          const isClosed = closed.indexOf(U.ym(e.date)) > -1;
          return UI.rowActions([
            canEdit && !isClosed ? { icon: 'edit', title: 'Изменить', onClick: function () { editEntry(e); } } : null,
            canEdit && !e.posted ? { icon: 'check', title: 'Провести', onClick: function () {
              App.Store.update('entries', e.id, { posted: true });
              UI.toast({ kind: 'ok', title: 'Проводка проведена' });
              App.Router.render();
            } } : null,
            canEdit && !isClosed ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
              UI.confirm({ title: 'Удалить проводку?', danger: true, text: 'Проводка №' + e.number + ' будет удалена.',
                onOk: function () { App.Store.remove('entries', e.id); UI.toast({ kind: 'ok', title: 'Проводка удалена' }); App.Router.render(); } });
            } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'date', dir: 'desc' },
      pageSize: 20,
      exportName: 'entries.csv',
      rowClass: function (e) { return !e.posted ? '' : ''; }
    });

    const dt = U.sum(rows, function (e) { return e.amount; });

    return UI.page({
      title: 'Бухгалтерские проводки',
      subtitle: 'Двойная запись, автоматическое формирование, контроль корректности',
      actions: [
        canEdit ? UI.btn('Новая проводка', { kind: 'primary', icon: 'plus', onClick: function () { editEntry(null); } }) : null,
        canEdit ? UI.btn('Провести все черновики', { icon: 'check', onClick: postAll }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Всего проводок', value: rows.length, icon: 'calc', tone: 'info' },
          { label: 'Сумма оборотов', value: U.moneyShort(dt), icon: 'scale', tone: 'violet' },
          { label: 'Автоматических', value: rows.filter(function (e) { return e.auto; }).length, icon: 'zap', tone: 'ok',
            meta: U.pct(rows.length ? rows.filter(function (e) { return e.auto; }).length / rows.length * 100 : 0, 0) + ' от общего числа' },
          { label: 'Непроведённых', value: rows.filter(function (e) { return !e.posted; }).length, icon: 'alert', tone: 'warn' }
        ], 4),
        el('div.mt-4', null, [UI.card({ title: 'Журнал проводок', flush: true, body: [tbl] })])
      ]
    });
  }

  function editEntry(e) {
    UI.formModal({
      title: e ? 'Проводка №' + e.number : 'Новая проводка',
      values: e || { date: U.today(), posted: false, auto: false, number: String(App.Store.all('entries').length + 1) },
      fields: [
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', required: true, col: 4 },
        { k: 'debit', t: 'Счёт дебета', type: 'select', options: H.accountOptions(), required: true, col: 6 },
        { k: 'credit', t: 'Счёт кредита', type: 'select', options: H.accountOptions(), required: true, col: 6,
          validate: function (v, all) { return v === all.debit ? 'Дебет и кредит не могут совпадать' : ''; } },
        { k: 'content', t: 'Содержание операции', type: 'textarea', required: true, col: 12 },
        { k: 'posted', t: 'Провести сразу', type: 'checkbox', col: 6 }
      ],
      onSave: function (v) {
        if (e) App.Store.update('entries', e.id, v);
        else App.Store.insert('entries', v);
        UI.toast({ kind: 'ok', title: 'Проводка сохранена' });
        App.Router.render();
      }
    });
  }

  function postAll() {
    const drafts = App.Store.all('entries').filter(function (e) { return !e.posted; });
    if (!drafts.length) return UI.toast({ kind: 'warn', title: 'Черновиков нет' });
    UI.confirm({
      title: 'Провести все черновики?',
      text: 'Будет проведено ' + drafts.length + ' проводок. Операция записывается в журнал аудита.',
      onOk: function () {
        drafts.forEach(function (e) { App.Store.update('entries', e.id, { posted: true }, { silent: true }); });
        App.Store.emit('entries');
        App.Store.persist();
        App.Store.logAction('провёл ' + drafts.length + ' проводок', 'entries', null);
        UI.toast({ kind: 'ok', title: 'Проводки проведены', text: drafts.length + ' шт.' });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ЖУРНАЛ ОПЕРАЦИЙ (все хозяйственные операции в одной ленте)
     ====================================================================== */
  function journal() {
    const ops = [];
    App.Store.all('sales').forEach(function (s) {
      ops.push({ date: s.date, kind: 'Продажа', number: s.number, party: H.cpName(s.counterpartyId), amount: s.amount, dir: 'in', status: s.status, link: 'sales' });
    });
    App.Store.all('purchaseOrders').forEach(function (o) {
      ops.push({ date: o.date, kind: 'Закупка', number: o.number, party: H.cpName(o.supplierId), amount: -o.amount, dir: 'out', status: o.status, link: 'purchases' });
    });
    App.Store.all('cashOrders').forEach(function (c) {
      ops.push({ date: c.date, kind: c.kind === 'in' ? 'Приход в кассу' : 'Расход из кассы', number: c.number, party: c.person, amount: c.kind === 'in' ? c.amount : -c.amount, dir: c.kind, status: c.status, link: 'cash' });
    });
    App.Store.all('payments').forEach(function (p) {
      ops.push({ date: p.date, kind: p.kind === 'in' ? 'Поступление на счёт' : 'Списание со счёта', number: p.number, party: H.cpName(p.counterpartyId), amount: p.kind === 'in' ? p.amount : -p.amount, dir: p.kind, status: p.status, link: 'payments' });
    });
    App.Store.all('stockMoves').forEach(function (m) {
      ops.push({ date: m.date, kind: { in: 'Поступление товара', out: 'Отгрузка товара', move: 'Перемещение', writeoff: 'Списание' }[m.type], number: m.number, party: m.productName, amount: 0, dir: m.type, status: 'posted', link: 'moves' });
    });

    return UI.page({
      title: 'Журнал операций',
      subtitle: 'Единая хронологическая лента всех хозяйственных операций',
      children: [
        UI.card({
          flush: true,
          body: [UI.table({
            search: ['number', 'party', 'kind'],
            searchPlaceholder: 'Поиск по операции, контрагенту, номеру…',
            filters: [{ k: 'kind', t: 'Вид операции', options: U.uniq(ops.map(function (o) { return o.kind; })).map(function (k) { return { v: k, t: k }; }) }],
            columns: [
              { k: 'date', t: 'Дата', w: '110px', render: function (o) { return U.fmtDate(o.date); } },
              { k: 'kind', t: 'Операция', w: '190px' },
              { k: 'number', t: '№', w: '110px' },
              { k: 'party', t: 'Контрагент / объект' },
              { k: 'amount', t: 'Сумма', num: true, render: function (o) { return o.amount ? H.moneyCell(o.amount, { colorize: true, digits: 0 }) : '—'; } },
              { k: 'status', t: 'Статус', w: '130px', render: function (o) { return UI.status(o.status); } },
              { id: 'act', t: '', w: '60px', sortable: false, render: function (o) {
                return UI.rowActions([{ icon: 'arrowRight', title: 'Перейти в раздел', onClick: function () { App.Router.go(o.link); } }]);
              } }
            ],
            rows: U.sortBy(ops, function (o) { return o.date; }, 'desc'),
            pageSize: 25,
            exportName: 'journal.csv'
          })]
        })
      ]
    });
  }

  /* =========================================================================
     ЗАКРЫТИЕ ПЕРИОДА
     ====================================================================== */
  function periods() {
    const rows = App.Store.all('periods').slice().sort(function (a, b) { return b.key.localeCompare(a.key); });
    const canClose = App.Auth.canClosePeriod();
    const open = rows.filter(function (p) { return !p.closed; });

    return UI.page({
      title: 'Закрытие периода',
      subtitle: 'Контроль полноты учёта и блокировка изменений в закрытых месяцах',
      children: [
        UI.statGrid([
          { label: 'Закрытых периодов', value: rows.filter(function (p) { return p.closed; }).length, icon: 'lock', tone: 'ok' },
          { label: 'Открытых периодов', value: open.length, icon: 'clock', tone: 'warn' },
          { label: 'Последний закрытый', value: (rows.filter(function (p) { return p.closed; })[0] || {}).name || '—', icon: 'calendar', tone: 'info' },
          { label: 'Прибыль за 12 мес.', value: U.moneyShort(U.sum(rows.slice(0, 12), function (p) { return p.revenue - p.expense; })), icon: 'chart', tone: 'violet' }
        ], 4),

        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'name', t: 'Период', w: '180px' },
              { k: 'revenue', t: 'Доходы', num: true, render: function (p) { return U.money(p.revenue, { digits: 0 }); } },
              { k: 'expense', t: 'Расходы', num: true, render: function (p) { return U.money(p.expense, { digits: 0 }); } },
              { id: 'profit', t: 'Прибыль', num: true, sort: function (p) { return p.revenue - p.expense; },
                render: function (p) { return H.moneyCell(p.revenue - p.expense, { colorize: true, digits: 0 }); } },
              { k: 'closed', t: 'Статус', w: '150px', render: function (p) { return p.closed ? UI.badge('закрыт', 'ok') : UI.badge('открыт', 'warn'); } },
              { k: 'closedBy', t: 'Кто закрыл', w: '180px', render: function (p) { return p.closed ? p.closedBy + ' · ' + U.fmtDate(p.closedAt) : '—'; } },
              { id: 'act', t: '', w: '150px', sortable: false, render: function (p) {
                if (!canClose) return el('span.muted-2.fs-sm', { text: 'нет прав' });
                return p.closed
                  ? UI.btn('Открыть', { size: 'sm', kind: 'ghost', icon: 'key', onClick: function () { reopen(p); } })
                  : UI.btn('Закрыть месяц', { size: 'sm', kind: 'primary', icon: 'lock', onClick: function () { closePeriod(p); } });
              } }
            ],
            rows: rows, pageSize: 14, exportName: 'periods.csv'
          })]
        })]),

        el('div.mt-4', null, [UI.card({
          title: 'Регламент закрытия месяца',
          body: [el('ol', { style: { paddingLeft: '20px', lineHeight: '2' } }, [
            el('li', { text: 'Проверка полноты первичных документов и наличия сканов' }),
            el('li', { text: 'Сверка расчётов с контрагентами (акты сверки)' }),
            el('li', { text: 'Начисление амортизации и заработной платы' }),
            el('li', { text: 'Расчёт налогов (НДС, налог с продаж, подоходный)' }),
            el('li', { text: 'Определение финансового результата (счета 90, 91, 99)' }),
            el('li', { text: 'Автоматическая проверка ошибок и блокировка периода' })
          ])]
        })])
      ]
    });
  }

  function closePeriod(p) {
    const issues = H.runChecks().filter(function (i) { return i.level === 'error'; });
    UI.modal({
      title: 'Закрытие периода · ' + p.name,
      size: 'lg',
      body: [
        issues.length
          ? el('div.alert.alert--danger', null, [App.Icons.get('alert'),
            el('div', null, [
              el('strong', { text: 'Обнаружено ' + issues.length + ' критичных ошибок. ' }),
              'Рекомендуется исправить их до закрытия периода.'
            ])])
          : el('div.alert.alert--ok', null, [App.Icons.get('checkCircle'), 'Критичных ошибок не обнаружено — период готов к закрытию.']),
        el('div.mt-4', null, [UI.kv([
          ['Период', p.name],
          ['Доходы', U.money(p.revenue, { digits: 0 })],
          ['Расходы', U.money(p.expense, { digits: 0 })],
          ['Финансовый результат', H.moneyCell(p.revenue - p.expense, { colorize: true, digits: 0 })],
          ['Будет создано проводок', '3 (закрытие счетов 90, 91, 99)'],
          ['Закрывает', (App.Auth.user() || {}).fullName]
        ])]),
        issues.length ? el('div.mt-4', null, [
          el('h4.mb-2', { text: 'Ошибки к исправлению' }),
          el('div.list', null, issues.slice(0, 6).map(function (i) {
            return el('div.list__item', null, [
              el('div.notif__icon', null, [App.Icons.get('alert')]),
              el('div.list__main', null, [el('div.list__title', { text: i.title }), el('div.list__sub', { text: i.text })])
            ]);
          }))
        ]) : null
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Закрыть период', kind: 'primary', icon: 'lock', onClick: function () {
          App.Store.update('periods', p.id, {
            closed: true, closedBy: (App.Auth.user() || {}).fullName, closedAt: new Date().toISOString()
          });
          H.autoEntries('sale', 0, U.today(), null);
          App.Store.logAction('закрыл период ' + p.name, 'periods', p);
          H.notify({ kind: 'ok', icon: 'lock', title: 'Период закрыт', text: p.name + ' — изменения заблокированы', link: '#/periods' });
          UI.toast({ kind: 'ok', title: 'Период закрыт', text: p.name });
          App.Router.render();
        } }
      ]
    });
  }

  function reopen(p) {
    UI.confirm({
      title: 'Открыть период?', danger: true,
      text: 'Период «' + p.name + '» будет открыт для изменений. Операция фиксируется в журнале аудита.',
      okText: 'Открыть период',
      onOk: function () {
        App.Store.update('periods', p.id, { closed: false, closedBy: null, closedAt: null });
        App.Store.logAction('открыл период ' + p.name, 'periods', p);
        UI.toast({ kind: 'warn', title: 'Период открыт' });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     НАЛОГОВЫЙ УЧЁТ
     ====================================================================== */
  function taxes() {
    const rows = App.Store.all('taxes');
    const canEdit = App.Auth.canEdit('taxes');
    const overdue = rows.filter(function (t) { return t.status === 'overdue'; });
    const planned = rows.filter(function (t) { return t.status === 'planned'; });

    const byName = U.groupBy(rows, function (t) { return t.name; });
    const chartItems = Object.keys(byName).map(function (k) {
      return { name: k, value: U.sum(byName[k], function (t) { return t.amount; }) };
    });

    return UI.page({
      title: 'Налоговый учёт',
      subtitle: 'Расчёт налогов, контроль сроков уплаты и сдачи отчётности',
      actions: [canEdit ? UI.btn('Рассчитать налоги', { kind: 'primary', icon: 'calc', onClick: calcTaxes }) : null].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Начислено налогов', value: U.moneyShort(U.sum(rows, function (t) { return t.amount; })), icon: 'percent', tone: 'info' },
          { label: 'Уплачено', value: U.moneyShort(U.sum(rows.filter(function (t) { return t.status === 'paid'; }), function (t) { return t.amount; })), icon: 'checkCircle', tone: 'ok' },
          { label: 'Просрочено', value: U.moneyShort(U.sum(overdue, function (t) { return t.amount; })), icon: 'alert', tone: 'danger', meta: overdue.length + ' платежей' },
          { label: 'К уплате', value: U.moneyShort(U.sum(planned, function (t) { return t.amount; })), icon: 'clock', tone: 'warn', meta: planned.length + ' платежей' }
        ], 4),

        overdue.length ? el('div.alert.alert--danger.mt-4', null, [
          App.Icons.get('alert'),
          el('div', null, [
            el('strong', { text: 'Просрочены налоговые платежи: ' }),
            overdue.map(function (t) { return t.name + ' за ' + t.period; }).join('; ')
          ])
        ]) : null,

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Налоговые обязательства',
            flush: true,
            body: [UI.table({
              search: ['name', 'period'],
              filters: [
                { k: 'name', t: 'Налог', options: U.uniq(rows.map(function (t) { return t.name; })).map(function (n) { return { v: n, t: n }; }) },
                { k: 'status', t: 'Статус', options: UI.statusOptions(['paid', 'planned', 'overdue']) }
              ],
              columns: [
                { k: 'name', t: 'Налог', w: '170px' },
                { k: 'period', t: 'Период', w: '150px' },
                { k: 'base', t: 'База', num: true, render: function (t) { return U.money(t.base, { digits: 0 }); } },
                { k: 'rate', t: 'Ставка', num: true, render: function (t) { return U.pct(t.rate); } },
                { k: 'amount', t: 'Сумма налога', num: true, render: function (t) { return U.money(t.amount, { digits: 0 }); } },
                { k: 'dueDate', t: 'Срок уплаты', w: '130px', render: function (t) {
                  const left = U.daysLeft(t.dueDate);
                  return el('div', null, [
                    U.fmtDate(t.dueDate),
                    t.status !== 'paid' ? el('div.fs-xs', { class: left < 0 ? 'down' : 'muted-2', text: left < 0 ? 'просрочка ' + (-left) + ' дн.' : 'осталось ' + left + ' дн.' }) : null
                  ]);
                } },
                { k: 'declaration', t: 'Декларация', w: '120px', render: function (t) { return t.declaration === 'Сдана' ? UI.badge('сдана', 'ok') : UI.badge('не сдана', 'warn'); } },
                { k: 'status', t: 'Статус', w: '130px', render: function (t) { return UI.status(t.status); } },
                { id: 'act', t: '', w: '60px', sortable: false, render: function (t) {
                  if (!canEdit || t.status === 'paid') return '';
                  return UI.rowActions([{ icon: 'check', title: 'Отметить уплаченным', onClick: function () {
                    App.Store.update('taxes', t.id, { status: 'paid', declaration: 'Сдана' });
                    H.autoEntries('payOut', t.amount, U.today(), null);
                    UI.toast({ kind: 'ok', title: 'Налог уплачен', text: t.name + ' · ' + U.money(t.amount, { digits: 0 }) });
                    App.Router.render();
                  } }]);
                } }
              ],
              rows: rows,
              sort: { k: 'dueDate', dir: 'desc' },
              pageSize: 15,
              exportName: 'taxes.csv',
              rowClass: function (t) { return t.status === 'overdue' ? 'is-danger' : ''; },
              dangerRows: true
            })]
          }),
          UI.card({
            title: 'Структура налогов',
            body: [C.donut({ items: chartItems, size: 190, centerTop: U.moneyShort(U.sum(chartItems, function (i) { return i.value; })), centerBottom: 'начислено' })]
          })
        ])
      ]
    });
  }

  function calcTaxes() {
    const st = App.Store.settings();
    const m = U.lastMonths(1)[0];
    const rev = H.revenue(m.key + '-01');
    const rows = [
      { name: 'НДС', rate: st.vatRate, base: rev },
      { name: 'Налог с продаж', rate: st.salesTaxRate, base: rev },
      { name: 'Подоходный налог', rate: st.incomeTaxRate, base: U.sum(App.Store.all('payrolls').filter(function (p) { return p.periodKey === m.key; }), function (p) { return p.gross; }) }
    ];
    UI.modal({
      title: 'Расчёт налогов за ' + H.periodLabel(m.key),
      size: 'lg',
      body: [
        el('p.muted', { text: 'Расчёт выполнен по данным учёта за период. Ставки берутся из настроек системы.' }),
        UI.table({
          columns: [
            { k: 'name', t: 'Налог' },
            { k: 'base', t: 'Налоговая база', num: true, render: function (r) { return U.money(r.base, { digits: 0 }); } },
            { k: 'rate', t: 'Ставка', num: true, render: function (r) { return U.pct(r.rate); } },
            { id: 'amount', t: 'Сумма', num: true, render: function (r) { return el('strong', { text: U.money(r.base * r.rate / 100, { digits: 0 }) }); } }
          ],
          rows: rows, pageSize: 0, exportName: false, printable: false
        })
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Начислить', kind: 'primary', icon: 'check', onClick: function () {
          rows.forEach(function (r) {
            App.Store.insert('taxes', {
              name: r.name, rate: r.rate, periodKey: m.key, period: H.periodLabel(m.key),
              frequency: 'Ежемесячно', base: r.base, amount: Math.round(r.base * r.rate / 100),
              dueDate: U.iso(new Date(m.year, m.month + 1, 20)), status: 'planned', declaration: 'Не сдана'
            }, { silent: true });
          });
          App.Store.emit('taxes');
          App.Store.persist();
          UI.toast({ kind: 'ok', title: 'Налоги начислены', text: rows.length + ' обязательства' });
          App.Router.render();
        } }
      ]
    });
  }

  /* =========================================================================
     АВТОМАТИЧЕСКАЯ ПРОВЕРКА ОШИБОК
     ====================================================================== */
  function validation() {
    const issues = H.runChecks();
    const errors = issues.filter(function (i) { return i.level === 'error'; });
    const warns = issues.filter(function (i) { return i.level === 'warn'; });
    const byType = U.groupBy(issues, function (i) { return i.title; });

    const TYPES = [
      { icon: 'file', t: 'Отсутствующие документы', n: issues.filter(function (i) { return i.type === 'missing_file'; }).length },
      { icon: 'user', t: 'Неправильные реквизиты', n: issues.filter(function (i) { return i.type === 'bad_inn' || i.type === 'no_bank'; }).length },
      { icon: 'files', t: 'Двойные операции', n: issues.filter(function (i) { return i.type === 'duplicate'; }).length },
      { icon: 'scale', t: 'Несовпадение сумм', n: issues.filter(function (i) { return i.type === 'sum_mismatch' || i.type === 'overpaid'; }).length },
      { icon: 'calc', t: 'Ошибки проводок', n: issues.filter(function (i) { return ['bad_account', 'zero_amount', 'same_account'].indexOf(i.type) > -1; }).length }
    ];

    return UI.page({
      title: 'Автоматическая проверка ошибок',
      subtitle: 'Система непрерывно контролирует полноту и корректность учётных данных',
      actions: [UI.btn('Проверить заново', { kind: 'primary', icon: 'refresh', onClick: function () {
        UI.toast({ title: 'Проверка выполняется…' });
        setTimeout(function () { App.Router.render(); UI.toast({ kind: 'ok', title: 'Проверка завершена', text: 'Найдено проблем: ' + issues.length }); }, 500);
      } })],
      children: [
        UI.statGrid([
          { label: 'Критичных ошибок', value: errors.length, icon: 'xCircle', tone: 'danger' },
          { label: 'Предупреждений', value: warns.length, icon: 'alert', tone: 'warn' },
          { label: 'Проверок выполнено', value: 10, icon: 'checkCircle', tone: 'ok', meta: 'по всем разделам учёта' },
          { label: 'Индекс качества данных', value: U.pct(Math.max(0, 100 - issues.length * 0.6), 0), icon: 'target',
            tone: issues.length < 20 ? 'ok' : issues.length < 60 ? 'warn' : 'danger' }
        ], 4),

        el('div.grid.grid--4.mt-4', null, TYPES.map(function (t) {
          return UI.card({
            body: [el('div.row', null, [
              el('div.notif__icon', null, [App.Icons.get(t.icon)]),
              el('div.grow', null, [
                el('div.fs-sm.muted', { text: t.t }),
                el('div.fs-xl.strong', { text: String(t.n) })
              ])
            ])]
          });
        })),

        el('div.mt-4', null, [UI.card({
          title: 'Найденные проблемы',
          subtitle: Object.keys(byType).length + ' типов проблем',
          flush: true,
          body: [issues.length ? UI.table({
            search: ['title', 'text'],
            filters: [
              { k: 'level', t: 'Уровень', options: [{ v: 'error', t: 'ошибки' }, { v: 'warn', t: 'предупреждения' }] },
              { k: 'title', t: 'Тип', options: Object.keys(byType).map(function (k) { return { v: k, t: k }; }) }
            ],
            columns: [
              { k: 'level', t: 'Уровень', w: '150px', render: function (i) {
                return i.level === 'error' ? UI.badge('ошибка', 'danger') : UI.badge('предупреждение', 'warn');
              } },
              { k: 'title', t: 'Проблема', w: '280px' },
              { k: 'text', t: 'Описание' },
              { id: 'act', t: '', w: '60px', sortable: false, render: function (i) {
                return UI.rowActions([{ icon: 'arrowRight', title: 'Перейти к объекту', onClick: function () { window.location.hash = i.link; } }]);
              } }
            ],
            rows: issues,
            pageSize: 20,
            exportName: 'issues.csv'
          }) : UI.empty({ icon: 'checkCircle', title: 'Ошибок не найдено', text: 'Учётные данные корректны.' })]
        })])
      ]
    });
  }

  /* --- Маршруты -------------------------------------------------------------- */
  App.Router.add('chart', { title: 'План счетов', module: 'accounting', render: chart });
  App.Router.add('entries', { title: 'Проводки', module: 'accounting', render: entries });
  App.Router.add('journal', { title: 'Журнал операций', module: 'accounting', render: journal });
  App.Router.add('periods', { title: 'Закрытие периода', module: 'accounting', render: periods });
  App.Router.add('taxes', { title: 'Налоговый учёт', module: 'taxes', render: taxes });
  App.Router.add('validation', { title: 'Проверка ошибок', module: 'validation', render: validation });
})(window.App);

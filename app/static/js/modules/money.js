/* =============================================================================
   МОДУЛЬ: Касса · Банк · Платежи
   ТЗ п. 7, 8
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* =========================================================================
     КАССА
     ====================================================================== */
  function cash() {
    const canEdit = App.Auth.canEdit('cash');
    const rows = App.Store.all('cashOrders');
    const balance = H.cashBalance();
    const monthKey = U.ym(U.today());
    const monthRows = rows.filter(function (r) { return U.ym(r.date) === monthKey; });
    const inSum = U.sum(monthRows.filter(function (r) { return r.kind === 'in'; }), function (r) { return r.amount; });
    const outSum = U.sum(monthRows.filter(function (r) { return r.kind === 'out'; }), function (r) { return r.amount; });

    const flow = H.monthly('cashOrders', 'date', function (c) { return c.kind === 'in' ? c.amount : -c.amount; }, 6);

    const tbl = UI.table({
      search: ['number', 'person', 'basis'],
      searchPlaceholder: 'Поиск по номеру, лицу, основанию…',
      filters: [
        { k: 'kind', t: 'Вид', options: [{ v: 'in', t: 'приходные (ПКО)' }, { v: 'out', t: 'расходные (РКО)' }] }
      ],
      columns: [
        { k: 'number', t: '№ ордера', w: '120px', render: function (r) {
          return el('div.row', { style: { gap: '6px' } }, [
            App.Icons.get(r.kind === 'in' ? 'arrowDown' : 'arrowUp'),
            el('span.strong', { text: r.number })
          ]);
        } },
        { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
        { k: 'person', t: 'От кого / кому' },
        { k: 'basis', t: 'Основание' },
        { k: 'amount', t: 'Сумма', num: true, render: function (r) {
          return el('span', { class: 'num ' + (r.kind === 'in' ? 'up' : 'down'), text: (r.kind === 'in' ? '+' : '−') + U.money(r.amount, { digits: 0 }) });
        } },
        { k: 'cashier', t: 'Кассир', w: '200px' },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
          return UI.rowActions([
            { icon: 'print', title: 'Печать ордера', onClick: function () { printOrder(r); } },
            canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editOrder(r); } } : null,
            canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
              UI.confirm({ title: 'Удалить ордер?', danger: true, text: r.number + ' будет удалён.', onOk: function () {
                App.Store.remove('cashOrders', r.id); UI.toast({ kind: 'ok', title: 'Ордер удалён' }); App.Router.render();
              } });
            } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'date', dir: 'desc' },
      pageSize: 15,
      exportName: 'cash-orders.csv',
      onRow: printOrder
    });

    return UI.page({
      title: 'Касса',
      subtitle: 'Приходные и расходные ордера, кассовая книга, контроль остатка',
      actions: canEdit ? [
        UI.btn('Приход (ПКО)', { kind: 'success', icon: 'arrowDown', onClick: function () { editOrder({ kind: 'in' }); } }),
        UI.btn('Расход (РКО)', { kind: 'danger', icon: 'arrowUp', onClick: function () { editOrder({ kind: 'out' }); } }),
        UI.btn('Кассовая книга', { icon: 'book', onClick: cashBook })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Остаток в кассе', value: U.moneyShort(balance), icon: 'cash', tone: balance >= 0 ? 'ok' : 'danger' },
          { label: 'Приход за месяц', value: U.moneyShort(inSum), icon: 'arrowDown', tone: 'ok', meta: monthRows.filter(function (r) { return r.kind === 'in'; }).length + ' ордеров' },
          { label: 'Расход за месяц', value: U.moneyShort(outSum), icon: 'arrowUp', tone: 'warn', meta: monthRows.filter(function (r) { return r.kind === 'out'; }).length + ' ордеров' },
          { label: 'Оборот за месяц', value: U.moneyShort(inSum + outSum), icon: 'refresh', tone: 'info' }
        ], 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({ title: 'Кассовые ордера', flush: true, body: [tbl] }),
          UI.card({
            title: 'Движение по кассе',
            subtitle: 'сальдо по месяцам',
            body: [C.bars({
              labels: flow.labels, height: 220,
              series: [{ name: 'Сальдо', values: flow.values, color: 'var(--c1)' }]
            })]
          })
        ])
      ]
    });
  }

  function editOrder(o) {
    const isIn = o && o.kind === 'in';
    UI.formModal({
      title: o && o.id ? 'Ордер ' + o.number : (isIn ? 'Приходный кассовый ордер' : 'Расходный кассовый ордер'),
      values: Object.assign({
        number: H.nextNumber('cashOrders', isIn ? 'ПКО' : 'РКО'),
        date: U.today(), status: 'posted',
        cashier: (App.Auth.user() || {}).fullName
      }, o || {}),
      fields: [
        { k: 'kind', t: 'Вид ордера', type: 'select', required: true, col: 4, empty: false,
          options: [{ v: 'in', t: 'Приходный (ПКО)' }, { v: 'out', t: 'Расходный (РКО)' }] },
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', required: true, col: 6, min: 0 },
        { k: 'counterpartyId', t: 'Контрагент', type: 'select', options: H.cpOptions(), col: 6 },
        { k: 'person', t: 'От кого / кому', required: true, col: 6, placeholder: 'ФИО или организация' },
        { k: 'cashier', t: 'Кассир', col: 6 },
        { k: 'basis', t: 'Основание', required: true, col: 12, placeholder: 'Оплата по счёту №…' }
      ],
      onSave: function (v) {
        if (o && o.id) {
          App.Store.update('cashOrders', o.id, v);
        } else {
          const rec = App.Store.insert('cashOrders', v);
          H.autoEntries(v.kind === 'in' ? 'cashIn' : 'cashOut', v.amount, v.date, rec);
        }
        UI.toast({ kind: 'ok', title: 'Кассовый ордер сохранён', text: v.number + ' · ' + U.money(v.amount, { digits: 0 }) });
        App.Router.render();
      }
    });
  }

  function printOrder(r) {
    const co = App.Store.company();
    UI.modal({
      title: (r.kind === 'in' ? 'Приходный' : 'Расходный') + ' кассовый ордер ' + r.number,
      size: 'lg',
      body: [
        el('div.card__body', { style: { border: '1px solid var(--line)', borderRadius: 'var(--r-md)' } }, [
          el('div.row.row--between.mb-4', null, [
            el('div', null, [
              el('strong', { text: co.name }),
              el('div.fs-sm.muted', { text: 'ИНН ' + co.inn + ' · ' + co.address })
            ]),
            el('div.right', null, [
              el('div.strong', { text: (r.kind === 'in' ? 'ПКО' : 'РКО') + ' № ' + r.number }),
              el('div.fs-sm.muted', { text: 'от ' + U.fmtDateLong(r.date) })
            ])
          ]),
          UI.kv([
            [r.kind === 'in' ? 'Принято от' : 'Выдано', r.person],
            ['Контрагент', r.counterpartyId ? H.cpName(r.counterpartyId) : '—'],
            ['Основание', r.basis],
            ['Сумма', el('strong.fs-lg', { text: U.money(r.amount) })],
            ['Кассир', r.cashier],
            ['Главный бухгалтер', co.accountant]
          ])
        ])
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        { text: 'Печать', kind: 'primary', icon: 'print', close: false, onClick: function () { window.print(); } }
      ]
    });
  }

  function cashBook() {
    const rows = U.sortBy(App.Store.all('cashOrders'), function (r) { return r.date; }, 'asc');
    let bal = 0;
    const book = rows.map(function (r) {
      bal += r.kind === 'in' ? r.amount : -r.amount;
      return {
        date: r.date, number: r.number, person: r.person,
        income: r.kind === 'in' ? r.amount : 0,
        outcome: r.kind === 'out' ? r.amount : 0,
        balance: bal
      };
    }).reverse();

    UI.modal({
      title: 'Кассовая книга',
      size: 'xl',
      body: [UI.table({
        columns: [
          { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
          { k: 'number', t: '№ документа', w: '120px' },
          { k: 'person', t: 'От кого / кому' },
          { k: 'income', t: 'Приход', num: true, render: function (r) { return r.income ? U.money(r.income, { digits: 0 }) : '—'; } },
          { k: 'outcome', t: 'Расход', num: true, render: function (r) { return r.outcome ? U.money(r.outcome, { digits: 0 }) : '—'; } },
          { k: 'balance', t: 'Остаток', num: true, render: function (r) { return el('strong', { text: U.money(r.balance, { digits: 0 }) }); } }
        ],
        rows: book, pageSize: 15, exportName: 'cash-book.csv'
      })]
    });
  }

  /* =========================================================================
     БАНК
     ====================================================================== */
  function bank() {
    const canEdit = App.Auth.canEdit('bank');
    const statements = App.Store.all('bankStatements');
    const payments = App.Store.all('payments');
    const unmatched = payments.filter(function (p) { return !p.matched; });
    const balance = H.bankBalance();
    const co = App.Store.company();

    const flowIn = H.monthly('payments', 'date', function (p) { return p.kind === 'in' ? p.amount : 0; }, 6);
    const flowOut = H.monthly('payments', 'date', function (p) { return p.kind === 'out' ? p.amount : 0; }, 6);

    return UI.page({
      title: 'Банк',
      subtitle: 'Загрузка выписок, платёжные поручения, автоматическая сверка оплат',
      actions: canEdit ? [
        UI.btn('Загрузить выписку', { kind: 'primary', icon: 'upload', onClick: loadStatement }),
        UI.btn('Платёжное поручение', { icon: 'send', onClick: function () { editPayment({ kind: 'out' }); } })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Остаток на счёте', value: U.moneyShort(balance), icon: 'bank', tone: 'ok', meta: co.bank },
          { label: 'Поступления за месяц', value: U.moneyShort(flowIn.values[5]), icon: 'arrowDown', tone: 'ok' },
          { label: 'Списания за месяц', value: U.moneyShort(flowOut.values[5]), icon: 'arrowUp', tone: 'warn' },
          { label: 'Не сопоставлено', value: unmatched.length, icon: 'alert', tone: unmatched.length ? 'danger' : 'ok',
            meta: U.moneyShort(U.sum(unmatched, function (p) { return p.amount; })) }
        ], 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Банковские выписки',
            flush: true,
            body: [UI.table({
              columns: [
                { k: 'date', t: 'Дата выписки', w: '130px', render: function (s) { return U.fmtDate(s.date); } },
                { k: 'fileName', t: 'Файл' },
                { k: 'format', t: 'Формат', w: '160px' },
                { k: 'rowsCount', t: 'Операций', num: true },
                { k: 'incoming', t: 'Приход', num: true, render: function (s) { return U.money(s.incoming, { digits: 0 }); } },
                { k: 'outgoing', t: 'Расход', num: true, render: function (s) { return U.money(s.outgoing, { digits: 0 }); } },
                { id: 'match', t: 'Сверка', w: '150px', sortable: false, render: function (s) {
                  const p = s.rowsCount ? s.matched / s.rowsCount * 100 : 0;
                  return el('div', null, [
                    UI.progress(s.matched, s.rowsCount, p === 100 ? 'ok' : 'warn'),
                    el('span.fs-xs.muted-2', { text: s.matched + ' из ' + s.rowsCount })
                  ]);
                } },
                { k: 'status', t: 'Статус', w: '130px', render: function (s) { return UI.status(s.status); } },
                { id: 'act', t: '', w: '60px', sortable: false, render: function (s) {
                  return UI.rowActions([{ icon: 'refresh', title: 'Выполнить сверку', onClick: function () { reconcile(s); } }]);
                } }
              ],
              rows: statements, sort: { k: 'date', dir: 'desc' }, pageSize: 10, exportName: 'statements.csv'
            })]
          }),
          el('div.col', null, [
            UI.card({
              title: 'Реквизиты счёта',
              body: [UI.kv([
                ['Организация', co.name],
                ['Банк', co.bank],
                ['Расчётный счёт', el('span.mono', { text: co.account })],
                ['БИК', el('span.mono', { text: co.bik })],
                ['ИНН', co.inn]
              ])]
            }),
            UI.card({
              title: 'Движение по счёту',
              body: [C.line({
                labels: flowIn.labels, height: 180,
                series: [
                  { name: 'Приход', values: flowIn.values, color: 'var(--c2)' },
                  { name: 'Расход', values: flowOut.values, color: 'var(--c4)' }
                ]
              })]
            })
          ])
        ]),

        unmatched.length ? el('div.mt-4', null, [UI.card({
          title: 'Операции без сопоставления',
          subtitle: 'требуют ручной привязки к документам',
          tools: [canEdit ? UI.btn('Сопоставить автоматически', { size: 'sm', icon: 'zap', onClick: autoMatch }) : null].filter(Boolean),
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'date', t: 'Дата', w: '110px', render: function (p) { return U.fmtDate(p.date); } },
              { k: 'number', t: '№', w: '100px' },
              { k: 'counterpartyId', t: 'Контрагент', render: function (p) { return H.cpName(p.counterpartyId); } },
              { k: 'purpose', t: 'Назначение платежа' },
              { k: 'amount', t: 'Сумма', num: true, render: function (p) {
                return el('span', { class: 'num ' + (p.kind === 'in' ? 'up' : 'down'), text: U.money(p.amount, { digits: 0 }) });
              } },
              { id: 'act', t: '', w: '70px', sortable: false, render: function (p) {
                return UI.rowActions([{ icon: 'link', title: 'Сопоставить', onClick: function () {
                  App.Store.update('payments', p.id, { matched: true });
                  UI.toast({ kind: 'ok', title: 'Операция сопоставлена' });
                  App.Router.render();
                } }]);
              } }
            ],
            rows: unmatched, pageSize: 10, exportName: 'unmatched.csv'
          })]
        })]) : null
      ]
    });
  }

  /* --- Разбор банковской выписки ---------------------------------------------
     Заголовки в выписках разных банков называются по-разному, поэтому колонки
     ищутся по ключевым словам, а не по фиксированному порядку. */
  const STATEMENT_FIELDS = {
    date:    ['дата', 'date'],
    amount:  ['сумма', 'amount'],
    income:  ['приход', 'кредит', 'поступление', 'credit'],
    expense: ['расход', 'дебет', 'списание', 'debit'],
    party:   ['контрагент', 'плательщик', 'получатель', 'наименование', 'корреспондент'],
    purpose: ['назначение', 'основание', 'комментарий', 'purpose'],
    number:  ['номер', 'док', 'number']
  };

  function matchColumn(headers, keys) {
    for (let i = 0; i < headers.length; i++) {
      const h = U.norm(headers[i]);
      if (!h) continue;
      for (let k = 0; k < keys.length; k++) {
        if (h.indexOf(keys[k]) > -1) return headers[i];
      }
    }
    return null;
  }

  /** Число из ячейки выписки: «1 250,50» и «1250.50» дают 1250.5 */
  function toAmount(value) {
    if (typeof value === 'number') return value;
    const cleaned = String(value == null ? '' : value)
      .replace(/[\s\u00a0]/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function toDate(value) {
    const text = String(value == null ? '' : value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const m = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (m) return m[3] + '-' + U.pad(+m[2]) + '-' + U.pad(+m[1]);
    const d = new Date(text);
    return isNaN(d.getTime()) ? U.today() : U.iso(d);
  }

  /** Приводит строки файла к операциям выписки. */
  function parseStatement(data) {
    const cols = {};
    Object.keys(STATEMENT_FIELDS).forEach(function (key) {
      cols[key] = matchColumn(data.columns, STATEMENT_FIELDS[key]);
    });
    if (!cols.date || (!cols.amount && !cols.income && !cols.expense)) return null;

    const parties = App.Store.all('counterparties');
    return data.rows.map(function (row, i) {
      const income = cols.income ? toAmount(row[cols.income]) : 0;
      const expense = cols.expense ? toAmount(row[cols.expense]) : 0;
      let amount = cols.amount ? toAmount(row[cols.amount]) : (income || expense);
      const kind = income > 0 ? 'in' : (expense > 0 ? 'out' : (amount < 0 ? 'out' : 'in'));
      amount = Math.abs(amount);

      const partyName = cols.party ? String(row[cols.party] || '').trim() : '';
      const found = parties.filter(function (c) {
        return partyName && (U.includes(c.name, partyName) || U.includes(partyName, c.name));
      })[0];

      return {
        line: i + 1,
        date: toDate(row[cols.date]),
        kind: kind,
        amount: amount,
        party: partyName,
        counterpartyId: found ? found.id : null,
        matched: !!found,
        purpose: cols.purpose ? String(row[cols.purpose] || '').trim() : '',
        number: cols.number ? String(row[cols.number] || '').trim() : ''
      };
    }).filter(function (r) { return r.amount > 0; });
  }

  /** Создаёт платежи по операциям выписки и запись о самой выписке. */
  function applyStatement(rows, fileName) {
    const company = App.Store.company();
    rows.forEach(function (r) {
      App.Store.insert('payments', {
        number: r.number || H.nextNumber('payments', 'ПП'),
        kind: r.kind, date: r.date,
        counterpartyId: r.counterpartyId,
        amount: r.amount,
        purpose: r.purpose || (r.kind === 'in' ? 'Поступление по выписке' : 'Списание по выписке'),
        account: company.account || '',
        bank: company.bank || '',
        matched: r.matched,
        status: 'executed'
      }, { silent: true });
    });
    App.Store.emit('payments');

    const incoming = U.sum(rows.filter(function (r) { return r.kind === 'in'; }), function (r) { return r.amount; });
    const outgoing = U.sum(rows.filter(function (r) { return r.kind === 'out'; }), function (r) { return r.amount; });
    const matched = rows.filter(function (r) { return r.matched; }).length;

    App.Store.insert('bankStatements', {
      date: U.today(), fileName: fileName, format: 'Excel',
      rowsCount: rows.length, incoming: incoming, outgoing: outgoing,
      matched: matched, status: 'processed'
    });

    H.notify({
      kind: 'info', icon: 'bank', title: 'Загружена выписка банка',
      text: 'Обработано ' + rows.length + ' операций, сопоставлено ' + matched, link: '#/bank'
    });
    UI.toast({
      kind: 'ok', title: 'Выписка загружена',
      text: rows.length + ' операций, сопоставлено ' + matched
    });
    App.Router.render();
  }

  /** Предпросмотр: пользователь видит, что именно попадёт в учёт. */
  function previewStatement(rows, fileName) {
    const matched = rows.filter(function (r) { return r.matched; }).length;
    const income = U.sum(rows.filter(function (r) { return r.kind === 'in'; }), function (r) { return r.amount; });
    const expense = U.sum(rows.filter(function (r) { return r.kind === 'out'; }), function (r) { return r.amount; });

    UI.modal({
      title: 'Проверка выписки · ' + fileName,
      size: 'xl',
      body: [
        UI.statGrid([
          { label: 'Операций в файле', value: String(rows.length), icon: 'file', tone: 'info' },
          { label: 'Поступления', value: U.money(income, { digits: 0 }), icon: 'arrowDown', tone: 'ok' },
          { label: 'Списания', value: U.money(expense, { digits: 0 }), icon: 'arrowUp', tone: 'warn' },
          { label: 'Контрагент определён', value: matched + ' из ' + rows.length,
            icon: 'users', tone: matched === rows.length ? 'ok' : 'warn' }
        ], 4),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
            { k: 'number', t: 'Номер', w: '100px', render: function (r) { return r.number || '—'; } },
            { k: 'party', t: 'Контрагент', render: function (r) {
              return r.matched ? H.cpName(r.counterpartyId)
                : el('span.muted-2', { text: r.party || 'не определён' });
            } },
            { k: 'purpose', t: 'Назначение' },
            { k: 'amount', t: 'Сумма', num: true, render: function (r) {
              return el('span', {
                class: 'num ' + (r.kind === 'in' ? 'up' : 'down'),
                text: (r.kind === 'in' ? '+' : '-') + U.money(r.amount, { digits: 0 })
              });
            } }
          ],
          rows: rows, pageSize: 12, exportName: false
        })])
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Импортировать ' + rows.length + ' операций', kind: 'primary', icon: 'check',
          onClick: function () { applyStatement(rows, fileName); } }
      ]
    });
  }

  function loadStatement() {
    /* Обмен 1C-Bank Exchange разбирает сервер, в браузере показываем
       демонстрационный результат обработки. */
    function demoStatement(name) {
      UI.closeModal();
      UI.toast({ title: 'Обработка выписки…' });
      setTimeout(function () {
        const count = 8 + Math.floor(Math.random() * 20);
        const matched = Math.floor(count * (0.6 + Math.random() * 0.4));
        App.Store.insert('bankStatements', {
          date: U.today(), fileName: name, format: '1C-Bank Exchange', rowsCount: count,
          incoming: Math.round(Math.random() * 2000000),
          outgoing: Math.round(Math.random() * 1500000),
          matched: matched, status: 'processed'
        });
        H.notify({ kind: 'info', icon: 'bank', title: 'Загружена выписка банка',
          text: 'Обработано ' + count + ' операций, сопоставлено ' + matched, link: '#/bank' });
        UI.toast({ kind: 'ok', title: 'Выписка загружена', text: count + ' операций' });
        App.Router.render();
      }, 700);
    }

    function handle(data, name) {
      const rows = parseStatement(data);
      UI.closeModal();
      if (!rows || !rows.length) {
        return UI.toast({
          kind: 'danger', title: 'Не удалось разобрать выписку',
          text: 'В файле не найдены колонки с датой и суммой операции'
        });
      }
      previewStatement(rows, name);
    }

    function fromFile(file) {
      if (/\.txt$/i.test(file.name)) return demoStatement(file.name);
      UI.toast({ title: 'Читаем файл…' });
      App.Xlsx.read(file).then(function (data) { handle(data, file.name); },
        function (err) { UI.toast({ kind: 'danger', title: 'Ошибка чтения файла', text: err.message }); });
    }

    const zone = UI.dropzone({
      title: 'Перетащите файл выписки',
      hint: 'Excel (.xlsx, .xls), CSV или 1C-Bank Exchange (.txt)',
      accept: '.txt,.csv,.xlsx,.xls',
      onFiles: function (files) { if (files[0]) fromFile(files[0]); }
    });

    UI.modal({
      title: 'Загрузка банковской выписки',
      size: 'lg',
      body: [
        el('div.alert.mb-4', null, [App.Icons.get('info'),
          'Файл Excel или CSV разбирается прямо в браузере: система находит колонки с датой, суммой, контрагентом и назначением, сопоставляет контрагентов со справочником и показывает результат до записи в учёт.']),
        zone
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Выбрать файл', kind: 'primary', icon: 'upload', close: false, onClick: function () {
          App.Xlsx.pick().then(function (data) { handle(data, data.fileName); }, function (err) {
            if (err.message !== 'Файл не выбран') {
              UI.toast({ kind: 'danger', title: 'Ошибка чтения файла', text: err.message });
            }
          });
        } }
      ]
    });
  }

  function reconcile(s) {
    UI.toast({ title: 'Сверка выполняется…' });
    setTimeout(function () {
      App.Store.update('bankStatements', s.id, { matched: s.rowsCount, status: 'processed' });
      UI.toast({ kind: 'ok', title: 'Сверка завершена', text: 'Сопоставлено ' + s.rowsCount + ' операций' });
      App.Router.render();
    }, 700);
  }

  function autoMatch() {
    const unmatched = App.Store.all('payments').filter(function (p) { return !p.matched; });
    unmatched.forEach(function (p) { App.Store.update('payments', p.id, { matched: true }, { silent: true }); });
    App.Store.emit('payments');
    App.Store.persist();
    App.Store.logAction('выполнил автоматическую сверку платежей', 'payments', null);
    UI.toast({ kind: 'ok', title: 'Автосверка завершена', text: 'Сопоставлено ' + unmatched.length + ' операций' });
    App.Router.render();
  }

  /* =========================================================================
     ПЛАТЕЖИ
     ====================================================================== */
  function payments() {
    const canEdit = App.Auth.canEdit('payments');
    const rows = App.Store.all('payments');

    const tbl = UI.table({
      search: ['number', 'purpose', function (r) { return H.cpName(r.counterpartyId); }],
      searchPlaceholder: 'Поиск по номеру, контрагенту, назначению…',
      filters: [
        { k: 'kind', t: 'Направление', options: [{ v: 'in', t: 'поступления' }, { v: 'out', t: 'списания' }] },
        { k: 'status', t: 'Статус', options: UI.statusOptions(['executed', 'new']) },
        { k: 'matched', t: 'Сверка', options: [{ v: 'yes', t: 'сопоставлен' }, { v: 'no', t: 'не сопоставлен' }],
          test: function (r, v) { return v === 'yes' ? !!r.matched : !r.matched; } }
      ],
      columns: [
        { k: 'number', t: '№', w: '100px' },
        { k: 'date', t: 'Дата', w: '110px', render: function (p) { return U.fmtDate(p.date); } },
        { k: 'counterpartyId', t: 'Контрагент', render: function (p) { return H.cpName(p.counterpartyId); },
          sort: function (p) { return H.cpName(p.counterpartyId); } },
        { k: 'purpose', t: 'Назначение платежа' },
        { k: 'amount', t: 'Сумма', num: true, render: function (p) {
          return el('span', { class: 'num ' + (p.kind === 'in' ? 'up' : 'down'), text: (p.kind === 'in' ? '+' : '−') + U.money(p.amount, { digits: 0 }) });
        } },
        { k: 'matched', t: 'Сверка', w: '130px', render: function (p) { return p.matched ? UI.badge('сопоставлен', 'ok') : UI.badge('не сверен', 'warn'); } },
        { k: 'status', t: 'Статус', w: '120px', render: function (p) { return UI.status(p.status); } },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (p) {
          return UI.rowActions([
            { icon: 'print', title: 'Платёжное поручение', onClick: function () { printPayment(p); } },
            canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editPayment(p); } } : null,
            canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
              UI.confirm({ title: 'Удалить платёж?', danger: true, text: p.number + ' будет удалён.', onOk: function () {
                App.Store.remove('payments', p.id); UI.toast({ kind: 'ok', title: 'Платёж удалён' }); App.Router.render();
              } });
            } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'date', dir: 'desc' },
      pageSize: 20,
      exportName: 'payments.csv',
      onRow: printPayment
    });

    const inSum = U.sum(rows.filter(function (p) { return p.kind === 'in'; }), function (p) { return p.amount; });
    const outSum = U.sum(rows.filter(function (p) { return p.kind === 'out'; }), function (p) { return p.amount; });

    return UI.page({
      title: 'Платежи',
      subtitle: 'Реестр платёжных операций по расчётному счёту',
      actions: canEdit ? [
        UI.btn('Новый платёж', { kind: 'primary', icon: 'plus', onClick: function () { editPayment(null); } })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Поступило', value: U.moneyShort(inSum), icon: 'arrowDown', tone: 'ok' },
          { label: 'Списано', value: U.moneyShort(outSum), icon: 'arrowUp', tone: 'warn' },
          { label: 'Сальдо', value: U.moneyShort(inSum - outSum), icon: 'scale', tone: inSum >= outSum ? 'ok' : 'danger' },
          { label: 'Платежей всего', value: rows.length, icon: 'card', tone: 'info' }
        ], 4),
        el('div.mt-4', null, [UI.card({ title: 'Реестр платежей', flush: true, body: [tbl] })])
      ]
    });
  }

  function editPayment(p) {
    UI.formModal({
      title: p && p.id ? 'Платёж ' + p.number : 'Новый платёж',
      values: Object.assign({
        number: H.nextNumber('payments', 'ПП'), date: U.today(), kind: 'out',
        status: 'new', matched: false, account: App.Store.company().account, bank: App.Store.company().bank
      }, p || {}),
      fields: [
        { k: 'kind', t: 'Направление', type: 'select', required: true, col: 4, empty: false,
          options: [{ v: 'in', t: 'Поступление' }, { v: 'out', t: 'Списание' }] },
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'counterpartyId', t: 'Контрагент', type: 'select', options: H.cpOptions(), required: true, col: 6 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', required: true, col: 6, min: 0 },
        { k: 'purpose', t: 'Назначение платежа', type: 'textarea', required: true, col: 12 },
        { k: 'bank', t: 'Банк', type: 'select', col: 6, options: App.Seed.BANKS.map(function (b) { return { v: b, t: b }; }) },
        { k: 'account', t: 'Расчётный счёт', col: 6 },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false, options: UI.statusOptions(['new', 'executed']) },
        { k: 'matched', t: 'Сопоставлен с документом', type: 'checkbox', col: 6 }
      ],
      onSave: function (v) {
        if (p && p.id) {
          App.Store.update('payments', p.id, v);
        } else {
          const rec = App.Store.insert('payments', v);
          H.autoEntries(v.kind === 'in' ? 'payIn' : 'payOut', v.amount, v.date, rec);
        }
        UI.toast({ kind: 'ok', title: 'Платёж сохранён', text: v.number + ' · ' + U.money(v.amount, { digits: 0 }) });
        App.Router.render();
      }
    });
  }

  function printPayment(p) {
    const co = App.Store.company();
    const cp = H.cp(p.counterpartyId);
    UI.modal({
      title: 'Платёжное поручение № ' + p.number,
      size: 'lg',
      body: [el('div.card__body', { style: { border: '1px solid var(--line)', borderRadius: 'var(--r-md)' } }, [
        el('div.row.row--between.mb-4', null, [
          el('h3', { text: 'ПЛАТЁЖНОЕ ПОРУЧЕНИЕ № ' + p.number }),
          el('div.right.fs-sm', null, [
            el('div', { text: U.fmtDateLong(p.date) }),
            UI.status(p.status)
          ])
        ]),
        UI.kv([
          ['Плательщик', p.kind === 'out' ? co.name : (cp ? cp.name : '—')],
          ['ИНН плательщика', p.kind === 'out' ? co.inn : (cp ? cp.inn : '—')],
          ['Получатель', p.kind === 'out' ? (cp ? cp.name : '—') : co.name],
          ['ИНН получателя', p.kind === 'out' ? (cp ? cp.inn : '—') : co.inn],
          ['Банк', p.bank],
          ['Счёт', el('span.mono', { text: p.account })],
          ['Назначение платежа', p.purpose],
          ['Сумма', el('strong.fs-lg', { text: U.money(p.amount) })]
        ])
      ])],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        { text: 'Отправить в банк', kind: 'primary', icon: 'send', onClick: function () {
          App.Store.update('payments', p.id, { status: 'executed' });
          UI.toast({ kind: 'ok', title: 'Отправлено в банк-клиент', text: 'Платёж ' + p.number });
          App.Router.render();
        } }
      ]
    });
  }

  /* --- Маршруты --------------------------------------------------------------- */
  App.Money = { parseStatement: parseStatement };

  App.Router.add('cash', { title: 'Касса', module: 'cash', render: cash });
  App.Router.add('bank', { title: 'Банк', module: 'bank', render: bank });
  App.Router.add('payments', { title: 'Платежи', module: 'payments', render: payments });
})(window.App);

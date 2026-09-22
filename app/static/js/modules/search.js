/* =============================================================================
   РАСШИРЕННЫЙ ПОИСК (ТЗ п. 5)
   Единый поиск по номеру документа, дате, организации, контрагенту, сумме
   и типу документа. Ищет сразу по всем журналам: документы, договоры,
   реализации, заказы поставщикам, платежи, кассовые ордера и проводки.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, el = U.el;

  /* Источники поиска: где ищем, как показываем и куда ведёт строка.
     `module` — раздел, права на который нужны, чтобы источник участвовал в поиске. */
  const SOURCES = [
    {
      key: 'documents', title: 'Документы', icon: 'files', module: 'documents',
      rows: function () {
        return App.Store.all('documents').map(function (d) {
          return {
            id: d.id, kind: 'documents', type: d.typeName || 'Документ', docType: d.type,
            number: d.number, date: d.date, counterpartyId: d.counterpartyId,
            amount: Number(d.amount) || 0, status: d.status,
            text: [d.number, d.typeName, d.ocrText].join(' '),
            open: function () { App.Docs.openDoc(d.id); }
          };
        });
      }
    },
    {
      key: 'contracts', title: 'Договоры', icon: 'contract', module: 'contracts',
      rows: function () {
        return App.Store.all('contracts').map(function (c) {
          return {
            id: c.id, kind: 'contracts', type: 'Договор', number: c.number, date: c.date,
            counterpartyId: c.counterpartyId, amount: Number(c.amount) || 0, status: c.status,
            text: [c.number, c.subject].join(' '),
            open: function () { App.Router.go('contracts'); }
          };
        });
      }
    },
    {
      key: 'sales', title: 'Реализации', icon: 'cart', module: 'sales',
      rows: function () {
        return App.Store.all('sales').map(function (s) {
          return {
            id: s.id, kind: 'sales', type: 'Реализация', number: s.number, date: s.date,
            counterpartyId: s.counterpartyId, amount: Number(s.amount) || 0, status: s.status,
            text: [s.number, s.manager].join(' '),
            open: function () { App.Router.go('sales'); }
          };
        });
      }
    },
    {
      key: 'purchases', title: 'Заказы поставщикам', icon: 'truck', module: 'purchases',
      rows: function () {
        return App.Store.all('purchaseOrders').map(function (o) {
          return {
            id: o.id, kind: 'purchases', type: 'Заказ поставщику', number: o.number, date: o.date,
            counterpartyId: o.supplierId, amount: Number(o.amount) || 0, status: o.status,
            text: [o.number, o.manager].join(' '),
            open: function () { App.Router.go('purchases'); }
          };
        });
      }
    },
    {
      key: 'payments', title: 'Платёжные поручения', icon: 'card', module: 'payments',
      rows: function () {
        return App.Store.all('payments').map(function (p) {
          return {
            id: p.id, kind: 'payments', type: 'Платёжное поручение', number: p.number, date: p.date,
            counterpartyId: p.counterpartyId, amount: Number(p.amount) || 0, status: p.status,
            text: [p.number, p.purpose].join(' '),
            open: function () { App.Router.go('payments'); }
          };
        });
      }
    },
    {
      key: 'cash', title: 'Кассовые ордера', icon: 'cash', module: 'cash',
      rows: function () {
        return App.Store.all('cashOrders').map(function (o) {
          return {
            id: o.id, kind: 'cash', type: o.kind === 'in' ? 'Приходный ордер' : 'Расходный ордер',
            number: o.number, date: o.date, counterpartyId: o.counterpartyId,
            amount: Number(o.amount) || 0, status: o.status,
            text: [o.number, o.basis, o.person].join(' '),
            open: function () { App.Router.go('cash'); }
          };
        });
      }
    },
    {
      key: 'entries', title: 'Проводки', icon: 'calc', module: 'accounting',
      rows: function () {
        return App.Store.all('entries').map(function (e) {
          return {
            id: e.id, kind: 'entries', type: 'Проводка ' + e.debit + ' / ' + e.credit,
            number: e.number, date: e.date, counterpartyId: null,
            amount: Number(e.amount) || 0, status: e.posted ? 'posted' : 'draft',
            text: [e.number, e.content, e.debit, e.credit].join(' '),
            open: function () { App.Router.go('entries'); }
          };
        });
      }
    }
  ];

  /* Текущие условия отбора — живут между перерисовками таблицы результатов. */
  const filters = {
    q: '', kind: '', docType: '', counterpartyId: '',
    dateFrom: '', dateTo: '', amountFrom: '', amountTo: ''
  };

  function availableSources() {
    return SOURCES.filter(function (s) { return App.Auth.can(s.module); });
  }

  /** Все записи доступных пользователю журналов. */
  function collect() {
    return availableSources().reduce(function (out, source) {
      return out.concat(source.rows());
    }, []);
  }

  /** Применяет условия отбора. Пустое условие не сужает выборку. */
  function apply(rows) {
    const amountFrom = filters.amountFrom === '' ? null : Number(filters.amountFrom);
    const amountTo = filters.amountTo === '' ? null : Number(filters.amountTo);

    return rows.filter(function (r) {
      if (filters.kind && r.kind !== filters.kind) return false;
      if (filters.docType && r.docType !== filters.docType) return false;
      if (filters.counterpartyId && r.counterpartyId !== filters.counterpartyId) return false;
      if (filters.dateFrom && (!r.date || r.date < filters.dateFrom)) return false;
      if (filters.dateTo && (!r.date || r.date > filters.dateTo)) return false;
      if (amountFrom !== null && !isNaN(amountFrom) && r.amount < amountFrom) return false;
      if (amountTo !== null && !isNaN(amountTo) && r.amount > amountTo) return false;

      if (filters.q) {
        const haystack = r.text + ' ' + r.type + ' ' + H.cpName(r.counterpartyId);
        if (!U.includes(haystack, filters.q)) return false;
      }
      return true;
    });
  }

  function isEmptyQuery() {
    return !Object.keys(filters).some(function (k) { return String(filters[k]).trim() !== ''; });
  }

  /* =========================================================================
     ЭКРАН
     ====================================================================== */
  function search(ctx) {
    // Запрос из глобальной строки поиска: #/search?q=…
    if (ctx && ctx.params && ctx.params.q !== undefined) filters.q = ctx.params.q;

    const results = el('div');
    const sources = availableSources();

    function field(label, node) {
      return el('label.field', null, [el('span.field__label', { text: label }), node]);
    }

    function input(key, opts) {
      return el('input.input', Object.assign({
        value: filters[key],
        oninput: U.debounce(function (e) { filters[key] = e.target.value; draw(); }, 220)
      }, opts || {}));
    }

    function select(key, options, placeholder) {
      return el('select.select', {
        onchange: function (e) { filters[key] = e.target.value; draw(); }
      }, [el('option', { value: '', text: placeholder })].concat(
        options.map(function (o) {
          return el('option', { value: o.v, text: o.t, selected: filters[key] === o.v });
        })
      ));
    }

    const companies = App.Store.all('companies');
    const current = App.Store.company();

    const form = UI.card({
      title: 'Условия поиска',
      subtitle: 'Заполните любое поле — остальные останутся без ограничения',
      tools: [UI.btn('Сбросить', {
        size: 'sm', kind: 'ghost', icon: 'refresh', onClick: function () {
          Object.keys(filters).forEach(function (k) { filters[k] = ''; });
          App.Router.go('search');
        }
      })],
      body: [
        el('div.grid.grid--3', null, [
          field('Номер документа, содержание', input('q', {
            type: 'search', placeholder: 'Например: РН-12 или аренда'
          })),
          field('Тип документа', select('kind', sources.map(function (s) {
            return { v: s.key, t: s.title };
          }), 'Все журналы')),
          field('Вид документа ЭДО', select('docType',
            (App.Docs && App.Docs.DOC_TYPES ? App.Docs.DOC_TYPES : []), 'Любой вид')),
          field('Контрагент', select('counterpartyId', H.cpOptions(), 'Все контрагенты')),
          field('Организация', el('select.select', {
            onchange: function (e) {
              App.Store.setCompany(e.target.value);
              App.Router.render();
            }
          }, companies.map(function (c) {
            return el('option', { value: c.id, text: c.name, selected: c.id === current.id });
          }))),
          field('Дата с', input('dateFrom', { type: 'date', oninput: null, onchange: function (e) { filters.dateFrom = e.target.value; draw(); } })),
          field('Дата по', input('dateTo', { type: 'date', oninput: null, onchange: function (e) { filters.dateTo = e.target.value; draw(); } })),
          field('Сумма от', input('amountFrom', { type: 'number', min: '0', step: '1000', placeholder: '0' })),
          field('Сумма до', input('amountTo', { type: 'number', min: '0', step: '1000', placeholder: 'без ограничения' }))
        ])
      ]
    });

    function draw() {
      U.clear(results);

      if (isEmptyQuery()) {
        results.appendChild(UI.empty({
          icon: 'search',
          title: 'Задайте условия поиска',
          text: 'Найдём документы, платежи, реализации и проводки по номеру, дате, ' +
            'контрагенту, сумме или типу документа.'
        }));
        return;
      }

      const rows = U.sortBy(apply(collect()), function (r) { return r.date || ''; }, 'desc');

      if (!rows.length) {
        results.appendChild(UI.empty({
          icon: 'search',
          title: 'Ничего не найдено',
          text: 'Условиям поиска не соответствует ни одна запись. Попробуйте ослабить фильтры.',
          action: {
            text: 'Сбросить условия', onClick: function () {
              Object.keys(filters).forEach(function (k) { filters[k] = ''; });
              App.Router.go('search');
            }
          }
        }));
        return;
      }

      const byKind = U.groupBy(rows, function (r) { return r.kind; });
      const total = U.sum(rows, function (r) { return r.amount; });

      results.appendChild(UI.statGrid([
        { label: 'Найдено записей', value: String(rows.length), icon: 'search', tone: 'info' },
        { label: 'Журналов затронуто', value: String(Object.keys(byKind).length), icon: 'files', tone: 'violet' },
        { label: 'Сумма найденного', value: U.moneyShort(total), icon: 'wallet', tone: 'ok' },
        {
          label: 'Период', icon: 'clock', tone: 'warn',
          value: U.fmtDate(rows[rows.length - 1].date) + ' — ' + U.fmtDate(rows[0].date)
        }
      ], 4));

      results.appendChild(el('div.mt-4', null, [UI.table({
        columns: [
          { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
          { k: 'type', t: 'Тип', w: '190px' },
          { k: 'number', t: 'Номер', w: '130px', render: function (r) { return el('strong', { text: r.number || '—' }); } },
          {
            id: 'cp', t: 'Контрагент',
            sort: function (r) { return H.cpName(r.counterpartyId); },
            render: function (r) { return r.counterpartyId ? H.cpName(r.counterpartyId) : '—'; }
          },
          { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
          { k: 'status', t: 'Статус', w: '130px', render: function (r) { return r.status ? UI.status(r.status) : '—'; } },
          {
            id: 'act', t: '', w: '54px', sortable: false, render: function (r) {
              return UI.rowActions([{ icon: 'arrowRight', title: 'Открыть', onClick: r.open }]);
            }
          }
        ],
        rows: rows, pageSize: 20, exportName: 'search-results.csv',
        onRow: function (r) { r.open(); }
      })]));
    }

    draw();

    return UI.page({
      title: 'Расширенный поиск',
      subtitle: 'Поиск по номеру, дате, организации, контрагенту, сумме и типу документа',
      children: [form, el('div.mt-4', null, [results])]
    });
  }

  App.Router.add('search', { title: 'Расширенный поиск', module: 'dashboard', render: search });
  App.Search = { filters: filters };
})(window.App);

/* =============================================================================
   МОДУЛЬ: Продажи · Возвраты · Контрагенты · CRM · Задачи
   ТЗ п. 6, 11, 12
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* =========================================================================
     ПРОДАЖИ
     ====================================================================== */
  function sales() {
    const canEdit = App.Auth.canEdit('sales');
    const rows = App.Store.all('sales');
    const paid = U.sum(rows, function (s) { return s.paid; });
    const total = U.sum(rows, function (s) { return s.amount; });

    const dyn = H.monthly('sales', 'date', function (s) { return s.amount; }, 12);

    return UI.page({
      title: 'Продажи',
      subtitle: 'Счета, реализации, скидки, оплата',
      actions: canEdit ? [UI.btn('Новая продажа', { kind: 'primary', icon: 'plus', onClick: function () { editSale(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Продаж всего', value: rows.length, icon: 'cart', tone: 'info' },
          { label: 'Сумма продаж', value: U.moneyShort(total), icon: 'trend', tone: 'ok' },
          { label: 'Оплачено', value: U.moneyShort(paid), icon: 'checkCircle', tone: 'ok',
            meta: U.pct(total ? paid / total * 100 : 0, 0) + ' от суммы' },
          { label: 'Не оплачено', value: U.moneyShort(total - paid), icon: 'alert', tone: 'danger',
            meta: rows.filter(function (s) { return s.status !== 'paid'; }).length + ' документов' },
          { label: 'Средний чек', value: U.moneyShort(rows.length ? total / rows.length : 0), icon: 'scale', tone: 'violet' }
        ], 4),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Динамика продаж',
            subtitle: 'помесячно за 12 месяцев',
            body: [C.line({ labels: dyn.labels, height: 210, series: [{ name: 'Продажи', values: dyn.values, color: 'var(--c1)' }] })]
          }),
          UI.card({
            title: 'Структура оплаты',
            body: [C.donut({
              items: [
                { name: 'Оплачено', value: paid, color: 'var(--c2)' },
                { name: 'Не оплачено', value: total - paid, color: 'var(--c4)' }
              ], size: 180, centerTop: U.moneyShort(total), centerBottom: 'продажи'
            })]
          })
        ]),

        el('div.mt-4', null, [
          UI.card({
            title: 'Документы продаж',
            flush: true,
            body: [UI.table({
              search: ['number', 'manager', function (s) { return H.cpName(s.counterpartyId); }],
              searchPlaceholder: 'Поиск по номеру, клиенту, менеджеру…',
              filters: [
                { k: 'status', t: 'Оплата', options: UI.statusOptions(['paid', 'partial', 'unpaid']) },
                { k: 'manager', t: 'Менеджер', options: U.uniq(rows.map(function (s) { return s.manager; })).map(function (m) { return { v: m, t: m }; }) }
              ],
              columns: [
                { k: 'number', t: '№', w: '100px' },
                { k: 'date', t: 'Дата', w: '110px', render: function (s) { return U.fmtDate(s.date); } },
                { k: 'counterpartyId', t: 'Клиент', render: function (s) { return H.cpName(s.counterpartyId); },
                  sort: function (s) { return H.cpName(s.counterpartyId); } },
                { id: 'items', t: 'Позиций', num: true, render: function (s) { return s.items.length; } },
                { k: 'discount', t: 'Скидка', num: true, render: function (s) { return s.discount ? U.money(s.discount, { digits: 0 }) : '—'; } },
                { k: 'amount', t: 'Сумма', num: true, render: function (s) { return U.money(s.amount, { digits: 0 }); } },
                { k: 'paid', t: 'Оплачено', num: true, render: function (s) {
                  return s.paid >= s.amount ? el('span.num.up', { text: U.money(s.paid, { digits: 0 }) })
                    : el('span.num.down', { text: U.money(s.paid, { digits: 0 }) });
                } },
                { k: 'dueDate', t: 'Срок оплаты', w: '120px', render: function (s) {
                  const left = U.daysLeft(s.dueDate);
                  if (s.status === 'paid') return U.fmtDate(s.dueDate);
                  return el('div', null, [U.fmtDate(s.dueDate),
                    el('div.fs-xs', { class: left < 0 ? 'down' : 'muted-2', text: left < 0 ? 'просрочка ' + (-left) + ' дн.' : left + ' дн.' })]);
                } },
                { k: 'status', t: 'Статус', w: '120px', render: function (s) { return UI.status(s.status); } },
                { id: 'act', t: '', w: '110px', sortable: false, render: function (s) {
                  return UI.rowActions([
                    { icon: 'eye', title: 'Открыть', onClick: function () { openSale(s); } },
                    canEdit && s.status !== 'paid' ? { icon: 'cash', title: 'Принять оплату', onClick: function () { pay(s); } } : null,
                    canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
                      UI.confirm({ title: 'Удалить продажу?', danger: true, text: s.number + ' будет удалена.', onOk: function () {
                        App.Store.remove('sales', s.id); UI.toast({ kind: 'ok', title: 'Продажа удалена' }); App.Router.render();
                      } });
                    } } : null
                  ]);
                } }
              ],
              rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 15, exportName: 'sales.csv',
              onRow: openSale,
              rowClass: function (s) { return s.status !== 'paid' && U.daysLeft(s.dueDate) < 0 ? 'is-danger' : ''; },
              dangerRows: true
            })]
          })
        ])
      ]
    });
  }

  function openSale(s) {
    UI.detailModal({
      title: 'Реализация ' + s.number,
      size: 'lg',
      pairs: [
        ['Клиент', H.cpName(s.counterpartyId)],
        ['Дата', U.fmtDate(s.date)],
        ['Склад отгрузки', H.warehouseName(s.warehouseId)],
        ['Менеджер', s.manager],
        ['Сумма без скидки', U.money(s.total)],
        ['Скидка', s.discount ? U.money(s.discount) : '—'],
        ['Итого', el('strong', { text: U.money(s.amount) })],
        ['в том числе НДС', U.money(s.vat)],
        ['Оплачено', U.money(s.paid)],
        ['Задолженность', H.moneyCell(s.amount - s.paid, { colorize: true })],
        ['Срок оплаты', U.fmtDate(s.dueDate)],
        ['Статус', UI.status(s.status)]
      ],
      extra: [
        el('h4.mt-4.mb-2', { text: 'Товары' }),
        UI.table({
          columns: [
            { k: 'name', t: 'Товар' },
            { k: 'qty', t: 'Кол-во', num: true, render: function (i) { return U.num(i.qty, 0) + ' ' + i.unit; } },
            { k: 'price', t: 'Цена', num: true, render: function (i) { return U.money(i.price, { digits: 0 }); } },
            { k: 'sum', t: 'Сумма', num: true, render: function (i) { return U.money(i.sum, { digits: 0 }); } }
          ],
          rows: s.items, pageSize: 0, exportName: false, printable: false,
          totals: { sum: function (rs) { return U.money(U.sum(rs, function (r) { return r.sum; }), { digits: 0 }); } }
        })
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        s.status !== 'paid' && App.Auth.canEdit('sales')
          ? { text: 'Принять оплату', kind: 'primary', icon: 'cash', onClick: function () { pay(s); } }
          : { text: 'Печать', kind: 'primary', icon: 'print', close: false, onClick: function () { window.print(); } }
      ]
    });
  }

  function pay(s) {
    const debt = s.amount - s.paid;
    UI.formModal({
      title: 'Оплата по документу ' + s.number,
      size: 'sm',
      values: { amount: debt, date: U.today(), method: 'bank' },
      fields: [
        { k: 'amount', t: 'Сумма оплаты, сом', type: 'money', required: true, max: debt,
          hint: 'Задолженность: ' + U.money(debt) },
        { k: 'date', t: 'Дата оплаты', type: 'date', required: true },
        { k: 'method', t: 'Способ оплаты', type: 'select', empty: false, options: [
          { v: 'bank', t: 'Расчётный счёт' }, { v: 'cash', t: 'Касса' }
        ] }
      ],
      onSave: function (v) {
        const newPaid = Math.min(s.amount, s.paid + v.amount);
        App.Store.update('sales', s.id, {
          paid: newPaid,
          status: newPaid >= s.amount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        });
        if (v.method === 'cash') {
          App.Store.insert('cashOrders', {
            number: H.nextNumber('cashOrders', 'ПКО'), kind: 'in', date: v.date, amount: v.amount,
            counterpartyId: s.counterpartyId, person: H.cpName(s.counterpartyId),
            basis: 'Оплата по документу ' + s.number, cashier: (App.Auth.user() || {}).fullName, status: 'posted'
          }, { silent: true });
          H.autoEntries('cashIn', v.amount, v.date, s);
        } else {
          App.Store.insert('payments', {
            number: H.nextNumber('payments', 'ПП'), kind: 'in', date: v.date, amount: v.amount,
            counterpartyId: s.counterpartyId, purpose: 'Оплата по документу ' + s.number,
            account: App.Store.company().account, bank: App.Store.company().bank,
            matched: true, status: 'executed'
          }, { silent: true });
          H.autoEntries('payIn', v.amount, v.date, s);
        }
        App.Store.persist();
        UI.toast({ kind: 'ok', title: 'Оплата принята', text: U.money(v.amount, { digits: 0 }) });
        UI.closeModal();
        App.Router.render();
      }
    });
  }

  function editSale(s) {
    const items = s ? s.items.slice() : [];
    const box = el('div.col');

    function draw() {
      U.clear(box);
      box.appendChild(el('div.form-section', { text: 'Товары' }));
      items.forEach(function (it, idx) {
        box.appendChild(el('div.row', null, [
          el('div.grow.truncate', { text: it.name }),
          el('span.fs-sm.muted', { text: U.num(it.qty, 0) + ' ' + it.unit + ' × ' + U.money(it.price, { digits: 0 }) }),
          el('strong', { text: U.money(it.sum, { digits: 0 }) }),
          UI.iconBtn('trash', 'Удалить', function () { items.splice(idx, 1); draw(); }, 'danger')
        ]));
      });
      if (!items.length) box.appendChild(el('p.muted-2', { text: 'Добавьте товары в документ' }));
      box.appendChild(el('div.row.mt-2', null, [
        UI.btn('Добавить товар', { size: 'sm', icon: 'plus', onClick: add }),
        UI.btn('По штрихкоду', { size: 'sm', icon: 'barcode', onClick: byBarcode }),
        el('div.grow'),
        el('strong', { text: 'Итого: ' + U.money(U.sum(items, function (i) { return i.sum; }), { digits: 0 }) })
      ]));
    }

    function pushItem(p, qty) {
      const exist = items.filter(function (i) { return i.productId === p.id; })[0];
      if (exist) { exist.qty += qty; exist.sum = exist.qty * exist.price; }
      else items.push({ productId: p.id, name: p.name, unit: p.unit, qty: qty, price: p.price, sum: qty * p.price });
      draw();
    }

    function add() {
      const f = UI.form({
        values: { qty: 1 },
        fields: [
          { k: 'productId', t: 'Товар', type: 'select', options: H.productOptions(), required: true },
          { k: 'qty', t: 'Количество', type: 'number', required: true, col: 6, min: 1 },
          { k: 'price', t: 'Цена (по умолчанию — из карточки)', type: 'money', col: 6 }
        ]
      });
      UI.modal({
        title: 'Добавить товар', size: 'sm', body: f.node,
        buttons: [
          { text: 'Отмена', kind: 'ghost' },
          { text: 'Добавить', kind: 'primary', onClick: function () {
            if (!f.validate()) return false;
            const v = f.read();
            const p = H.product(v.productId);
            const stock = H.stockOf(p.id);
            if (v.qty > stock) UI.toast({ kind: 'warn', title: 'Недостаточно остатка', text: 'На складах: ' + U.num(stock, 0) + ' ' + p.unit });
            pushItem(Object.assign({}, p, { price: v.price || p.price }), v.qty);
          } }
        ]
      });
    }

    function byBarcode() {
      const f = UI.form({ fields: [{ k: 'code', t: 'Штрихкод', required: true }] });
      UI.modal({
        title: 'Сканирование товара', size: 'sm',
        body: [el('div.center.mb-3', null, [App.Icons.get('barcode', '', 40)]), f.node],
        buttons: [
          { text: 'Отмена', kind: 'ghost' },
          { text: 'Добавить', kind: 'primary', onClick: function () {
            if (!f.validate()) return false;
            const code = f.read().code.trim();
            const p = App.Store.all('products').filter(function (x) { return x.barcode === code || x.sku === code; })[0];
            if (!p) { UI.toast({ kind: 'danger', title: 'Товар не найден', text: code }); return false; }
            pushItem(p, 1);
            UI.toast({ kind: 'ok', title: 'Добавлено', text: p.name });
          } }
        ]
      });
    }

    draw();

    const f = UI.form({
      values: s || {
        number: H.nextNumber('sales', 'РН'), date: U.today(),
        dueDate: U.iso(U.addDays(new Date(), 14)), warehouseId: 'wh-1', discount: 0,
        manager: (App.Auth.user() || {}).fullName
      },
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'dueDate', t: 'Срок оплаты', type: 'date', required: true, col: 4 },
        { k: 'counterpartyId', t: 'Клиент', type: 'select', options: H.cpOptions('client'), required: true, col: 8 },
        { k: 'warehouseId', t: 'Склад', type: 'select', options: H.warehouseOptions(), required: true, col: 4 },
        { k: 'discount', t: 'Скидка, сом', type: 'money', col: 4 },
        { k: 'manager', t: 'Менеджер', col: 8 }
      ]
    });

    UI.modal({
      title: s ? 'Продажа ' + s.number : 'Новая продажа',
      size: 'lg',
      body: [f.node, box],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Провести', kind: 'primary', icon: 'check', onClick: function () {
          if (!f.validate()) return false;
          if (!items.length) { UI.toast({ kind: 'danger', title: 'Добавьте товары' }); return false; }
          const v = f.read();
          const total = U.sum(items, function (i) { return i.sum; });
          v.items = items;
          v.total = total;
          v.discount = v.discount || 0;
          v.amount = total - v.discount;
          v.vat = Math.round(v.amount * 12 / 112);
          v.paid = s ? s.paid : 0;
          v.status = v.paid >= v.amount ? 'paid' : v.paid > 0 ? 'partial' : 'unpaid';
          v.posted = true;

          if (s) {
            App.Store.update('sales', s.id, v);
          } else {
            const rec = App.Store.insert('sales', v);
            items.forEach(function (i) {
              H.applyStock(i.productId, v.warehouseId, -i.qty);
              App.Store.insert('stockMoves', {
                number: H.nextNumber('stockMoves', 'ДВ'), date: v.date, type: 'out',
                productId: i.productId, productName: i.name, unit: i.unit, qty: i.qty,
                fromWarehouseId: v.warehouseId, price: i.price, amount: i.sum,
                author: v.manager, reason: 'Реализация ' + v.number
              }, { silent: true });
            });
            App.Store.emit('stockMoves');
            H.autoEntries('sale', v.amount, v.date, rec);
          }
          UI.toast({ kind: 'ok', title: 'Продажа проведена', text: v.number + ' · ' + U.money(v.amount, { digits: 0 }) });
          App.Router.render();
        } }
      ]
    });
  }

  /* =========================================================================
     ВОЗВРАТЫ
     ====================================================================== */
  function returns() {
    const canEdit = App.Auth.canEdit('sales');
    const rows = App.Store.all('returns');

    return UI.page({
      title: 'Возвраты',
      subtitle: 'Возврат товара от покупателей и корректировка расчётов',
      actions: canEdit ? [UI.btn('Оформить возврат', { kind: 'primary', icon: 'plus', onClick: editReturn })] : [],
      children: [
        UI.statGrid([
          { label: 'Возвратов', value: rows.length, icon: 'refresh', tone: 'info' },
          { label: 'Сумма возвратов', value: U.moneyShort(U.sum(rows, function (r) { return r.amount; })), icon: 'wallet', tone: 'danger' },
          { label: 'Доля от продаж', value: U.pct(function () {
            const s = U.sum(App.Store.all('sales'), function (x) { return x.amount; });
            return s ? U.sum(rows, function (r) { return r.amount; }) / s * 100 : 0;
          }(), 2), icon: 'percent', tone: 'warn' }
        ], 3),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['number', 'saleNumber', 'reason'],
            filters: [{ k: 'reason', t: 'Причина', options: U.uniq(rows.map(function (r) { return r.reason; })).map(function (x) { return { v: x, t: x }; }) }],
            columns: [
              { k: 'number', t: '№', w: '100px' },
              { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
              { k: 'saleNumber', t: 'Документ продажи', w: '160px' },
              { k: 'counterpartyId', t: 'Клиент', render: function (r) { return H.cpName(r.counterpartyId); } },
              { k: 'reason', t: 'Причина' },
              { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
              { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } }
            ],
            rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 12, exportName: 'returns.csv'
          })]
        })])
      ]
    });
  }

  function editReturn() {
    UI.formModal({
      title: 'Оформление возврата',
      values: { number: H.nextNumber('returns', 'ВЗ'), date: U.today(), status: 'review' },
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'amount', t: 'Сумма возврата', type: 'money', required: true, col: 4 },
        { k: 'saleId', t: 'Документ продажи', type: 'select', required: true, col: 12,
          options: App.Store.all('sales').slice(0, 60).map(function (s) {
            return { v: s.id, t: s.number + ' от ' + U.fmtDate(s.date) + ' · ' + H.cpName(s.counterpartyId) };
          }) },
        { k: 'reason', t: 'Причина возврата', type: 'select', required: true, col: 6, options: [
          { v: 'Брак товара', t: 'Брак товара' }, { v: 'Пересорт', t: 'Пересорт' },
          { v: 'Отказ покупателя', t: 'Отказ покупателя' }, { v: 'Ошибка в документах', t: 'Ошибка в документах' }
        ] },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false, options: UI.statusOptions(['review', 'approved', 'posted']) }
      ],
      onSave: function (v) {
        const sale = App.Store.get('sales', v.saleId);
        v.saleNumber = sale ? sale.number : '';
        v.counterpartyId = sale ? sale.counterpartyId : null;
        App.Store.insert('returns', v);
        UI.toast({ kind: 'ok', title: 'Возврат оформлен', text: v.number });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     КОНТРАГЕНТЫ
     ====================================================================== */
  function counterparties() {
    const canEdit = App.Auth.canEdit('counterparties');
    const rec = H.receivables();
    const rows = App.Store.all('counterparties').map(function (c) {
      const debt = (rec.filter(function (r) { return r.id === c.id; })[0] || {}).debt || 0;
      const sales = App.Store.all('sales').filter(function (s) { return s.counterpartyId === c.id; });
      return Object.assign({}, c, {
        debtCalc: debt,
        turnover: U.sum(sales, function (s) { return s.amount; }),
        dealsCount: sales.length
      });
    });

    return UI.page({
      title: 'Контрагенты',
      subtitle: 'Клиенты и поставщики: реквизиты, договоры, история операций, рейтинг',
      actions: canEdit ? [UI.btn('Новый контрагент', { kind: 'primary', icon: 'plus', onClick: function () { editCp(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Всего контрагентов', value: rows.length, icon: 'users', tone: 'info' },
          { label: 'Клиентов', value: rows.filter(function (c) { return c.kind === 'client'; }).length, icon: 'user', tone: 'ok' },
          { label: 'Поставщиков', value: rows.filter(function (c) { return c.kind === 'supplier'; }).length, icon: 'truck', tone: 'violet' },
          { label: 'С задолженностью', value: rows.filter(function (c) { return c.debtCalc > 0; }).length, icon: 'alert', tone: 'warn' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['name', 'inn', 'phone', 'email', 'contact'],
            searchPlaceholder: 'Поиск по названию, ИНН, телефону…',
            filters: [
              { k: 'kind', t: 'Тип', options: [{ v: 'client', t: 'клиенты' }, { v: 'supplier', t: 'поставщики' }] },
              { k: 'rating', t: 'Рейтинг', options: [5, 4, 3, 2].map(function (r) { return { v: String(r), t: r + ' звёзд' }; }) }
            ],
            columns: [
              { k: 'name', t: 'Наименование', render: function (c) {
                return el('div', null, [
                  el('div.strong', { text: c.name }),
                  el('div.fs-xs.muted-2', { text: 'ИНН ' + c.inn })
                ]);
              } },
              { k: 'kind', t: 'Тип', w: '120px', render: function (c) {
                return c.kind === 'client' ? UI.badge('клиент', 'info') : UI.badge('поставщик', 'violet');
              } },
              { k: 'phone', t: 'Телефон', w: '150px' },
              { k: 'contact', t: 'Контактное лицо', w: '150px' },
              { k: 'rating', t: 'Рейтинг', w: '110px', render: function (c) {
                return el('span', { title: c.rating + ' из 5', text: '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating), style: { color: 'var(--c3)' } });
              } },
              { k: 'turnover', t: 'Оборот', num: true, render: function (c) { return U.money(c.turnover, { digits: 0 }); } },
              { k: 'debtCalc', t: 'Задолженность', num: true, render: function (c) {
                return c.debtCalc ? el('span.num.down', { text: U.money(c.debtCalc, { digits: 0 }) }) : '—';
              } },
              { id: 'act', t: '', w: '110px', sortable: false, render: function (c) {
                return UI.rowActions([
                  { icon: 'eye', title: 'Карточка', onClick: function () { openCp(c.id); } },
                  canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editCp(App.Store.get('counterparties', c.id)); } } : null,
                  canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
                    UI.confirm({ title: 'Удалить контрагента?', danger: true, text: c.name + ' будет удалён.', onOk: function () {
                      App.Store.remove('counterparties', c.id); UI.toast({ kind: 'ok', title: 'Контрагент удалён' }); App.Router.render();
                    } });
                  } } : null
                ]);
              } }
            ],
            rows: rows, sort: { k: 'turnover', dir: 'desc' }, pageSize: 15, exportName: 'counterparties.csv',
            onRow: function (c) { openCp(c.id); }
          })]
        })])
      ]
    });
  }

  function openCp(id) {
    const c = App.Store.get('counterparties', id);
    if (!c) return;
    const sales = App.Store.all('sales').filter(function (s) { return s.counterpartyId === id; });
    const contracts = App.Store.all('contracts').filter(function (x) { return x.counterpartyId === id; });
    const docs = App.Store.all('documents').filter(function (d) { return d.counterpartyId === id; });
    const payments = App.Store.all('payments').filter(function (p) { return p.counterpartyId === id; });
    const debt = U.sum(sales, function (s) { return s.amount - s.paid; });

    UI.modal({
      title: c.name,
      size: 'xl',
      body: [UI.tabs([
        {
          id: 'main', title: 'Реквизиты',
          render: function () {
            return el('div.grid.grid--2', null, [
              UI.kv([
                ['Наименование', c.name], ['Тип', c.kind === 'client' ? 'Клиент' : 'Поставщик'],
                ['ИНН', c.inn], ['Адрес', c.address], ['Телефон', c.phone], ['Email', c.email],
                ['Контактное лицо', c.contact], ['Рейтинг', '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating)]
              ]),
              el('div.col', null, [
                UI.card({
                  title: 'Банковские реквизиты',
                  body: [UI.kv([['Банк', c.bank], ['Расчётный счёт', el('span.mono', { text: c.account })], ['БИК', el('span.mono', { text: c.bik })]])]
                }),
                UI.card({
                  title: 'Условия работы',
                  body: [UI.kv([
                    ['Отсрочка платежа', c.dueDays + ' дней'],
                    ['Кредитный лимит', U.money(c.creditLimit, { digits: 0 })],
                    ['Текущая задолженность', H.moneyCell(debt, { colorize: true, digits: 0 })],
                    ['Использование лимита', UI.progress(debt, c.creditLimit, debt > c.creditLimit ? 'danger' : 'ok')]
                  ])]
                })
              ])
            ]);
          }
        },
        {
          id: 'ops', title: 'История операций (' + sales.length + ')',
          render: function () {
            return el('div.col', null, [
              UI.statGrid([
                { label: 'Оборот', value: U.moneyShort(U.sum(sales, function (s) { return s.amount; })), tone: 'ok' },
                { label: 'Оплачено', value: U.moneyShort(U.sum(sales, function (s) { return s.paid; })), tone: 'info' },
                { label: 'Задолженность', value: U.moneyShort(debt), tone: debt ? 'danger' : 'ok' },
                { label: 'Документов', value: sales.length, tone: 'violet' }
              ], 4),
              sales.length ? UI.table({
                columns: [
                  { k: 'date', t: 'Дата', render: function (s) { return U.fmtDate(s.date); } },
                  { k: 'number', t: '№' },
                  { k: 'amount', t: 'Сумма', num: true, render: function (s) { return U.money(s.amount, { digits: 0 }); } },
                  { k: 'paid', t: 'Оплачено', num: true, render: function (s) { return U.money(s.paid, { digits: 0 }); } },
                  { k: 'status', t: 'Статус', render: function (s) { return UI.status(s.status); } }
                ], rows: sales, sort: { k: 'date', dir: 'desc' }, pageSize: 10, exportName: false
              }) : UI.empty({ icon: 'cart', title: 'Операций не было' })
            ]);
          }
        },
        {
          id: 'contracts', title: 'Договоры (' + contracts.length + ')',
          render: function () {
            return contracts.length ? UI.table({
              columns: [
                { k: 'number', t: '№' },
                { k: 'type', t: 'Тип' },
                { k: 'endDate', t: 'Действует до', render: function (x) { return U.fmtDate(x.endDate); } },
                { k: 'amount', t: 'Сумма', num: true, render: function (x) { return U.money(x.amount, { digits: 0 }); } },
                { k: 'status', t: 'Статус', render: function (x) { return UI.status(x.status); } }
              ], rows: contracts, pageSize: 10, exportName: false
            }) : UI.empty({ icon: 'contract', title: 'Договоров нет' });
          }
        },
        {
          id: 'docs', title: 'Документы (' + docs.length + ')',
          render: function () {
            return docs.length ? UI.table({
              columns: [
                { k: 'date', t: 'Дата', render: function (d) { return U.fmtDate(d.date); } },
                { k: 'number', t: '№' },
                { k: 'typeName', t: 'Тип' },
                { k: 'amount', t: 'Сумма', num: true, render: function (d) { return d.amount ? U.money(d.amount, { digits: 0 }) : '—'; } },
                { k: 'status', t: 'Статус', render: function (d) { return UI.status(d.status); } }
              ], rows: docs, sort: { k: 'date', dir: 'desc' }, pageSize: 10, exportName: false
            }) : UI.empty({ icon: 'files', title: 'Документов нет' });
          }
        },
        {
          id: 'pay', title: 'Платежи (' + payments.length + ')',
          render: function () {
            return payments.length ? UI.table({
              columns: [
                { k: 'date', t: 'Дата', render: function (p) { return U.fmtDate(p.date); } },
                { k: 'number', t: '№' },
                { k: 'purpose', t: 'Назначение' },
                { k: 'amount', t: 'Сумма', num: true, render: function (p) {
                  return el('span', { class: 'num ' + (p.kind === 'in' ? 'up' : 'down'), text: U.money(p.amount, { digits: 0 }) });
                } }
              ], rows: payments, sort: { k: 'date', dir: 'desc' }, pageSize: 10, exportName: false
            }) : UI.empty({ icon: 'card', title: 'Платежей нет' });
          }
        }
      ])]
    });
  }

  function editCp(c) {
    UI.formModal({
      title: c ? c.name : 'Новый контрагент',
      values: c || { kind: 'client', rating: 4, dueDays: 14, creditLimit: 300000, active: true },
      fields: [
        { k: 'name', t: 'Наименование', required: true, col: 8 },
        { k: 'kind', t: 'Тип', type: 'select', required: true, col: 4, empty: false,
          options: [{ v: 'client', t: 'Клиент' }, { v: 'supplier', t: 'Поставщик' }] },
        { k: 'inn', t: 'ИНН', required: true, col: 4,
          validate: function (v) { return String(v).length < 10 ? 'ИНН должен содержать не менее 10 знаков' : ''; } },
        { k: 'phone', t: 'Телефон', col: 4 },
        { k: 'email', t: 'Email', type: 'email', col: 4 },
        { k: 'address', t: 'Юридический адрес', col: 8 },
        { k: 'contact', t: 'Контактное лицо', col: 4 },
        { t: 'Банковские реквизиты', type: 'section' },
        { k: 'bank', t: 'Банк', type: 'select', col: 4, options: App.Seed.BANKS.map(function (b) { return { v: b, t: b }; }) },
        { k: 'account', t: 'Расчётный счёт', col: 4 },
        { k: 'bik', t: 'БИК', col: 4 },
        { t: 'Условия работы', type: 'section' },
        { k: 'dueDays', t: 'Отсрочка платежа, дней', type: 'number', col: 4 },
        { k: 'creditLimit', t: 'Кредитный лимит, сом', type: 'money', col: 4 },
        { k: 'rating', t: 'Рейтинг', type: 'select', col: 4, empty: false,
          options: [5, 4, 3, 2, 1].map(function (r) { return { v: r, t: r + ' — ' + ['очень низкий', 'низкий', 'средний', 'высокий', 'отличный'][r - 1] }; }) },
        { k: 'notes', t: 'Примечания', type: 'textarea', col: 12 }
      ],
      onSave: function (v) {
        v.rating = Number(v.rating);
        if (c) App.Store.update('counterparties', c.id, v);
        else App.Store.insert('counterparties', v);
        UI.toast({ kind: 'ok', title: 'Контрагент сохранён', text: v.name });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     CRM — ВОРОНКА СДЕЛОК
     ====================================================================== */
  const STAGES = [
    { id: 'new', t: 'Новые', color: 'var(--c8)' },
    { id: 'contact', t: 'Контакт установлен', color: 'var(--c6)' },
    { id: 'offer', t: 'КП отправлено', color: 'var(--c1)' },
    { id: 'negotiation', t: 'Переговоры', color: 'var(--c3)' },
    { id: 'won', t: 'Выиграна', color: 'var(--c2)' },
    { id: 'lost', t: 'Проиграна', color: 'var(--c4)' }
  ];

  function crm() {
    const canEdit = App.Auth.canEdit('crm');
    const deals = App.Store.all('deals');
    const won = deals.filter(function (d) { return d.stage === 'won'; });
    const active = deals.filter(function (d) { return d.stage !== 'won' && d.stage !== 'lost'; });

    const board = el('div.kanban');
    STAGES.forEach(function (st) {
      const list = deals.filter(function (d) { return d.stage === st.id; });
      const col = el('div.kanban__col');
      col.appendChild(el('div.kanban__head', null, [
        el('span', null, [el('span', { style: { color: st.color }, text: '● ' }), st.t]),
        el('span.badge', { text: String(list.length) })
      ]));
      const body = el('div.kanban__list', {
        dataset: { stage: st.id },
        ondragover: function (e) { if (canEdit) { e.preventDefault(); body.classList.add('is-over'); } },
        ondragleave: function () { body.classList.remove('is-over'); },
        ondrop: function (e) {
          e.preventDefault();
          body.classList.remove('is-over');
          const id = e.dataTransfer.getData('text/plain');
          const d = App.Store.get('deals', id);
          if (!d || d.stage === st.id) return;
          App.Store.update('deals', id, {
            stage: st.id,
            probability: { new: 10, contact: 25, offer: 50, negotiation: 75, won: 100, lost: 0 }[st.id]
          });
          UI.toast({ kind: 'ok', title: 'Сделка перемещена', text: d.title + ' → ' + st.t });
          App.Router.render();
        }
      });

      list.forEach(function (d) {
        const cardEl = el('div.kanban__card', {
          draggable: canEdit ? 'true' : 'false',
          onclick: function () { openDeal(d); },
          ondragstart: function (e) { e.dataTransfer.setData('text/plain', d.id); cardEl.classList.add('is-drag'); },
          ondragend: function () { cardEl.classList.remove('is-drag'); }
        }, [
          el('h4.truncate', { text: d.title }),
          el('div.fs-sm.muted-2.truncate', { text: H.cpName(d.counterpartyId) }),
          el('div.row.mt-2', null, [
            el('strong', { text: U.moneyShort(d.amount) }),
            el('div.grow'),
            el('span.badge', { text: U.pct(d.probability, 0) })
          ]),
          el('div.row.mt-2', null, [
            el('span.avatar.avatar--sm', { text: U.initials(d.manager) }),
            el('span.fs-xs.muted-2.truncate', { text: d.nextStep + ' · ' + U.fmtDate(d.nextDate) })
          ])
        ]);
        body.appendChild(cardEl);
      });

      if (!list.length) body.appendChild(el('p.fs-sm.muted-2.center', { text: 'нет сделок' }));
      col.appendChild(body);
      board.appendChild(col);
    });

    return UI.page({
      title: 'CRM · воронка сделок',
      subtitle: 'База клиентов, статусы сделок, история общения' + (canEdit ? ' · карточки можно перетаскивать' : ''),
      actions: canEdit ? [UI.btn('Новая сделка', { kind: 'primary', icon: 'plus', onClick: function () { editDeal(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Активных сделок', value: active.length, icon: 'briefcase', tone: 'info',
            meta: U.moneyShort(U.sum(active, function (d) { return d.amount; })) },
          { label: 'Выиграно', value: won.length, icon: 'checkCircle', tone: 'ok', meta: U.moneyShort(U.sum(won, function (d) { return d.amount; })) },
          { label: 'Конверсия', value: U.pct(deals.length ? won.length / deals.length * 100 : 0, 0), icon: 'target', tone: 'violet' },
          { label: 'Прогноз выручки', value: U.moneyShort(U.sum(active, function (d) { return d.amount * d.probability / 100; })), icon: 'trend', tone: 'warn',
            meta: 'с учётом вероятности' }
        ], 4),
        el('div.mt-4', null, [board])
      ]
    });
  }

  function openDeal(d) {
    UI.modal({
      title: d.title,
      size: 'lg',
      body: [
        UI.kv([
          ['Клиент', H.cpName(d.counterpartyId)],
          ['Сумма сделки', U.money(d.amount)],
          ['Стадия', UI.status(d.stage)],
          ['Вероятность', U.pct(d.probability, 0)],
          ['Менеджер', d.manager],
          ['Следующий шаг', d.nextStep],
          ['Дата шага', U.fmtDate(d.nextDate)],
          ['Создана', U.fmtDate(d.date)]
        ]),
        el('h4.mt-4.mb-2', { text: 'История общения' }),
        UI.timeline((d.activities || []).map(function (a) {
          return { action: a.text, name: { call: 'Звонок', email: 'Email', meet: 'Встреча' }[a.type] || a.type, ts: a.ts, state: 'done' };
        })),
        App.Auth.canEdit('crm') ? el('div.mt-4', null, [
          UI.btn('Добавить активность', { size: 'sm', icon: 'plus', onClick: function () { addActivity(d); } })
        ]) : null
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        App.Auth.canEdit('crm') ? { text: 'Изменить', kind: 'primary', icon: 'edit', onClick: function () { editDeal(d); } } : null
      ].filter(Boolean)
    });
  }

  function addActivity(d) {
    UI.formModal({
      title: 'Активность по сделке', size: 'sm',
      values: { type: 'call' },
      fields: [
        { k: 'type', t: 'Тип', type: 'select', empty: false, options: [
          { v: 'call', t: 'Звонок' }, { v: 'email', t: 'Email' }, { v: 'meet', t: 'Встреча' }
        ] },
        { k: 'text', t: 'Описание', type: 'textarea', required: true }
      ],
      onSave: function (v) {
        const acts = (d.activities || []).concat([{ ts: new Date().toISOString(), type: v.type, text: v.text }]);
        App.Store.update('deals', d.id, { activities: acts });
        UI.toast({ kind: 'ok', title: 'Активность добавлена' });
        App.Router.render();
      }
    });
  }

  function editDeal(d) {
    UI.formModal({
      title: d ? 'Сделка' : 'Новая сделка',
      values: d || { stage: 'new', probability: 10, date: U.today(), nextDate: U.iso(U.addDays(new Date(), 3)), manager: (App.Auth.user() || {}).fullName },
      fields: [
        { k: 'title', t: 'Название сделки', required: true, col: 12 },
        { k: 'counterpartyId', t: 'Клиент', type: 'select', options: H.cpOptions('client'), required: true, col: 6 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', required: true, col: 6 },
        { k: 'stage', t: 'Стадия', type: 'select', col: 6, empty: false,
          options: STAGES.map(function (s) { return { v: s.id, t: s.t }; }) },
        { k: 'manager', t: 'Менеджер', col: 6 },
        { k: 'nextStep', t: 'Следующий шаг', col: 6 },
        { k: 'nextDate', t: 'Дата шага', type: 'date', col: 6 }
      ],
      onSave: function (v) {
        v.probability = { new: 10, contact: 25, offer: 50, negotiation: 75, won: 100, lost: 0 }[v.stage];
        if (d) App.Store.update('deals', d.id, v);
        else App.Store.insert('deals', Object.assign({ activities: [], date: U.today() }, v));
        UI.toast({ kind: 'ok', title: 'Сделка сохранена' });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ЗАДАЧИ
     ====================================================================== */
  function tasks() {
    const canEdit = App.Auth.canEdit('crm');
    const rows = App.Store.all('tasks');
    const overdue = rows.filter(function (t) { return t.status !== 'done' && U.daysLeft(t.dueDate) < 0; });

    return UI.page({
      title: 'Задачи и напоминания',
      subtitle: 'Задачи менеджеров, контроль сроков',
      actions: canEdit ? [UI.btn('Новая задача', { kind: 'primary', icon: 'plus', onClick: function () { editTask(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Всего задач', value: rows.length, icon: 'clipboard', tone: 'info' },
          { label: 'В работе', value: rows.filter(function (t) { return t.status === 'progress'; }).length, icon: 'clock', tone: 'warn' },
          { label: 'Просрочено', value: overdue.length, icon: 'alert', tone: 'danger' },
          { label: 'Выполнено', value: rows.filter(function (t) { return t.status === 'done'; }).length, icon: 'checkCircle', tone: 'ok' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['title', 'assignee'],
            filters: [
              { k: 'status', t: 'Статус', options: UI.statusOptions(['new', 'progress', 'done']) },
              { k: 'priority', t: 'Приоритет', options: [{ v: 'high', t: 'высокий' }, { v: 'normal', t: 'обычный' }, { v: 'low', t: 'низкий' }] }
            ],
            columns: [
              { k: 'title', t: 'Задача' },
              { k: 'assignee', t: 'Исполнитель', w: '220px', render: function (t) {
                return el('div.row', { style: { gap: '8px' } }, [el('span.avatar.avatar--sm', { text: U.initials(t.assignee) }), el('span.truncate', { text: t.assignee })]);
              } },
              { k: 'dueDate', t: 'Срок', w: '130px', render: function (t) {
                const left = U.daysLeft(t.dueDate);
                if (t.status === 'done') return U.fmtDate(t.dueDate);
                return el('div', null, [U.fmtDate(t.dueDate),
                  el('div.fs-xs', { class: left < 0 ? 'down' : 'muted-2', text: left < 0 ? 'просрочена' : 'осталось ' + left + ' дн.' })]);
              } },
              { k: 'priority', t: 'Приоритет', w: '120px', render: function (t) {
                return UI.badge({ high: 'высокий', normal: 'обычный', low: 'низкий' }[t.priority],
                  t.priority === 'high' ? 'danger' : t.priority === 'normal' ? 'info' : '');
              } },
              { k: 'status', t: 'Статус', w: '120px', render: function (t) { return UI.status(t.status); } },
              { id: 'act', t: '', w: '110px', sortable: false, render: function (t) {
                return UI.rowActions([
                  canEdit && t.status !== 'done' ? { icon: 'check', title: 'Выполнено', onClick: function () {
                    App.Store.update('tasks', t.id, { status: 'done' });
                    UI.toast({ kind: 'ok', title: 'Задача выполнена' });
                    App.Router.render();
                  } } : null,
                  canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editTask(t); } } : null
                ]);
              } }
            ],
            rows: rows, sort: { k: 'dueDate', dir: 'asc' }, pageSize: 15, exportName: 'tasks.csv',
            rowClass: function (t) { return t.status !== 'done' && U.daysLeft(t.dueDate) < 0 ? 'is-danger' : ''; },
            dangerRows: true
          })]
        })])
      ]
    });
  }

  function editTask(t) {
    UI.formModal({
      title: t ? 'Задача' : 'Новая задача',
      values: t || { status: 'new', priority: 'normal', dueDate: U.iso(U.addDays(new Date(), 3)), assignee: (App.Auth.user() || {}).fullName },
      fields: [
        { k: 'title', t: 'Задача', required: true, col: 12 },
        { k: 'assignee', t: 'Исполнитель', type: 'select', options: H.userOptions(), required: true, col: 6 },
        { k: 'dueDate', t: 'Срок', type: 'date', required: true, col: 6 },
        { k: 'priority', t: 'Приоритет', type: 'select', col: 6, empty: false,
          options: [{ v: 'high', t: 'Высокий' }, { v: 'normal', t: 'Обычный' }, { v: 'low', t: 'Низкий' }] },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false, options: UI.statusOptions(['new', 'progress', 'done']) }
      ],
      onSave: function (v) {
        if (t) App.Store.update('tasks', t.id, v);
        else App.Store.insert('tasks', v);
        UI.toast({ kind: 'ok', title: 'Задача сохранена' });
        App.Router.render();
      }
    });
  }

  /* --- Маршруты --------------------------------------------------------------- */
  App.Router.add('sales', { title: 'Продажи', module: 'sales', render: sales });
  App.Router.add('returns', { title: 'Возвраты', module: 'sales', render: returns });
  App.Router.add('counterparties', { title: 'Контрагенты', module: 'counterparties', render: counterparties });
  App.Router.add('crm', { title: 'CRM', module: 'crm', render: crm });
  App.Router.add('tasks', { title: 'Задачи', module: 'crm', render: tasks });
})(window.App);

/* =============================================================================
   МОДУЛЬ: Складской учёт · Закупки
   ТЗ п. 9, 10
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* =========================================================================
     ТОВАРЫ
     ====================================================================== */
  function products() {
    const canEdit = App.Auth.canEdit('warehouse');
    const rows = H.stockRows();

    const tbl = UI.table({
      search: ['name', 'sku', 'barcode', 'category'],
      searchPlaceholder: 'Поиск по названию, артикулу, штрихкоду…',
      filters: [
        { k: 'categoryId', t: 'Категория', options: H.categoryOptions() },
        { k: 'low', t: 'Запас', options: [{ v: 'low', t: 'ниже минимума' }, { v: 'zero', t: 'нулевой остаток' }],
          test: function (r, v) { return v === 'low' ? r.low : r.zero; } }
      ],
      columns: [
        { k: 'sku', t: 'Артикул', w: '110px', render: function (r) { return el('span.mono', { text: r.sku }); } },
        { k: 'name', t: 'Наименование', render: function (r) {
          return el('div', null, [
            el('div.strong', { text: r.name }),
            el('div.fs-xs.muted-2', { text: r.category + ' · ' + r.barcode })
          ]);
        } },
        { k: 'unit', t: 'Ед.', w: '70px' },
        { k: 'qty', t: 'Остаток', num: true, render: function (r) {
          return el('span', { class: 'num ' + (r.zero ? 'down' : r.low ? '' : ''), text: U.num(r.qty, 0) });
        } },
        { k: 'minStock', t: 'Мин. запас', num: true },
        { k: 'cost', t: 'Себестоимость', num: true, render: function (r) { return U.money(r.cost, { digits: 0 }); } },
        { k: 'price', t: 'Цена продажи', num: true, render: function (r) { return U.money(r.price, { digits: 0 }); } },
        { id: 'margin', t: 'Наценка', num: true, sort: function (r) { return r.cost ? (r.price - r.cost) / r.cost : 0; },
          render: function (r) { return U.pct(r.cost ? (r.price - r.cost) / r.cost * 100 : 0, 0); } },
        { k: 'value', t: 'Стоимость запаса', num: true, render: function (r) { return U.money(r.value, { digits: 0 }); } },
        { id: 'st', t: 'Статус', w: '130px', sortable: false, render: function (r) {
          if (r.zero) return UI.badge('нет в наличии', 'danger');
          if (r.low) return UI.badge('ниже минимума', 'warn');
          return UI.badge('в наличии', 'ok');
        } },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
          return UI.rowActions([
            { icon: 'eye', title: 'Карточка товара', onClick: function () { productCard(r.id); } },
            canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editProduct(App.Store.get('products', r.id)); } } : null,
            canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
              UI.confirm({ title: 'Удалить товар?', danger: true, text: r.name + ' будет удалён из справочника.', onOk: function () {
                App.Store.remove('products', r.id); UI.toast({ kind: 'ok', title: 'Товар удалён' }); App.Router.render();
              } });
            } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'name', dir: 'asc' },
      pageSize: 15,
      exportName: 'products.csv',
      onRow: function (r) { productCard(r.id); },
      rowClass: function (r) { return r.zero ? 'is-danger' : ''; },
      dangerRows: true,
      totals: {
        value: function (rs) { return U.money(U.sum(rs, function (r) { return r.value; }), { digits: 0 }); },
        qty: function (rs) { return U.num(U.sum(rs, function (r) { return r.qty; }), 0); }
      }
    });

    return UI.page({
      title: 'Товары',
      subtitle: 'Номенклатура, категории, штрихкоды, цены',
      actions: canEdit ? [
        UI.btn('Новый товар', { kind: 'primary', icon: 'plus', onClick: function () { editProduct(null); } }),
        UI.btn('Поиск по штрихкоду', { icon: 'barcode', onClick: scanBarcode })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Позиций в справочнике', value: rows.length, icon: 'box', tone: 'info' },
          { label: 'Стоимость запасов', value: U.moneyShort(U.sum(rows, function (r) { return r.value; })), icon: 'wallet', tone: 'violet' },
          { label: 'Ниже минимума', value: rows.filter(function (r) { return r.low && !r.zero; }).length, icon: 'alert', tone: 'warn' },
          { label: 'Нет в наличии', value: rows.filter(function (r) { return r.zero; }).length, icon: 'xCircle', tone: 'danger' }
        ], 4),
        el('div.mt-4', null, [UI.card({ title: 'Справочник товаров', flush: true, body: [tbl] })])
      ]
    });
  }

  const MAX_MONEY = 1e9;

  /** Контрольная цифра EAN-13 по первым 12 цифрам */
  function eanCheckDigit(d12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
    return String((10 - sum % 10) % 10);
  }
  function newBarcode() {
    const body = '48' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
    return body + eanCheckDigit(body);
  }
  function validEan13(s) { return /^\d{13}$/.test(s) && eanCheckDigit(s.slice(0, 12)) === s[12]; }

  /** Сообщение, если значение поля уже занято другим товаром */
  function dupError(field, id, label) {
    return function (v) {
      if (!v) return '';
      const dup = App.Store.all('products').some(function (x) { return x.id !== id && String(x[field]) === String(v); });
      return dup ? label + ' уже используется другим товаром' : '';
    };
  }

  function editProduct(p) {
    const pid = p ? p.id : null;
    const skuDup = dupError('sku', pid, 'Артикул');
    const barcodeDup = dupError('barcode', pid, 'Штрихкод');
    UI.formModal({
      title: p ? p.name : 'Новый товар',
      values: p || { unit: 'шт', vat: 12, minStock: 5, active: true, barcode: newBarcode() },
      fields: [
        { k: 'name', t: 'Наименование', required: true, col: 12, maxLength: 255 },
        { k: 'sku', t: 'Артикул', required: true, col: 4, maxLength: 40, validate: skuDup },
        { k: 'barcode', t: 'Штрихкод (EAN-13)', col: 4,
          validate: function (v) {
            if (!v || (p && v === p.barcode)) return '';
            if (!validEan13(v)) return 'Нужно 13 цифр с верной контрольной цифрой';
            return barcodeDup(v);
          } },
        { k: 'categoryId', t: 'Категория', type: 'select', options: H.categoryOptions(), required: true, col: 4 },
        { k: 'unit', t: 'Единица измерения', type: 'select', col: 4, empty: false,
          options: App.Store.all('units').map(function (u) { return { v: u.name, t: u.name }; }) },
        { k: 'cost', t: 'Себестоимость, сом', type: 'money', required: true, col: 4, min: 0, max: MAX_MONEY,
          validate: function (v) { return v === 0 ? 'Должна быть больше 0' : ''; } },
        { k: 'price', t: 'Цена продажи, сом', type: 'money', required: true, col: 4, min: 0, max: MAX_MONEY,
          validate: function (v, all) {
            if (v === 0) return 'Должна быть больше 0';
            return v !== null && all.cost !== null && v < all.cost ? 'Цена ниже себестоимости' : '';
          } },
        { k: 'vat', t: 'НДС, %', type: 'number', required: true, col: 4, min: 0, max: 100 },
        { k: 'minStock', t: 'Минимальный запас', type: 'number', required: true, col: 4, min: 0, max: MAX_MONEY },
        { k: 'active', t: 'Активен', type: 'checkbox', col: 4 }
      ],
      onSave: function (v) {
        if (p) App.Store.update('products', p.id, v);
        else App.Store.insert('products', v);
        UI.toast({ kind: 'ok', title: 'Товар сохранён', text: v.name });
        App.Router.render();
      }
    });
  }

  function productCard(id) {
    const p = App.Store.get('products', id);
    if (!p) return;
    const moves = App.Store.all('stockMoves').filter(function (m) { return m.productId === id; });
    const byWh = App.Store.all('stock').filter(function (s) { return s.productId === id; });

    UI.modal({
      title: p.name,
      size: 'xl',
      body: [UI.tabs([
        {
          id: 'info', title: 'Карточка', render: function () {
            return el('div.grid.grid--2', null, [
              UI.kv([
                ['Артикул', p.sku], ['Штрихкод', el('span.mono', { text: p.barcode })],
                ['Категория', H.categoryName(p.categoryId)], ['Единица', p.unit],
                ['Себестоимость', U.money(p.cost)], ['Цена продажи', U.money(p.price)],
                ['Наценка', U.pct(p.cost ? (p.price - p.cost) / p.cost * 100 : 0)],
                ['НДС', U.pct(p.vat, 0)], ['Минимальный запас', p.minStock === null || p.minStock === undefined ? '—' : p.minStock + ' ' + p.unit]
              ]),
              UI.card({
                title: 'Остатки по складам',
                body: [byWh.length ? el('div.col', null, byWh.map(function (s) {
                  return UI.meter({
                    label: H.warehouseName(s.warehouseId), value: s.qty, max: Math.max(p.minStock * 4, s.qty || 1),
                    text: U.num(s.qty, 0) + ' ' + p.unit, tone: s.qty === 0 ? 'danger' : s.qty <= p.minStock ? 'warn' : 'ok'
                  });
                })) : el('p.muted-2', { text: 'Нет данных об остатках' })]
              })
            ]);
          }
        },
        {
          id: 'moves', title: 'Движения (' + moves.length + ')', render: function () {
            return moves.length ? UI.table({
              columns: [
                { k: 'date', t: 'Дата', w: '110px', render: function (m) { return U.fmtDate(m.date); } },
                { k: 'number', t: '№', w: '100px' },
                { k: 'type', t: 'Операция', render: function (m) { return moveType(m.type); } },
                { k: 'qty', t: 'Кол-во', num: true, render: function (m) { return U.num(m.qty, 0) + ' ' + m.unit; } },
                { k: 'amount', t: 'Сумма', num: true, render: function (m) { return U.money(m.amount, { digits: 0 }); } }
              ], rows: moves, sort: { k: 'date', dir: 'desc' }, pageSize: 10, exportName: false
            }) : UI.empty({ icon: 'archive', title: 'Движений нет' });
          }
        },
        {
          id: 'sales', title: 'Продажи', render: function () {
            const sales = App.Store.all('sales').filter(function (s) {
              return s.items.some(function (i) { return i.productId === id; });
            });
            const qty = U.sum(sales, function (s) {
              return U.sum(s.items.filter(function (i) { return i.productId === id; }), function (i) { return i.qty; });
            });
            return el('div.col', null, [
              UI.statGrid([
                { label: 'Продано всего', value: U.num(qty, 0) + ' ' + p.unit, tone: 'ok' },
                { label: 'В документах', value: sales.length, tone: 'info' },
                { label: 'Выручка', value: U.moneyShort(qty * p.price), tone: 'violet' }
              ], 3),
              sales.length ? UI.table({
                columns: [
                  { k: 'date', t: 'Дата', render: function (s) { return U.fmtDate(s.date); } },
                  { k: 'number', t: 'Документ' },
                  { id: 'cp', t: 'Клиент', render: function (s) { return H.cpName(s.counterpartyId); } },
                  { id: 'q', t: 'Кол-во', num: true, render: function (s) {
                    return U.num(U.sum(s.items.filter(function (i) { return i.productId === id; }), function (i) { return i.qty; }), 0);
                  } }
                ], rows: sales, pageSize: 8, exportName: false
              }) : UI.empty({ icon: 'cart', title: 'Продаж не было' })
            ]);
          }
        }
      ])]
    });
  }

  function moveType(t) {
    const map = { in: ['Поступление', 'ok'], out: ['Отгрузка', 'info'], move: ['Перемещение', 'warn'], writeoff: ['Списание', 'danger'] };
    const m = map[t] || [t, ''];
    return UI.badge(m[0], m[1]);
  }

  function scanBarcode() {
    const f = UI.form({ fields: [{ k: 'code', t: 'Штрихкод', required: true, placeholder: 'Отсканируйте или введите код' }] });
    UI.modal({
      title: 'Поиск товара по штрихкоду',
      size: 'sm',
      body: [
        el('div.center.mb-4', null, [App.Icons.get('barcode', '', 48)]),
        f.node,
        el('p.fs-sm.muted-2.mt-2', { text: 'Сканер работает как клавиатура: код подставляется автоматически.' })
      ],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Найти', kind: 'primary', icon: 'search', close: false, onClick: function () {
          if (!f.validate()) return;
          const code = f.read().code.trim();
          const p = App.Store.all('products').filter(function (x) { return x.barcode === code || x.sku === code; })[0];
          UI.closeModal();
          if (p) productCard(p.id);
          else UI.toast({ kind: 'warn', title: 'Товар не найден', text: 'Код ' + code + ' отсутствует в базе' });
        } }
      ]
    });
  }

  /* =========================================================================
     ОСТАТКИ ПО СКЛАДАМ
     ====================================================================== */
  function stockBalance() {
    const warehouses = App.Store.all('warehouses');
    const stock = App.Store.all('stock');
    const products = App.Store.all('products');

    const rows = products.map(function (p) {
      const r = { id: p.id, name: p.name, sku: p.sku, unit: p.unit, cost: p.cost, minStock: p.minStock, total: 0 };
      warehouses.forEach(function (w) {
        const s = stock.filter(function (x) { return x.productId === p.id && x.warehouseId === w.id; })[0];
        r['wh_' + w.id] = s ? s.qty : 0;
        r.total += s ? s.qty : 0;
      });
      r.value = r.total * p.cost;
      return r;
    });

    const columns = [
      { k: 'sku', t: 'Артикул', w: '110px', render: function (r) { return el('span.mono', { text: r.sku }); } },
      { k: 'name', t: 'Товар' },
      { k: 'unit', t: 'Ед.', w: '60px' }
    ].concat(warehouses.map(function (w) {
      return {
        k: 'wh_' + w.id, t: w.name, num: true,
        render: function (r) { return r['wh_' + w.id] ? U.num(r['wh_' + w.id], 0) : el('span.muted-2', { text: '—' }); }
      };
    })).concat([
      { k: 'total', t: 'Итого', num: true, render: function (r) { return el('strong', { text: U.num(r.total, 0) }); } },
      { k: 'value', t: 'Стоимость', num: true, render: function (r) { return U.money(r.value, { digits: 0 }); } }
    ]);

    const whStats = warehouses.map(function (w) {
      const val = U.sum(stock.filter(function (s) { return s.warehouseId === w.id; }), function (s) {
        const p = H.product(s.productId);
        return s.qty * (p ? p.cost : 0);
      });
      return { name: w.name + ' · ' + w.branch, value: val };
    });

    return UI.page({
      title: 'Остатки на складах',
      subtitle: 'Несколько складов и филиалов в одной ведомости',
      actions: [
        App.Auth.canEdit('warehouse') ? UI.btn('Новый склад', { icon: 'plus', onClick: editWarehouse }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid(warehouses.map(function (w, i) {
          const items = stock.filter(function (s) { return s.warehouseId === w.id && s.qty > 0; });
          return {
            label: w.name, value: items.length + ' позиций', icon: 'warehouse',
            tone: ['info', 'ok', 'violet'][i % 3],
            meta: w.branch + ' · ' + U.moneyShort(U.sum(items, function (s) {
              const p = H.product(s.productId);
              return s.qty * (p ? p.cost : 0);
            }))
          };
        }).concat([{
          label: 'Общая стоимость запасов', value: U.moneyShort(U.sum(rows, function (r) { return r.value; })),
          icon: 'wallet', tone: 'warn'
        }]), 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Ведомость остатков',
            flush: true,
            body: [UI.table({
              search: ['name', 'sku'],
              columns: columns,
              rows: rows,
              sort: { k: 'name', dir: 'asc' },
              pageSize: 20,
              exportName: 'stock-balance.csv',
              totals: {
                total: function (rs) { return U.num(U.sum(rs, function (r) { return r.total; }), 0); },
                value: function (rs) { return U.money(U.sum(rs, function (r) { return r.value; }), { digits: 0 }); }
              }
            })]
          }),
          UI.card({ title: 'Запасы по складам', body: [C.donut({ items: whStats, size: 180 })] })
        ])
      ]
    });
  }

  function editWarehouse() {
    UI.formModal({
      title: 'Новый склад',
      values: {},
      fields: [
        { k: 'name', t: 'Название склада', required: true, col: 6 },
        { k: 'branch', t: 'Филиал / город', required: true, col: 6 },
        { k: 'address', t: 'Адрес', col: 8 },
        { k: 'manager', t: 'Ответственный', col: 4 }
      ],
      onSave: function (v) {
        App.Store.insert('warehouses', v);
        UI.toast({ kind: 'ok', title: 'Склад создан', text: v.name });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ДВИЖЕНИЯ ТОВАРА
     ====================================================================== */
  function moves() {
    const canEdit = App.Auth.canEdit('warehouse');
    const rows = App.Store.all('stockMoves');

    return UI.page({
      title: 'Движения товара',
      subtitle: 'Приход, расход, перемещение между складами, списание',
      actions: canEdit ? [
        UI.btn('Приход', { kind: 'success', icon: 'arrowDown', onClick: function () { editMove({ type: 'in' }); } }),
        UI.btn('Расход', { icon: 'arrowUp', onClick: function () { editMove({ type: 'out' }); } }),
        UI.btn('Перемещение', { icon: 'refresh', onClick: function () { editMove({ type: 'move' }); } }),
        UI.btn('Списание', { kind: 'danger', icon: 'trash', onClick: function () { editMove({ type: 'writeoff' }); } })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Поступления', value: rows.filter(function (r) { return r.type === 'in'; }).length, icon: 'arrowDown', tone: 'ok' },
          { label: 'Отгрузки', value: rows.filter(function (r) { return r.type === 'out'; }).length, icon: 'arrowUp', tone: 'info' },
          { label: 'Перемещения', value: rows.filter(function (r) { return r.type === 'move'; }).length, icon: 'refresh', tone: 'warn' },
          { label: 'Списания', value: rows.filter(function (r) { return r.type === 'writeoff'; }).length, icon: 'trash', tone: 'danger',
            meta: U.moneyShort(U.sum(rows.filter(function (r) { return r.type === 'writeoff'; }), function (r) { return r.amount; })) }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['number', 'productName', 'reason'],
            searchPlaceholder: 'Поиск по товару, номеру, причине…',
            filters: [{ k: 'type', t: 'Операция', options: [
              { v: 'in', t: 'приход' }, { v: 'out', t: 'расход' }, { v: 'move', t: 'перемещение' }, { v: 'writeoff', t: 'списание' }
            ] }],
            columns: [
              { k: 'date', t: 'Дата', w: '110px', render: function (m) { return U.fmtDate(m.date); } },
              { k: 'number', t: '№', w: '100px' },
              { k: 'type', t: 'Операция', w: '140px', render: function (m) { return moveType(m.type); } },
              { k: 'productName', t: 'Товар' },
              { k: 'qty', t: 'Кол-во', num: true, render: function (m) { return U.num(m.qty, 0) + ' ' + m.unit; } },
              { id: 'wh', t: 'Склад', w: '190px', sortable: false, render: function (m) {
                if (m.type === 'move') return H.warehouseName(m.fromWarehouseId) + ' → ' + H.warehouseName(m.toWarehouseId);
                return H.warehouseName(m.toWarehouseId || m.fromWarehouseId);
              } },
              { k: 'amount', t: 'Сумма', num: true, render: function (m) { return U.money(m.amount, { digits: 0 }); } },
              { k: 'reason', t: 'Причина', w: '160px' },
              { k: 'author', t: 'Автор', w: '160px' }
            ],
            rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 20, exportName: 'stock-moves.csv'
          })]
        })])
      ]
    });
  }

  function editMove(m) {
    const type = m.type;
    const titles = { in: 'Поступление товара', out: 'Отгрузка товара', move: 'Перемещение между складами', writeoff: 'Списание товара' };
    UI.formModal({
      title: titles[type],
      values: Object.assign({ number: H.nextNumber('stockMoves', 'ДВ'), date: U.today(), qty: 1 }, m),
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'qty', t: 'Количество', type: 'number', required: true, col: 4, min: 0.001, step: '0.001' },
        { k: 'productId', t: 'Товар', type: 'select', options: H.productOptions(), required: true, col: 12 },
        type !== 'in' ? { k: 'fromWarehouseId', t: 'Склад-источник', type: 'select', options: H.warehouseOptions(), required: true, col: 6 } : null,
        type === 'in' || type === 'move' ? { k: 'toWarehouseId', t: 'Склад-получатель', type: 'select', options: H.warehouseOptions(), required: true, col: 6 } : null,
        { k: 'price', t: 'Цена, сом', type: 'money', col: 6 },
        type === 'writeoff' ? { k: 'reason', t: 'Причина списания', type: 'select', required: true, col: 6, options: [
          { v: 'Брак', t: 'Брак' }, { v: 'Истёк срок', t: 'Истёк срок годности' },
          { v: 'Порча при хранении', t: 'Порча при хранении' }, { v: 'Недостача', t: 'Недостача по инвентаризации' }
        ] } : null
      ].filter(Boolean),
      onSave: function (v) {
        const p = H.product(v.productId);
        v.type = type;
        v.productName = p ? p.name : '';
        v.unit = p ? p.unit : 'шт';
        v.price = v.price || (p ? (type === 'in' ? p.cost : p.price) : 0);
        v.amount = v.qty * v.price;
        v.author = (App.Auth.user() || {}).fullName;
        App.Store.insert('stockMoves', v);

        if (type === 'in') H.applyStock(v.productId, v.toWarehouseId, v.qty);
        else if (type === 'out' || type === 'writeoff') H.applyStock(v.productId, v.fromWarehouseId, -v.qty);
        else if (type === 'move') {
          H.applyStock(v.productId, v.fromWarehouseId, -v.qty);
          H.applyStock(v.productId, v.toWarehouseId, v.qty);
        }
        if (type === 'in') H.autoEntries('purchase', v.amount, v.date, null);

        UI.toast({ kind: 'ok', title: titles[type] + ' проведено', text: v.productName + ' · ' + U.num(v.qty, 0) + ' ' + v.unit });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ИНВЕНТАРИЗАЦИЯ
     ====================================================================== */
  function inventory() {
    const canEdit = App.Auth.canEdit('warehouse');
    const rows = App.Store.all('inventories');

    return UI.page({
      title: 'Инвентаризация',
      subtitle: 'Сверка фактических остатков с учётными данными',
      actions: canEdit ? [UI.btn('Новая инвентаризация', { kind: 'primary', icon: 'plus', onClick: newInventory })] : [],
      children: [
        UI.statGrid([
          { label: 'Всего инвентаризаций', value: rows.length, icon: 'clipboard', tone: 'info' },
          { label: 'Завершено', value: rows.filter(function (r) { return r.status === 'done'; }).length, icon: 'checkCircle', tone: 'ok' },
          { label: 'В работе', value: rows.filter(function (r) { return r.status === 'draft'; }).length, icon: 'clock', tone: 'warn' },
          { label: 'Сумма расхождений', value: U.moneyShort(U.sum(rows, function (r) {
            return U.sum(r.lines, function (l) { return l.diff * l.price; });
          })), icon: 'scale', tone: 'danger' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['number', 'responsible'],
            columns: [
              { k: 'number', t: '№', w: '110px' },
              { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
              { k: 'warehouseId', t: 'Склад', render: function (r) { return H.warehouseName(r.warehouseId); } },
              { k: 'responsible', t: 'Ответственный' },
              { id: 'lines', t: 'Позиций', num: true, render: function (r) { return r.lines.length; } },
              { id: 'diff', t: 'Расхождение', num: true, sort: function (r) { return U.sum(r.lines, function (l) { return l.diff * l.price; }); },
                render: function (r) {
                  const d = U.sum(r.lines, function (l) { return l.diff * l.price; });
                  return H.moneyCell(d, { colorize: true, digits: 0 });
                } },
              { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } },
              { id: 'act', t: '', w: '60px', sortable: false, render: function (r) {
                return UI.rowActions([{ icon: 'eye', title: 'Открыть ведомость', onClick: function () { openInventory(r); } }]);
              } }
            ],
            rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 12, exportName: 'inventories.csv',
            onRow: openInventory
          })]
        })])
      ]
    });
  }

  function openInventory(inv) {
    const canEdit = App.Auth.canEdit('warehouse') && inv.status === 'draft';
    const total = U.sum(inv.lines, function (l) { return l.diff * l.price; });

    UI.modal({
      title: 'Инвентаризационная ведомость ' + inv.number,
      size: 'xl',
      body: [
        UI.kv([
          ['Склад', H.warehouseName(inv.warehouseId)],
          ['Дата', U.fmtDate(inv.date)],
          ['Ответственный', inv.responsible],
          ['Статус', UI.status(inv.status)],
          ['Итоговое расхождение', H.moneyCell(total, { colorize: true, digits: 0 })]
        ]),
        el('div.mt-4', null, [UI.table({
          columns: [
            { k: 'name', t: 'Товар' },
            { k: 'accounted', t: 'По учёту', num: true },
            { k: 'fact', t: 'Фактически', num: true, render: function (l) {
              if (!canEdit) return U.num(l.fact, 0);
              return el('input.input', {
                type: 'number', value: l.fact, style: { width: '90px', height: '30px', minHeight: '30px' },
                onchange: function (e) {
                  l.fact = Number(e.target.value);
                  l.diff = l.fact - l.accounted;
                  App.Store.update('inventories', inv.id, { lines: inv.lines }, { silent: true });
                  App.Store.persist();
                }
              });
            } },
            { k: 'diff', t: 'Расхождение', num: true, render: function (l) {
              return el('span', { class: 'num ' + (l.diff > 0 ? 'up' : l.diff < 0 ? 'down' : 'muted-2'), text: (l.diff > 0 ? '+' : '') + U.num(l.diff, 0) });
            } },
            { k: 'price', t: 'Цена', num: true, render: function (l) { return U.money(l.price, { digits: 0 }); } },
            { id: 'sum', t: 'Сумма', num: true, render: function (l) { return H.moneyCell(l.diff * l.price, { colorize: true, digits: 0 }); } }
          ],
          rows: inv.lines, pageSize: 0, exportName: 'inventory-' + inv.number + '.csv'
        })])
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        canEdit ? { text: 'Завершить и списать расхождения', kind: 'primary', icon: 'check', onClick: function () {
          inv.lines.forEach(function (l) {
            if (l.diff !== 0) H.applyStock(l.productId, inv.warehouseId, l.diff);
          });
          App.Store.update('inventories', inv.id, { status: 'done' });
          App.Store.logAction('завершил инвентаризацию ' + inv.number, 'inventories', inv);
          UI.toast({ kind: 'ok', title: 'Инвентаризация завершена', text: 'Остатки скорректированы' });
          App.Router.render();
        } } : null
      ].filter(Boolean)
    });
  }

  function newInventory() {
    UI.formModal({
      title: 'Новая инвентаризация',
      values: { number: H.nextNumber('inventories', 'ИНВ'), date: U.today(), status: 'draft', responsible: (App.Auth.user() || {}).fullName },
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'warehouseId', t: 'Склад', type: 'select', options: H.warehouseOptions(), required: true, col: 4 },
        { k: 'responsible', t: 'Ответственный', required: true, col: 12 }
      ],
      onSave: function (v) {
        const stock = App.Store.all('stock').filter(function (s) { return s.warehouseId === v.warehouseId && s.qty > 0; });
        v.lines = stock.slice(0, 20).map(function (s) {
          const p = H.product(s.productId);
          return { productId: s.productId, name: p ? p.name : '', unit: p ? p.unit : 'шт', accounted: s.qty, fact: s.qty, diff: 0, price: p ? p.cost : 0 };
        });
        const rec = App.Store.insert('inventories', v);
        UI.toast({ kind: 'ok', title: 'Инвентаризация создана', text: v.lines.length + ' позиций к пересчёту' });
        openInventory(rec);
      }
    });
  }

  /* =========================================================================
     ЗАКУПКИ
     ====================================================================== */
  function purchases() {
    const canEdit = App.Auth.canEdit('purchases');
    const requests = App.Store.all('purchaseRequests');
    const orders = App.Store.all('purchaseOrders');

    const priceHistory = {};
    orders.forEach(function (o) {
      o.items.forEach(function (i) {
        (priceHistory[i.productId] = priceHistory[i.productId] || []).push({ date: o.date, price: i.price, supplier: o.supplierId });
      });
    });

    const supplierStats = Object.keys(U.groupBy(orders, function (o) { return o.supplierId; })).map(function (sid) {
      const list = orders.filter(function (o) { return o.supplierId === sid; });
      return {
        id: sid, name: H.cpName(sid), orders: list.length,
        amount: U.sum(list, function (o) { return o.amount; }),
        avgDays: Math.round(U.sum(list, function (o) { return U.daysBetween(o.date, o.deliveryDate); }) / list.length),
        received: list.filter(function (o) { return o.status === 'received'; }).length
      };
    }).sort(function (a, b) { return b.amount - a.amount; });

    return UI.page({
      title: 'Управление закупками',
      subtitle: 'Заявки, заказы поставщикам, приём товара, контроль цен',
      actions: canEdit ? [
        UI.btn('Заявка на закупку', { icon: 'plus', onClick: function () { editRequest(null); } }),
        UI.btn('Заказ поставщику', { kind: 'primary', icon: 'truck', onClick: function () { editOrder(null); } })
      ] : [],
      children: [
        UI.statGrid([
          { label: 'Заявок на закупку', value: requests.length, icon: 'clipboard', tone: 'info',
            meta: requests.filter(function (r) { return r.status === 'new' || r.status === 'review'; }).length + ' в обработке' },
          { label: 'Заказов поставщикам', value: orders.length, icon: 'truck', tone: 'violet' },
          { label: 'Сумма закупок', value: U.moneyShort(U.sum(orders, function (o) { return o.amount; })), icon: 'wallet', tone: 'warn' },
          { label: 'Ожидают поставки', value: orders.filter(function (o) { return o.status === 'sent'; }).length, icon: 'clock', tone: 'warn' }
        ], 4),

        el('div.mt-4', null, [UI.tabs([
          {
            id: 'orders', title: 'Заказы поставщикам', count: orders.length,
            render: function () {
              return UI.card({
                flush: true,
                body: [UI.table({
                  search: ['number', function (o) { return H.cpName(o.supplierId); }],
                  filters: [{ k: 'status', t: 'Статус', options: UI.statusOptions(['new', 'sent', 'received', 'cancelled']) }],
                  columns: [
                    { k: 'number', t: '№', w: '100px' },
                    { k: 'date', t: 'Дата', w: '110px', render: function (o) { return U.fmtDate(o.date); } },
                    { k: 'supplierId', t: 'Поставщик', render: function (o) { return H.cpName(o.supplierId); },
                      sort: function (o) { return H.cpName(o.supplierId); } },
                    { id: 'items', t: 'Позиций', num: true, render: function (o) { return o.items.length; } },
                    { k: 'amount', t: 'Сумма', num: true, render: function (o) { return U.money(o.amount, { digits: 0 }); } },
                    { k: 'paid', t: 'Оплачено', num: true, render: function (o) { return o.paid ? U.money(o.paid, { digits: 0 }) : el('span.down', { text: 'нет' }); } },
                    { k: 'deliveryDate', t: 'Поставка', w: '120px', render: function (o) { return U.fmtDate(o.deliveryDate); } },
                    { k: 'status', t: 'Статус', w: '130px', render: function (o) { return UI.status(o.status); } },
                    { id: 'act', t: '', w: '110px', sortable: false, render: function (o) {
                      return UI.rowActions([
                        { icon: 'eye', title: 'Открыть заказ', onClick: function () { openOrder(o); } },
                        canEdit && o.status === 'sent' ? { icon: 'check', title: 'Принять товар', onClick: function () { receiveOrder(o); } } : null
                      ]);
                    } }
                  ],
                  rows: orders, sort: { k: 'date', dir: 'desc' }, pageSize: 15, exportName: 'purchase-orders.csv',
                  onRow: openOrder
                })]
              });
            }
          },
          {
            id: 'requests', title: 'Заявки', count: requests.length,
            render: function () {
              return UI.card({
                flush: true,
                body: [UI.table({
                  search: ['number', 'productName', 'author'],
                  filters: [{ k: 'status', t: 'Статус', options: UI.statusOptions(['new', 'review', 'approved', 'done', 'rejected']) }],
                  columns: [
                    { k: 'number', t: '№', w: '100px' },
                    { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
                    { k: 'productName', t: 'Товар' },
                    { k: 'qty', t: 'Кол-во', num: true, render: function (r) { return U.num(r.qty, 0) + ' ' + r.unit; } },
                    { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
                    { k: 'need', t: 'Нужно к', w: '120px', render: function (r) { return U.fmtDate(r.need); } },
                    { k: 'author', t: 'Инициатор' },
                    { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } },
                    { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
                      return UI.rowActions([
                        canEdit && r.status !== 'done' ? { icon: 'check', title: 'Одобрить', onClick: function () {
                          App.Store.update('purchaseRequests', r.id, { status: 'approved' });
                          UI.toast({ kind: 'ok', title: 'Заявка одобрена' });
                          App.Router.render();
                        } } : null,
                        canEdit ? { icon: 'truck', title: 'Создать заказ поставщику', onClick: function () { editOrder(null, r); } } : null
                      ]);
                    } }
                  ],
                  rows: requests, sort: { k: 'date', dir: 'desc' }, pageSize: 15, exportName: 'purchase-requests.csv'
                })]
              });
            }
          },
          {
            id: 'analytics', title: 'Аналитика закупок',
            render: function () {
              const dyn = H.monthly('purchaseOrders', 'date', function (o) { return o.status === 'cancelled' ? 0 : o.amount; }, 12);
              return el('div.col', null, [
                el('div.grid.grid--2', null, [
                  UI.card({
                    title: 'Динамика закупок',
                    body: [C.bars({ labels: dyn.labels, height: 220, series: [{ name: 'Закупки', values: dyn.values, color: 'var(--c3)' }] })]
                  }),
                  UI.card({
                    title: 'Сравнение поставщиков',
                    body: [C.hbars({ items: supplierStats.slice(0, 8).map(function (s) { return { name: s.name, value: s.amount }; }) })]
                  })
                ]),
                UI.card({
                  title: 'Рейтинг поставщиков',
                  flush: true,
                  body: [UI.table({
                    columns: [
                      { k: 'name', t: 'Поставщик' },
                      { k: 'orders', t: 'Заказов', num: true },
                      { k: 'amount', t: 'Сумма закупок', num: true, render: function (s) { return U.money(s.amount, { digits: 0 }); } },
                      { k: 'received', t: 'Выполнено', num: true },
                      { k: 'avgDays', t: 'Срок поставки', num: true, render: function (s) { return s.avgDays + ' дн.'; } },
                      { id: 'rate', t: 'Надёжность', w: '160px', sortable: false, render: function (s) {
                        const p = s.orders ? s.received / s.orders * 100 : 0;
                        return el('div', null, [UI.progress(p, 100, p > 70 ? 'ok' : p > 40 ? 'warn' : 'danger'), el('span.fs-xs.muted-2', { text: U.pct(p, 0) })]);
                      } }
                    ],
                    rows: supplierStats, pageSize: 12, exportName: 'suppliers.csv'
                  })]
                }),
                UI.card({
                  title: 'Изменение закупочных цен',
                  flush: true,
                  body: [UI.table({
                    columns: [
                      { k: 'name', t: 'Товар' },
                      { k: 'first', t: 'Первая цена', num: true, render: function (r) { return U.money(r.first, { digits: 0 }); } },
                      { k: 'last', t: 'Последняя цена', num: true, render: function (r) { return U.money(r.last, { digits: 0 }); } },
                      { k: 'delta', t: 'Изменение', num: true, render: function (r) {
                        return el('span', { class: 'num ' + (r.delta > 0 ? 'down' : 'up'), text: (r.delta > 0 ? '+' : '') + U.pct(r.delta, 1) });
                      } },
                      { k: 'count', t: 'Закупок', num: true }
                    ],
                    rows: Object.keys(priceHistory).map(function (pid) {
                      const list = U.sortBy(priceHistory[pid], function (x) { return x.date; }, 'asc');
                      const first = list[0].price, last = list[list.length - 1].price;
                      return {
                        name: H.productName(pid), first: first, last: last,
                        delta: first ? (last - first) / first * 100 : 0, count: list.length
                      };
                    }).filter(function (r) { return r.count > 1; }),
                    sort: { k: 'delta', dir: 'desc' }, pageSize: 12, exportName: 'price-history.csv'
                  })]
                })
              ]);
            }
          }
        ])])
      ]
    });
  }

  function editRequest(r) {
    UI.formModal({
      title: r ? 'Заявка ' + r.number : 'Заявка на закупку',
      values: r || { number: H.nextNumber('purchaseRequests', 'ЗК'), date: U.today(), status: 'new', qty: 1, author: (App.Auth.user() || {}).fullName },
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'need', t: 'Нужно к дате', type: 'date', col: 4 },
        { k: 'productId', t: 'Товар', type: 'select', options: H.productOptions(), required: true, col: 8 },
        { k: 'qty', t: 'Количество', type: 'number', required: true, col: 4, min: 1 },
        { k: 'author', t: 'Инициатор', col: 6 },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false, options: UI.statusOptions(['new', 'review', 'approved', 'done', 'rejected']) },
        { k: 'comment', t: 'Обоснование', type: 'textarea', col: 12 }
      ],
      onSave: function (v) {
        const p = H.product(v.productId);
        v.productName = p ? p.name : '';
        v.unit = p ? p.unit : 'шт';
        v.amount = v.qty * (p ? p.cost : 0);
        if (r) App.Store.update('purchaseRequests', r.id, v);
        else App.Store.insert('purchaseRequests', v);
        UI.toast({ kind: 'ok', title: 'Заявка сохранена', text: v.number });
        App.Router.render();
      }
    });
  }

  function editOrder(o, fromRequest) {
    const items = (o && o.items) ? o.items.slice() : (fromRequest ? [{
      productId: fromRequest.productId, name: fromRequest.productName, unit: fromRequest.unit,
      qty: fromRequest.qty, price: (H.product(fromRequest.productId) || {}).cost || 0,
      sum: fromRequest.amount
    }] : []);

    const itemsBox = el('div.col');
    function drawItems() {
      U.clear(itemsBox);
      itemsBox.appendChild(el('div.form-section', { text: 'Позиции заказа' }));
      if (!items.length) itemsBox.appendChild(el('p.muted-2', { text: 'Позиции не добавлены' }));
      items.forEach(function (it, idx) {
        itemsBox.appendChild(el('div.row', null, [
          el('div.grow.truncate', { text: it.name }),
          el('span.fs-sm.muted', { text: U.num(it.qty, 0) + ' ' + it.unit + ' × ' + U.money(it.price, { digits: 0 }) }),
          el('strong', { text: U.money(it.sum, { digits: 0 }) }),
          UI.iconBtn('trash', 'Удалить позицию', function () { items.splice(idx, 1); drawItems(); }, 'danger')
        ]));
      });
      itemsBox.appendChild(el('div.row.mt-2', null, [
        UI.btn('Добавить позицию', { size: 'sm', icon: 'plus', onClick: addItem }),
        el('div.grow'),
        el('strong', { text: 'Итого: ' + U.money(U.sum(items, function (i) { return i.sum; }), { digits: 0 }) })
      ]));
    }

    function addItem() {
      const f = UI.form({
        fields: [
          { k: 'productId', t: 'Товар', type: 'select', options: H.productOptions(), required: true },
          { k: 'qty', t: 'Количество', type: 'number', required: true, col: 6, min: 1 },
          { k: 'price', t: 'Цена закупки', type: 'money', required: true, col: 6 }
        ],
        values: { qty: 1 }
      });
      UI.modal({
        title: 'Позиция заказа', size: 'sm', body: f.node,
        buttons: [
          { text: 'Отмена', kind: 'ghost' },
          { text: 'Добавить', kind: 'primary', onClick: function () {
            if (!f.validate()) return false;
            const v = f.read();
            const p = H.product(v.productId);
            items.push({ productId: v.productId, name: p.name, unit: p.unit, qty: v.qty, price: v.price, sum: v.qty * v.price });
            drawItems();
          } }
        ]
      });
    }

    drawItems();

    const f = UI.form({
      fields: [
        { k: 'number', t: 'Номер заказа', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'deliveryDate', t: 'Дата поставки', type: 'date', required: true, col: 4 },
        { k: 'supplierId', t: 'Поставщик', type: 'select', options: H.cpOptions('supplier'), required: true, col: 8 },
        { k: 'status', t: 'Статус', type: 'select', col: 4, empty: false, options: UI.statusOptions(['new', 'sent', 'received', 'cancelled']) },
        { k: 'manager', t: 'Ответственный', col: 12 }
      ],
      values: o || {
        number: H.nextNumber('purchaseOrders', 'ЗП'), date: U.today(),
        deliveryDate: U.iso(U.addDays(new Date(), 7)), status: 'new',
        manager: (App.Auth.user() || {}).fullName
      }
    });

    UI.modal({
      title: o ? 'Заказ ' + o.number : 'Заказ поставщику',
      size: 'lg',
      body: [f.node, itemsBox],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Сохранить', kind: 'primary', icon: 'check', onClick: function () {
          if (!f.validate()) return false;
          if (!items.length) { UI.toast({ kind: 'danger', title: 'Добавьте хотя бы одну позицию' }); return false; }
          const v = f.read();
          v.items = items;
          v.amount = U.sum(items, function (i) { return i.sum; });
          v.paid = (o && o.paid) || 0;
          if (o) App.Store.update('purchaseOrders', o.id, v);
          else App.Store.insert('purchaseOrders', v);
          UI.toast({ kind: 'ok', title: 'Заказ сохранён', text: v.number + ' · ' + U.money(v.amount, { digits: 0 }) });
          App.Router.render();
        } }
      ]
    });
  }

  function openOrder(o) {
    UI.detailModal({
      title: 'Заказ поставщику ' + o.number,
      size: 'lg',
      pairs: [
        ['Поставщик', H.cpName(o.supplierId)],
        ['Дата заказа', U.fmtDate(o.date)],
        ['Дата поставки', U.fmtDate(o.deliveryDate)],
        ['Сумма', U.money(o.amount)],
        ['Оплачено', U.money(o.paid || 0)],
        ['К оплате', H.moneyCell(o.amount - (o.paid || 0), { colorize: true })],
        ['Ответственный', o.manager],
        ['Статус', UI.status(o.status)]
      ],
      extra: [
        el('h4.mt-4.mb-2', { text: 'Позиции заказа' }),
        UI.table({
          columns: [
            { k: 'name', t: 'Товар' },
            { k: 'qty', t: 'Кол-во', num: true, render: function (i) { return U.num(i.qty, 0) + ' ' + i.unit; } },
            { k: 'price', t: 'Цена', num: true, render: function (i) { return U.money(i.price, { digits: 0 }); } },
            { k: 'sum', t: 'Сумма', num: true, render: function (i) { return U.money(i.sum, { digits: 0 }); } }
          ],
          rows: o.items, pageSize: 0, exportName: false, printable: false,
          totals: { sum: function (rs) { return U.money(U.sum(rs, function (r) { return r.sum; }), { digits: 0 }); } }
        })
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        o.status === 'sent' && App.Auth.canEdit('purchases')
          ? { text: 'Принять товар', kind: 'primary', icon: 'check', onClick: function () { receiveOrder(o); } }
          : { text: 'Печать', kind: 'primary', icon: 'print', close: false, onClick: function () { window.print(); } }
      ]
    });
  }

  function receiveOrder(o) {
    UI.confirm({
      title: 'Приём товара',
      text: 'Оприходовать ' + o.items.length + ' позиций по заказу ' + o.number + ' на основной склад? Остатки и проводки будут обновлены автоматически.',
      okText: 'Оприходовать',
      onOk: function () {
        const warehouseId = H.defaultWarehouseId();
        o.items.forEach(function (i) {
          H.applyStock(i.productId, warehouseId, i.qty);
          App.Store.insert('stockMoves', {
            number: H.nextNumber('stockMoves', 'ДВ'), date: U.today(), type: 'in',
            productId: i.productId, productName: i.name, unit: i.unit, qty: i.qty,
            toWarehouseId: warehouseId, price: i.price, amount: i.sum,
            author: (App.Auth.user() || {}).fullName, reason: 'Заказ ' + o.number
          }, { silent: true });
        });
        App.Store.emit('stockMoves');
        App.Store.update('purchaseOrders', o.id, { status: 'received' });
        H.autoEntries('purchase', o.amount, U.today(), o);
        UI.toast({ kind: 'ok', title: 'Товар оприходован', text: o.items.length + ' позиций на сумму ' + U.money(o.amount, { digits: 0 }) });
        UI.closeModal();
        App.Router.render();
      }
    });
  }

  /* --- Маршруты ------------------------------------------------------------- */
  App.Router.add('products', { title: 'Товары', module: 'warehouse', render: products });
  App.Router.add('stock-balance', { title: 'Остатки', module: 'warehouse', render: stockBalance });
  App.Router.add('moves', { title: 'Движения', module: 'warehouse', render: moves });
  App.Router.add('inventory', { title: 'Инвентаризация', module: 'warehouse', render: inventory });
  App.Router.add('purchases', { title: 'Закупки', module: 'purchases', render: purchases });
})(window.App);

/* =============================================================================
   ПРИКЛАДНЫЕ ХЕЛПЕРЫ
   Бизнес-логика, общая для нескольких модулей: справочники-опции, расчёт
   задолженности, агрегаты по месяцам, автоматические проводки, проверка ошибок.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const S = function () { return App.Store; };

  /* --- Справочники ---------------------------------------------------------- */
  function cp(id) { return App.Store.get('counterparties', id); }
  function cpName(id) { const c = cp(id); return c ? c.name : '—'; }
  function cpOptions(kind) {
    return App.Store.all('counterparties')
      .filter(function (c) { return !kind || c.kind === kind; })
      .map(function (c) { return { v: c.id, t: c.name }; });
  }

  function product(id) { return App.Store.get('products', id); }
  function productName(id) { const p = product(id); return p ? p.name : '—'; }
  function productOptions() {
    return App.Store.all('products').map(function (p) { return { v: p.id, t: p.name + ' (' + p.sku + ')' }; });
  }

  function warehouseName(id) { const w = App.Store.get('warehouses', id); return w ? w.name : '—'; }
  function warehouseOptions() {
    return App.Store.all('warehouses').map(function (w) { return { v: w.id, t: w.name + ' · ' + w.branch }; });
  }

  function employeeOptions() {
    return App.Store.all('employees').map(function (e) { return { v: e.id, t: e.fullName }; });
  }

  function userOptions() {
    return App.Store.all('users').map(function (u) { return { v: u.fullName, t: u.fullName + ' (' + u.login + ')' }; });
  }

  function accountName(code) {
    const a = App.Store.all('accounts').filter(function (x) { return x.code === code; })[0];
    return a ? a.name : '—';
  }
  function accountOptions() {
    return App.Store.all('accounts').map(function (a) { return { v: a.code, t: a.code + ' — ' + a.name }; });
  }
  function categoryOptions() {
    return App.Store.all('categories').map(function (c) { return { v: c.id, t: c.name }; });
  }
  function categoryName(id) { const c = App.Store.get('categories', id); return c ? c.name : '—'; }

  /* --- Нумерация документов --------------------------------------------------- */
  function nextNumber(collection, prefix) {
    const rows = App.Store.all(collection);
    let max = 0;
    rows.forEach(function (r) {
      const m = String(r.number || '').match(/(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + '-' + U.pad(max + 1);
  }

  /* --- Остатки склада ---------------------------------------------------------- */
  function stockOf(productId, warehouseId) {
    return App.Store.all('stock').filter(function (s) {
      return s.productId === productId && (!warehouseId || s.warehouseId === warehouseId);
    }).reduce(function (a, s) { return a + s.qty; }, 0);
  }

  function stockRows() {
    return App.Store.all('products').map(function (p) {
      const qty = stockOf(p.id);
      return {
        id: p.id, sku: p.sku, barcode: p.barcode, name: p.name,
        categoryId: p.categoryId, category: categoryName(p.categoryId),
        unit: p.unit, qty: qty, minStock: p.minStock,
        cost: p.cost, price: p.price,
        value: qty * p.cost,
        low: qty <= p.minStock,
        zero: qty === 0
      };
    });
  }

  /** Изменение остатка. Идёт через Store, поэтому в режиме API уходит на сервер. */
  function applyStock(productId, warehouseId, delta) {
    if (!productId || !warehouseId) return 0;
    const rec = App.Store.raw('stock').filter(function (s) {
      return s.productId === productId && s.warehouseId === warehouseId;
    })[0];

    if (rec) {
      const qty = Math.max(0, Number(rec.qty || 0) + delta);
      App.Store.update('stock', rec.id, { qty: qty }, { silent: true });
      App.Store.emit('stock');
      return qty;
    }

    const created = App.Store.insert('stock', {
      productId: productId, warehouseId: warehouseId, qty: Math.max(0, delta)
    }, { silent: true });
    App.Store.emit('stock');
    return created.qty;
  }

  /** Склад по умолчанию для операций без явного выбора */
  function defaultWarehouseId() {
    const list = App.Store.all('warehouses');
    return list.length ? list[0].id : null;
  }

  /* --- Задолженность ------------------------------------------------------------- */
  /** Долги покупателей: неоплаченные продажи */
  function receivables() {
    const map = {};
    App.Store.all('sales').forEach(function (s) {
      const debt = (s.amount || 0) - (s.paid || 0);
      if (debt <= 0) return;
      const c = map[s.counterpartyId] = map[s.counterpartyId] || {
        id: s.counterpartyId, name: cpName(s.counterpartyId), debt: 0, docs: 0, overdue: 0, oldest: null
      };
      c.debt += debt;
      c.docs += 1;
      const left = U.daysLeft(s.dueDate);
      if (left < 0) c.overdue += debt;
      if (!c.oldest || new Date(s.dueDate) < new Date(c.oldest)) c.oldest = s.dueDate;
    });
    return Object.keys(map).map(function (k) {
      const r = map[k];
      r.daysOverdue = r.oldest ? Math.max(0, -U.daysLeft(r.oldest)) : 0;
      return r;
    }).sort(function (a, b) { return b.debt - a.debt; });
  }

  /** Долги поставщикам: неоплаченные заказы */
  function payables() {
    const map = {};
    App.Store.all('purchaseOrders').forEach(function (o) {
      const debt = (o.amount || 0) - (o.paid || 0);
      if (debt <= 0 || o.status === 'cancelled') return;
      const c = map[o.supplierId] = map[o.supplierId] || {
        id: o.supplierId, name: cpName(o.supplierId), debt: 0, docs: 0, nearest: null
      };
      c.debt += debt;
      c.docs += 1;
      if (!c.nearest || new Date(o.deliveryDate) < new Date(c.nearest)) c.nearest = o.deliveryDate;
    });
    return Object.keys(map).map(function (k) {
      const r = map[k];
      r.priority = r.debt > 500000 ? 'high' : r.debt > 150000 ? 'normal' : 'low';
      return r;
    }).sort(function (a, b) { return b.debt - a.debt; });
  }

  /* --- Финансовые агрегаты --------------------------------------------------------- */
  function revenue(from, to) {
    return U.sum(App.Store.all('sales').filter(function (s) { return inRange(s.date, from, to); }), function (s) { return s.amount; });
  }

  function expenses(from, to) {
    const purch = U.sum(App.Store.all('purchaseOrders').filter(function (o) {
      return o.status !== 'cancelled' && inRange(o.date, from, to);
    }), function (o) { return o.amount; });
    const cash = U.sum(App.Store.all('cashOrders').filter(function (c) {
      return c.kind === 'out' && inRange(c.date, from, to);
    }), function (c) { return c.amount; });
    return purch + cash;
  }

  function inRange(d, from, to) {
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  /** Денежные остатки: касса + расчётный счёт */
  function cashBalance() {
    const co = App.Store.all('cashOrders');
    return U.sum(co, function (c) { return c.kind === 'in' ? c.amount : -c.amount; });
  }

  function bankBalance() {
    const p = App.Store.all('payments').filter(function (x) { return x.status === 'executed'; });
    return 2500000 + U.sum(p, function (x) { return x.kind === 'in' ? x.amount : -x.amount; });
  }

  /** Ряд значений по месяцам: monthly(collection, 'date', row=>row.amount, 6) */
  function monthly(collection, dateField, valueFn, months, filter) {
    const list = U.lastMonths(months || 6);
    const rows = App.Store.all(collection).filter(filter || function () { return true; });
    const byKey = U.groupBy(rows, function (r) { return U.ym(r[dateField || 'date']); });
    return {
      labels: list.map(function (m) { return m.label; }),
      keys: list.map(function (m) { return m.key; }),
      values: list.map(function (m) { return U.sum(byKey[m.key] || [], valueFn); })
    };
  }

  /* --- Автоматические проводки ------------------------------------------------------ */
  const AUTO_RULES = {
    sale: [
      { debit: '62.1', credit: '90.1', content: 'Реализация товаров покупателю', share: 1 },
      { debit: '90.2', credit: '41.1', content: 'Списана себестоимость проданных товаров', share: 0.7 },
      { debit: '90.1', credit: '68.1', content: 'Начислен НДС с реализации', share: 12 / 112 }
    ],
    purchase: [
      { debit: '41.1', credit: '60.1', content: 'Оприходование товара от поставщика', share: 1 }
    ],
    cashIn: [{ debit: '50.1', credit: '62.1', content: 'Поступление денег в кассу', share: 1 }],
    cashOut: [{ debit: '71', credit: '50.1', content: 'Выдача денежных средств из кассы', share: 1 }],
    payIn: [{ debit: '51', credit: '62.1', content: 'Поступление оплаты на расчётный счёт', share: 1 }],
    payOut: [{ debit: '60.1', credit: '51', content: 'Оплата поставщику с расчётного счёта', share: 1 }]
  };

  /** Создаёт проводки по операции и возвращает их количество */
  function autoEntries(kind, amount, date, doc) {
    const rules = AUTO_RULES[kind] || [];
    const made = [];
    rules.forEach(function (r) {
      made.push(App.Store.insert('entries', {
        number: nextNumber('entries', '').replace('-', ''),
        date: date || U.today(),
        debit: r.debit, credit: r.credit,
        amount: U.round(amount * r.share, 2),
        content: r.content,
        docId: doc ? doc.id : null,
        auto: true, posted: true
      }, { silent: true }));
    });
    App.Store.emit('entries');
    App.Store.persist();
    return made.length;
  }

  /* --- Автоматическая проверка ошибок ------------------------------------------------- */
  function runChecks() {
    const issues = [];
    const add = function (level, type, title, text, link) {
      issues.push({ id: U.uid('iss'), level: level, type: type, title: title, text: text, link: link });
    };

    // 1. Документы без файла
    App.Store.all('documents').filter(function (d) { return !d.fileName; }).forEach(function (d) {
      add('warn', 'missing_file', 'Отсутствует файл документа', d.typeName + ' ' + d.number + ' — скан не загружен', '#/documents');
    });

    // 2. Контрагенты без ИНН / банковских реквизитов
    App.Store.all('counterparties').forEach(function (c) {
      if (!c.inn || String(c.inn).length < 10) add('error', 'bad_inn', 'Некорректный ИНН', c.name + ' — ИНН отсутствует или короче 14 знаков', '#/counterparties');
      if (!c.account) add('warn', 'no_bank', 'Нет банковских реквизитов', c.name + ' — не заполнен расчётный счёт', '#/counterparties');
    });

    // 3. Дубли операций: совпадают контрагент, дата и сумма
    const seen = {};
    App.Store.all('payments').forEach(function (p) {
      const key = p.counterpartyId + '|' + p.date + '|' + p.amount;
      if (seen[key]) add('error', 'duplicate', 'Возможная двойная операция',
        'Платежи ' + seen[key] + ' и ' + p.number + ' совпадают по контрагенту, дате и сумме', '#/payments');
      else seen[key] = p.number;
    });

    // 4. Несовпадение сумм в продажах (позиции vs итог)
    App.Store.all('sales').forEach(function (s) {
      const calc = U.sum(s.items, function (i) { return i.sum; }) - (s.discount || 0);
      if (Math.abs(calc - s.amount) > 1) add('error', 'sum_mismatch', 'Несовпадение сумм',
        'Продажа ' + s.number + ': сумма позиций ' + U.money(calc) + ', в документе ' + U.money(s.amount), '#/sales');
      if ((s.paid || 0) > s.amount + 1) add('warn', 'overpaid', 'Переплата по документу',
        'Продажа ' + s.number + ': оплачено больше суммы документа', '#/sales');
    });

    // 5. Ошибки проводок: несуществующий счёт, нулевая сумма, непроведённые
    const codes = App.Store.all('accounts').map(function (a) { return a.code; });
    App.Store.all('entries').forEach(function (e) {
      if (codes.indexOf(e.debit) === -1 || codes.indexOf(e.credit) === -1)
        add('error', 'bad_account', 'Проводка на несуществующий счёт', 'Проводка №' + e.number + ': ' + e.debit + ' / ' + e.credit, '#/entries');
      if (!e.amount) add('error', 'zero_amount', 'Проводка с нулевой суммой', 'Проводка №' + e.number, '#/entries');
      if (e.debit === e.credit) add('error', 'same_account', 'Дебет равен кредиту', 'Проводка №' + e.number + ' — счёт ' + e.debit, '#/entries');
    });

    // 6. Просроченные задолженности
    receivables().filter(function (r) { return r.overdue > 0; }).forEach(function (r) {
      add('warn', 'overdue', 'Просроченная задолженность', r.name + ' — ' + U.money(r.overdue) + ', просрочка ' + r.daysOverdue + ' дн.', '#/debts');
    });

    // 7. Договоры без подписи и с истекающим сроком
    App.Store.all('contracts').forEach(function (c) {
      if (!c.signed) add('warn', 'unsigned', 'Договор не подписан', c.number + ' — ' + cpName(c.counterpartyId), '#/contracts');
      const left = U.daysLeft(c.endDate);
      if (left >= 0 && left <= 14) add('warn', 'expiring', 'Истекает срок договора',
        c.number + ' — осталось ' + left + ' дн.', '#/contracts');
    });

    // 8. Отрицательные / нулевые остатки при активных продажах
    stockRows().filter(function (r) { return r.zero; }).forEach(function (r) {
      add('warn', 'no_stock', 'Нулевой остаток товара', r.name + ' — остаток 0 ' + r.unit, '#/stock-balance');
    });

    // 9. Незакрытые периоды старше 2 месяцев
    App.Store.all('periods').filter(function (p) {
      return !p.closed && U.daysBetween(p.key + '-01', U.today()) > 62;
    }).forEach(function (p) {
      add('error', 'open_period', 'Период не закрыт', p.name + ' — закрытие просрочено', '#/periods');
    });

    // 10. Неоплаченные налоги с истёкшим сроком
    App.Store.all('taxes').filter(function (t) { return t.status === 'overdue'; }).forEach(function (t) {
      add('error', 'tax_overdue', 'Просрочен налоговый платёж', t.name + ' за ' + t.period + ' — ' + U.money(t.amount), '#/taxes');
    });

    return issues;
  }

  /* --- Правила уведомлений (ТЗ п. 6) --------------------------------------------------
     Система сама сообщает о неоплаченных счетах, приближении налоговых сроков,
     отсутствующих документах и ошибках в операциях. Каждое правило возвращает
     готовые уведомления; дубли отсекаются по заголовку и тексту.
     ------------------------------------------------------------------------------- */
  const NOTIFY_RULES = [
    {
      key: 'unpaid',
      name: 'Неоплаченные счета',
      schedule: 'ежедневно в 09:00',
      build: function () {
        return App.Store.all('sales')
          .filter(function (s) { return (s.amount - (s.paid || 0)) > 1; })
          .map(function (s) {
            const debt = s.amount - (s.paid || 0);
            const left = U.daysLeft(s.dueDate);
            const overdue = left < 0;
            if (!overdue && left > 3) return null;
            return {
              kind: overdue ? 'danger' : 'warn', icon: 'card',
              title: overdue ? 'Счёт не оплачен в срок' : 'Приближается срок оплаты счёта',
              text: s.number + ' · ' + cpName(s.counterpartyId) + ' · ' + U.money(debt, { digits: 0 }) +
                (overdue ? ' · просрочка ' + Math.abs(left) + ' дн.' : ' · осталось ' + left + ' дн.'),
              link: '#/debts'
            };
          })
          .filter(Boolean);
      }
    },
    {
      key: 'tax',
      name: 'Сроки уплаты налогов',
      schedule: 'за 7 дней до срока',
      build: function () {
        return App.Store.all('taxes')
          .filter(function (t) { return t.status !== 'paid'; })
          .map(function (t) {
            const left = U.daysLeft(t.dueDate);
            if (left > 7) return null;
            return {
              kind: left < 0 ? 'danger' : 'warn', icon: 'percent',
              title: left < 0 ? 'Просрочен налоговый платёж' : 'Приближается срок уплаты налога',
              text: t.name + ' за ' + t.period + ' · ' + U.money(t.amount, { digits: 0 }) +
                ' · срок ' + U.fmtDate(t.dueDate),
              link: '#/taxes'
            };
          })
          .filter(Boolean);
      }
    },
    {
      key: 'missing_doc',
      name: 'Отсутствие документов',
      schedule: 'ежедневно в 18:00',
      build: function () {
        const withoutFile = App.Store.all('documents').filter(function (d) { return !d.fileName; });
        const out = withoutFile.slice(0, 10).map(function (d) {
          return {
            kind: 'warn', icon: 'files',
            title: 'Не загружен скан документа',
            text: (d.typeName || 'Документ') + ' ' + d.number + ' от ' + U.fmtDate(d.date),
            link: '#/documents'
          };
        });
        if (withoutFile.length > 10) {
          out.push({
            kind: 'warn', icon: 'files', title: 'Документы без вложений',
            text: 'Ещё ' + (withoutFile.length - 10) + ' документов без загруженного скана',
            link: '#/documents'
          });
        }
        return out;
      }
    },
    {
      key: 'errors',
      name: 'Ошибки в операциях',
      schedule: 'при каждом входе',
      build: function () {
        return runChecks()
          .filter(function (i) { return i.level === 'error'; })
          .slice(0, 10)
          .map(function (i) {
            return { kind: 'danger', icon: 'alert', title: i.title, text: i.text, link: i.link || '#/validation' };
          });
      }
    }
  ];

  /** Считает срабатывания правил без записи в ленту — для экрана «Уведомления». */
  function notificationRules() {
    return NOTIFY_RULES.map(function (rule) {
      let items = [];
      try { items = rule.build() || []; } catch (err) { items = []; }
      return { key: rule.key, name: rule.name, schedule: rule.schedule, items: items };
    });
  }

  /**
   * Записывает в ленту уведомления, которых там ещё нет.
   * Возвращает количество добавленных — интерфейс показывает его в тосте.
   */
  function syncNotifications(limit) {
    const max = limit || 25;      // не заваливаем ленту при первом входе
    const existing = {};
    App.Store.all('notifications').forEach(function (n) {
      existing[U.norm(n.title) + '|' + U.norm(n.text)] = true;
    });

    let added = 0;
    notificationRules().forEach(function (rule) {
      rule.items.forEach(function (item) {
        if (added >= max) return;
        const key = U.norm(item.title) + '|' + U.norm(item.text);
        if (existing[key]) return;
        existing[key] = true;
        App.Store.insert('notifications', {
          kind: item.kind, icon: item.icon, title: item.title, text: item.text,
          ts: new Date().toISOString(), read: false, link: item.link
        }, { silent: true });
        added += 1;
      });
    });

    if (added) {
      App.Store.emit('notifications');
      App.Store.persist();
    }
    return added;
  }

  /* --- Уведомления ------------------------------------------------------------------- */
  function notify(cfg) {
    App.Store.insert('notifications', {
      kind: cfg.kind || 'info',
      icon: cfg.icon || 'bell',
      title: cfg.title,
      text: cfg.text || '',
      ts: new Date().toISOString(),
      read: false,
      link: cfg.link || ''
    }, { silent: true });
    App.Store.emit('notifications');
    App.Store.persist();
  }

  /* --- Согласование ---------------------------------------------------------------------- */
  function defaultRoute() {
    const u = App.Auth.user();
    return [
      { role: 'Сотрудник', name: u ? u.fullName : '—', action: 'Создание', state: 'done', ts: new Date().toISOString(), comment: '' },
      { role: 'Бухгалтер', name: 'Турдубаева Ж. С.', action: 'Проверка', state: 'current', ts: null, comment: '' },
      { role: 'Руководитель', name: 'Абдыразаков Т. Р.', action: 'Утверждение', state: 'waiting', ts: null, comment: '' }
    ];
  }

  /** Продвинуть документ по маршруту: approve/reject */
  function routeStep(collection, id, decision, comment) {
    const rec = App.Store.get(collection, id);
    if (!rec) return null;
    const route = (rec.route || defaultRoute()).slice();
    const idx = route.findIndex(function (s) { return s.state === 'current'; });
    const user = App.Auth.user();

    if (idx === -1) return rec;

    if (decision === 'reject') {
      route[idx] = Object.assign({}, route[idx], {
        state: 'rejected', ts: new Date().toISOString(),
        name: user ? user.fullName : route[idx].name, comment: comment || ''
      });
      App.Store.update(collection, id, { route: route, status: 'rejected' });
      App.Store.logAction('отклонил документ', collection, rec);
      notify({ kind: 'danger', icon: 'xCircle', title: 'Документ отклонён', text: (rec.number || '') + ' — ' + (comment || 'без комментария'), link: '#/approvals' });
    } else {
      route[idx] = Object.assign({}, route[idx], {
        state: 'done', ts: new Date().toISOString(),
        name: user ? user.fullName : route[idx].name, comment: comment || ''
      });
      if (route[idx + 1]) route[idx + 1] = Object.assign({}, route[idx + 1], { state: 'current' });
      const finished = !route[idx + 1];
      App.Store.update(collection, id, { route: route, status: finished ? 'approved' : 'review' });
      App.Store.logAction(finished ? 'утвердил документ' : 'согласовал документ', collection, rec);
      notify({
        kind: 'ok', icon: 'checkCircle',
        title: finished ? 'Документ утверждён' : 'Документ согласован',
        text: (rec.typeName || rec.typeName || '') + ' ' + (rec.number || ''),
        link: '#/approvals'
      });
    }
    return App.Store.get(collection, id);
  }

  /* --- Прочее -------------------------------------------------------------------------- */
  function moneyCell(v, opts) {
    const o = opts || {};
    const cls = o.colorize ? (v > 0 ? 'num up' : v < 0 ? 'num down' : 'num muted-2') : 'num';
    return U.el('span', { class: cls, text: U.money(v, { digits: o.digits }) });
  }

  function periodLabel(key) {
    const parts = String(key).split('-');
    return U.MONTHS_NOM[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  App.H = {
    cp: cp, cpName: cpName, cpOptions: cpOptions,
    product: product, productName: productName, productOptions: productOptions,
    warehouseName: warehouseName, warehouseOptions: warehouseOptions,
    employeeOptions: employeeOptions, userOptions: userOptions,
    accountName: accountName, accountOptions: accountOptions,
    categoryOptions: categoryOptions, categoryName: categoryName,
    nextNumber: nextNumber,
    stockOf: stockOf, stockRows: stockRows, applyStock: applyStock, defaultWarehouseId: defaultWarehouseId,
    receivables: receivables, payables: payables,
    revenue: revenue, expenses: expenses, cashBalance: cashBalance, bankBalance: bankBalance,
    monthly: monthly, autoEntries: autoEntries, runChecks: runChecks,
    notify: notify, notificationRules: notificationRules, syncNotifications: syncNotifications,
    defaultRoute: defaultRoute, routeStep: routeStep,
    moneyCell: moneyCell, periodLabel: periodLabel
  };
})(window.App);

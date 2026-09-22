/* =============================================================================
   МОДУЛЬ: Внутренние заявки · Уведомления · AI-помощник
   ТЗ п. 15, 23, 25
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  const REQ_TYPES = [
    { v: 'purchase', t: 'Покупка' },
    { v: 'payment', t: 'Оплата' },
    { v: 'cash', t: 'Выдача денег' },
    { v: 'document', t: 'Создание документа' },
    { v: 'repair', t: 'Ремонт' },
    { v: 'supply', t: 'Закупка' }
  ];

  /* =========================================================================
     ВНУТРЕННИЕ ЗАЯВКИ
     ====================================================================== */
  function requests() {
    const canEdit = App.Auth.canEdit('requests');
    const rows = App.Store.all('requests');
    const byStatus = U.groupBy(rows, function (r) { return r.status; });

    return UI.page({
      title: 'Внутренние заявки',
      subtitle: 'Процесс: Создание → Проверка → Одобрение → Выполнение',
      actions: canEdit ? [UI.btn('Новая заявка', { kind: 'primary', icon: 'plus', onClick: function () { editRequest(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Всего заявок', value: rows.length, icon: 'inbox', tone: 'info' },
          { label: 'На проверке', value: (byStatus.review || []).length, icon: 'clock', tone: 'warn' },
          { label: 'Одобрено', value: (byStatus.approved || []).length, icon: 'checkCircle', tone: 'ok' },
          { label: 'Отклонено', value: (byStatus.rejected || []).length, icon: 'xCircle', tone: 'danger' },
          { label: 'Сумма заявок', value: U.moneyShort(U.sum(rows, function (r) { return r.amount; })), icon: 'wallet', tone: 'violet' }
        ], 4),

        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['number', 'subject', 'author', 'department'],
            searchPlaceholder: 'Поиск по теме, автору, отделу…',
            filters: [
              { k: 'type', t: 'Тип', options: REQ_TYPES },
              { k: 'status', t: 'Статус', options: UI.statusOptions(['new', 'review', 'approved', 'done', 'rejected']) },
              { k: 'priority', t: 'Приоритет', options: [{ v: 'high', t: 'высокий' }, { v: 'normal', t: 'обычный' }, { v: 'low', t: 'низкий' }] }
            ],
            columns: [
              { k: 'number', t: '№', w: '100px' },
              { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
              { k: 'typeName', t: 'Тип', w: '160px' },
              { k: 'subject', t: 'Тема заявки' },
              { k: 'author', t: 'Автор', w: '210px' },
              { k: 'amount', t: 'Сумма', num: true, render: function (r) { return r.amount ? U.money(r.amount, { digits: 0 }) : '—'; } },
              { k: 'priority', t: 'Приоритет', w: '110px', render: function (r) {
                return UI.badge({ high: 'высокий', normal: 'обычный', low: 'низкий' }[r.priority],
                  r.priority === 'high' ? 'danger' : r.priority === 'normal' ? 'info' : '');
              } },
              { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } },
              { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
                return UI.rowActions([
                  { icon: 'eye', title: 'Открыть заявку', onClick: function () { openRequest(r); } },
                  canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editRequest(r); } } : null
                ]);
              } }
            ],
            rows: rows, sort: { k: 'date', dir: 'desc' }, pageSize: 15, exportName: 'requests.csv',
            onRow: openRequest
          })]
        })])
      ]
    });
  }

  function openRequest(r) {
    const canApprove = App.Auth.canApprove();
    UI.modal({
      title: 'Заявка ' + r.number,
      size: 'lg',
      body: [
        UI.kv([
          ['Тип', r.typeName], ['Тема', r.subject], ['Автор', r.author], ['Отдел', r.department],
          ['Дата', U.fmtDate(r.date)], ['Сумма', r.amount ? U.money(r.amount) : '—'],
          ['Приоритет', r.priority], ['Статус', UI.status(r.status)]
        ]),
        el('h4.mt-4.mb-2', { text: 'Маршрут согласования' }),
        UI.timeline(r.route || H.defaultRoute()),
        canApprove && (r.status === 'review' || r.status === 'new') ? el('div.row.mt-4', null, [
          UI.btn('Одобрить', { kind: 'success', icon: 'check', onClick: function () {
            H.routeStep('requests', r.id, 'approve');
            UI.toast({ kind: 'ok', title: 'Заявка одобрена' });
            UI.closeModal();
            App.Router.render();
          } }),
          UI.btn('Отклонить', { kind: 'danger', icon: 'x', onClick: function () {
            H.routeStep('requests', r.id, 'reject', 'Отклонено при рассмотрении');
            UI.toast({ kind: 'warn', title: 'Заявка отклонена' });
            UI.closeModal();
            App.Router.render();
          } })
        ]) : null,
        r.status === 'approved' && App.Auth.canEdit('requests') ? el('div.mt-4', null, [
          UI.btn('Отметить выполненной', { icon: 'checkCircle', onClick: function () {
            App.Store.update('requests', r.id, { status: 'done' });
            UI.toast({ kind: 'ok', title: 'Заявка выполнена' });
            UI.closeModal();
            App.Router.render();
          } })
        ]) : null
      ]
    });
  }

  function editRequest(r) {
    UI.formModal({
      title: r ? 'Заявка ' + r.number : 'Новая заявка',
      values: r || {
        number: H.nextNumber('requests', 'ЗВ'), date: U.today(), status: 'new', priority: 'normal',
        author: (App.Auth.user() || {}).fullName, department: 'Администрация'
      },
      fields: [
        { k: 'number', t: 'Номер', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'type', t: 'Тип заявки', type: 'select', options: REQ_TYPES, required: true, col: 4, empty: false },
        { k: 'subject', t: 'Тема заявки', required: true, col: 12 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', col: 4 },
        { k: 'priority', t: 'Приоритет', type: 'select', col: 4, empty: false,
          options: [{ v: 'high', t: 'Высокий' }, { v: 'normal', t: 'Обычный' }, { v: 'low', t: 'Низкий' }] },
        { k: 'department', t: 'Отдел', type: 'select', col: 4,
          options: App.Seed.DEPARTMENTS.map(function (d) { return { v: d, t: d }; }) },
        { k: 'author', t: 'Автор', col: 6 },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false,
          options: UI.statusOptions(['new', 'review', 'approved', 'done', 'rejected']) },
        { k: 'comment', t: 'Комментарий', type: 'textarea', col: 12 }
      ],
      onSave: function (v) {
        v.typeName = (REQ_TYPES.filter(function (t) { return t.v === v.type; })[0] || {}).t || v.type;
        if (r) {
          App.Store.update('requests', r.id, v);
        } else {
          v.route = H.defaultRoute();
          App.Store.insert('requests', v);
          H.notify({ kind: 'info', icon: 'inbox', title: 'Новая заявка', text: v.typeName + ' · ' + v.subject, link: '#/requests' });
        }
        UI.toast({ kind: 'ok', title: 'Заявка сохранена', text: v.number });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     УВЕДОМЛЕНИЯ
     ====================================================================== */
  function notifications() {
    const rows = App.Store.all('notifications');
    const st = App.Store.settings();
    const canEdit = App.Auth.canEdit('notifications');

    const channels = [
      { k: 'notifyTelegram', name: 'Telegram', icon: 'send', hint: st.telegramBot },
      { k: 'notifyEmail', name: 'Email', icon: 'message', hint: st.smtpHost },
      { k: 'notifySms', name: 'SMS', icon: 'phone', hint: 'SMS-шлюз оператора' }
    ];

    // Правила оповещений считаются по реальным данным (ТЗ п. 6)
    const events = H.notificationRules();
    const pending = U.sum(events, function (e) { return e.items.length; });

    return UI.page({
      title: 'Уведомления',
      subtitle: 'Каналы доставки: Telegram, Email, SMS · событий по правилам: ' + pending,
      actions: [UI.btn('Проверить сейчас', {
        kind: 'primary', icon: 'refresh', onClick: function () {
          const added = H.syncNotifications();
          UI.toast({
            kind: added ? 'warn' : 'ok',
            title: added ? 'Новых уведомлений: ' + added : 'Новых событий нет',
            text: added ? 'Проверены счета, налоги, документы и операции' : 'Все правила отработали без замечаний'
          });
          App.Router.render();
        }
      }), UI.btn('Отметить всё прочитанным', { icon: 'check', onClick: function () {
        rows.forEach(function (n) { App.Store.update('notifications', n.id, { read: true }, { silent: true }); });
        App.Store.emit('notifications');
        App.Store.persist();
        UI.toast({ kind: 'ok', title: 'Все уведомления прочитаны' });
        App.Router.render();
      } })],
      children: [
        el('div.grid.grid--3', null, channels.map(function (ch) {
          const on = !!st[ch.k];
          return UI.card({
            body: [el('div.row', null, [
              el('div.notif__icon', null, [App.Icons.get(ch.icon)]),
              el('div.grow', null, [
                el('div.strong', { text: ch.name }),
                el('div.fs-xs.muted-2', { text: ch.hint })
              ]),
              el('label.check', null, [
                el('input', {
                  type: 'checkbox', checked: on, disabled: !canEdit,
                  onchange: function (e) {
                    const patch = {};
                    patch[ch.k] = e.target.checked;
                    App.Store.saveSettings(patch);
                    UI.toast({ kind: 'ok', title: ch.name + (e.target.checked ? ' включён' : ' отключён') });
                  }
                })
              ])
            ])]
          });
        })),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Лента уведомлений',
            flush: true,
            body: [rows.length ? el('div.list', null, U.sortBy(rows, function (n) { return n.ts; }, 'desc').map(function (n) {
              return el('div.notif' + (n.read ? '' : '.is-unread'), {
                style: { padding: '12px 20px', borderRadius: 0, borderBottom: '1px solid var(--line)' },
                onclick: function () {
                  App.Store.update('notifications', n.id, { read: true }, { silent: true });
                  App.Store.persist();
                  if (n.link) window.location.hash = n.link;
                  else App.Router.render();
                }
              }, [
                el('div.notif__icon', null, [App.Icons.get(n.icon || 'bell')]),
                el('div.notif__body', null, [
                  el('div.notif__title', { text: n.title }),
                  el('div.notif__text', { text: n.text }),
                  el('div.notif__time', { text: U.relTime(n.ts) })
                ]),
                n.read ? null : el('span.badge.badge--info', { text: 'новое' })
              ]);
            })) : UI.empty({ icon: 'bell', title: 'Уведомлений нет' })]
          }),
          UI.card({
            title: 'Правила оповещений',
            subtitle: 'срабатывания по текущим данным',
            flush: true,
            body: [el('div.list', null, events.map(function (e) {
              return el('div.list__item', {
                style: { cursor: 'pointer' },
                onclick: function () {
                  if (!e.items.length) return UI.toast({ kind: 'ok', title: e.name + ': замечаний нет' });
                  UI.modal({
                    title: e.name,
                    size: 'lg',
                    body: [el('div.list', null, e.items.map(function (i) {
                      return el('div.list__item', null, [
                        el('div.notif__icon', null, [App.Icons.get(i.icon)]),
                        el('div.list__main', null, [
                          el('div.list__title', { text: i.title }),
                          el('div.list__sub', { text: i.text })
                        ]),
                        UI.badge(i.kind === 'danger' ? 'важно' : 'внимание', i.kind)
                      ]);
                    }))],
                    buttons: [{ text: 'Закрыть', kind: 'ghost' }]
                  });
                }
              }, [
                el('div.list__main', null, [
                  el('div.list__title', { text: e.name }),
                  el('div.list__sub', { text: e.schedule })
                ]),
                UI.badge(e.items.length ? e.items.length + ' событ.' : 'нет событий',
                  e.items.length ? 'warn' : 'ok')
              ]);
            }))]
          })
        ])
      ]
    });
  }

  /* =========================================================================
     AI-ПОМОЩНИК
     ====================================================================== */
  const SUGGESTIONS = [
    'Покажи долги клиентов',
    'Какие платежи сегодня?',
    'Найди договор',
    'Почему снизилась прибыль?',
    'Остатки на складе',
    'Анализ расходов'
  ];

  /**
   * Простейший разбор запроса по ключевым словам.
   * В боевой версии здесь вызов backend-эндпоинта с LLM.
   */
  function answer(q) {
    const t = U.norm(q);
    const has = function () {
      return Array.prototype.some.call(arguments, function (w) { return t.indexOf(w) > -1; });
    };

    if (has('долг', 'задолжен', 'дебитор')) {
      const rec = H.receivables();
      const total = U.sum(rec, function (r) { return r.debt; });
      const overdue = U.sum(rec, function (r) { return r.overdue; });
      return {
        text: 'Дебиторская задолженность: ' + U.money(total, { digits: 0 }) + ' по ' + rec.length + ' клиентам. ' +
          'Просрочено: ' + U.money(overdue, { digits: 0 }) + '. Топ-5 должников:',
        rows: rec.slice(0, 5).map(function (r) { return [r.name, U.money(r.debt, { digits: 0 })]; }),
        link: 'debts'
      };
    }

    if (has('платеж', 'оплат', 'сегодня')) {
      const today = U.today();
      const pays = App.Store.all('payments').filter(function (p) { return p.date === today; });
      const due = App.Store.all('sales').filter(function (s) { return s.dueDate === today && s.status !== 'paid'; });
      return {
        text: pays.length || due.length
          ? 'Сегодня ' + U.fmtDateLong(today) + ': проведено платежей — ' + pays.length +
            ' на ' + U.money(U.sum(pays, function (p) { return p.amount; }), { digits: 0 }) +
            '. Ожидается оплата по ' + due.length + ' счетам.'
          : 'На сегодня платежей и сроков оплаты не запланировано. Ближайшие сроки — в разделе «Задолженность».',
        rows: due.slice(0, 5).map(function (s) { return [s.number + ' · ' + H.cpName(s.counterpartyId), U.money(s.amount - s.paid, { digits: 0 })]; }),
        link: 'payments'
      };
    }

    if (has('договор', 'контракт')) {
      const soon = App.Store.all('contracts').filter(function (c) {
        const l = U.daysLeft(c.endDate);
        return l >= 0 && l <= 30;
      });
      const term = q.replace(/найди|договор|контракт/gi, '').trim();
      const found = term ? App.Store.all('contracts').filter(function (c) {
        return U.includes(c.number, term) || U.includes(H.cpName(c.counterpartyId), term);
      }) : [];
      if (found.length) {
        return {
          text: 'Найдено договоров: ' + found.length + '.',
          rows: found.slice(0, 6).map(function (c) { return [c.number + ' · ' + H.cpName(c.counterpartyId), U.fmtDate(c.endDate)]; }),
          link: 'contracts'
        };
      }
      return {
        text: 'Всего договоров: ' + App.Store.all('contracts').length + '. Истекают в ближайшие 30 дней — ' + soon.length + '. ' +
          'Уточните номер или контрагента, например: «Найди договор Ак-Марал».',
        rows: soon.slice(0, 5).map(function (c) { return [c.number + ' · ' + H.cpName(c.counterpartyId), U.daysLeft(c.endDate) + ' дн.']; }),
        link: 'contracts'
      };
    }

    if (has('прибыл', 'снизил', 'упал', 'почему')) {
      const rev = H.monthly('sales', 'date', function (s) { return s.amount; }, 3);
      const exp = H.monthly('purchaseOrders', 'date', function (o) { return o.status === 'cancelled' ? 0 : o.amount; }, 3);
      const cash = H.monthly('cashOrders', 'date', function (c) { return c.kind === 'out' ? c.amount : 0; }, 3);
      const p = rev.values.map(function (v, i) { return v - exp.values[i] - cash.values[i]; });
      const diff = p[2] - p[1];
      const revDiff = rev.values[2] - rev.values[1];
      const expDiff = (exp.values[2] + cash.values[2]) - (exp.values[1] + cash.values[1]);
      return {
        text: 'Прибыль за ' + rev.labels[2] + ': ' + U.money(p[2], { digits: 0 }) + ' (' +
          (diff >= 0 ? 'рост' : 'снижение') + ' на ' + U.money(Math.abs(diff), { digits: 0 }) + ' к предыдущему месяцу). ' +
          'Причина: выручка ' + (revDiff >= 0 ? 'выросла' : 'снизилась') + ' на ' + U.money(Math.abs(revDiff), { digits: 0 }) +
          ', расходы ' + (expDiff >= 0 ? 'выросли' : 'снизились') + ' на ' + U.money(Math.abs(expDiff), { digits: 0 }) + '.',
        rows: [
          ['Выручка', U.money(rev.values[2], { digits: 0 })],
          ['Закупки', U.money(exp.values[2], { digits: 0 })],
          ['Расходы из кассы', U.money(cash.values[2], { digits: 0 })],
          ['Прибыль', U.money(p[2], { digits: 0 })]
        ],
        link: 'analytics'
      };
    }

    if (has('склад', 'остат', 'товар')) {
      const stock = H.stockRows();
      const low = stock.filter(function (r) { return r.low; });
      return {
        text: 'На складах ' + stock.length + ' позиций общей стоимостью ' +
          U.money(U.sum(stock, function (r) { return r.value; }), { digits: 0 }) + '. ' +
          'Ниже минимального запаса: ' + low.length + ' позиций.',
        rows: low.slice(0, 5).map(function (r) { return [r.name, U.num(r.qty, 0) + ' ' + r.unit]; }),
        link: 'stock-balance'
      };
    }

    if (has('расход', 'затрат', 'трат')) {
      const byBasis = U.groupBy(App.Store.all('cashOrders').filter(function (c) { return c.kind === 'out'; }), function (c) { return c.basis; });
      const items = Object.keys(byBasis).map(function (k) {
        return { name: k, value: U.sum(byBasis[k], function (c) { return c.amount; }) };
      }).sort(function (a, b) { return b.value - a.value; });
      return {
        text: 'Расходы из кассы всего: ' + U.money(U.sum(items, function (i) { return i.value; }), { digits: 0 }) +
          '. Основные статьи:',
        rows: items.slice(0, 5).map(function (i) { return [i.name, U.money(i.value, { digits: 0 })]; }),
        link: 'analytics'
      };
    }

    if (has('выручк', 'продаж', 'доход')) {
      const rev = H.monthly('sales', 'date', function (s) { return s.amount; }, 3);
      return {
        text: 'Выручка за ' + rev.labels[2] + ': ' + U.money(rev.values[2], { digits: 0 }) + '. ' +
          'Предыдущие месяцы: ' + rev.labels[1] + ' — ' + U.money(rev.values[1], { digits: 0 }) +
          ', ' + rev.labels[0] + ' — ' + U.money(rev.values[0], { digits: 0 }) + '.',
        link: 'sales'
      };
    }

    if (has('налог')) {
      const rows = App.Store.all('taxes').filter(function (t) { return t.status !== 'paid'; });
      return {
        text: 'К уплате налогов: ' + U.money(U.sum(rows, function (t) { return t.amount; }), { digits: 0 }) +
          ' по ' + rows.length + ' обязательствам.',
        rows: rows.slice(0, 5).map(function (t) { return [t.name + ' · ' + t.period, U.money(t.amount, { digits: 0 })]; }),
        link: 'taxes'
      };
    }

    if (has('ошибк', 'провер')) {
      const issues = H.runChecks();
      return {
        text: 'Автопроверка нашла ' + issues.length + ' проблем: ' +
          issues.filter(function (i) { return i.level === 'error'; }).length + ' критичных и ' +
          issues.filter(function (i) { return i.level === 'warn'; }).length + ' предупреждений.',
        rows: issues.slice(0, 5).map(function (i) { return [i.title, i.level === 'error' ? 'ошибка' : 'внимание']; }),
        link: 'validation'
      };
    }

    if (has('привет', 'здравств', 'салам')) {
      const u = App.Auth.user();
      return { text: 'Здравствуйте, ' + (u ? u.fullName.split(' ')[1] || u.fullName : '') + '! Чем помочь? Могу показать долги, платежи, остатки, разобрать причины изменения прибыли или найти договор.' };
    }

    return {
      text: 'Не удалось однозначно понять запрос. Попробуйте: «Покажи долги клиентов», «Какие платежи сегодня?», ' +
        '«Найди договор Ак-Марал», «Почему снизилась прибыль?», «Остатки на складе», «Анализ расходов».'
    };
  }

  function ai() {
    const log = el('div.col', { style: { minHeight: '320px' } });
    const input = el('input.input', { placeholder: 'Задайте вопрос по данным системы…', 'aria-label': 'Запрос к AI-помощнику' });

    function push(who, cfg) {
      const box = el('div.ai-msg.ai-msg--' + who, { style: { maxWidth: '80%' } }, [el('div', { text: cfg.text })]);
      if (cfg.rows && cfg.rows.length) {
        const tbl = el('table');
        cfg.rows.forEach(function (r) {
          tbl.appendChild(el('tr', null, [el('td', { text: r[0] }), el('td', { text: r[1] })]));
        });
        box.appendChild(tbl);
      }
      if (cfg.link) {
        box.appendChild(el('div.mt-2', null, [
          UI.btn('Открыть раздел', { size: 'sm', kind: 'ghost', icon: 'arrowRight', onClick: function () { App.Router.go(cfg.link); } })
        ]));
      }
      log.appendChild(box);
      log.scrollTop = log.scrollHeight;
    }

    function ask(q) {
      if (!q.trim()) return;
      push('me', { text: q });
      input.value = '';
      setTimeout(function () { push('bot', answer(q)); }, 320);
    }

    push('bot', { text: 'Здравствуйте! Я AI-помощник системы. Задайте вопрос о финансах, долгах, складе или документах — я найду ответ в данных.' });

    return UI.page({
      title: 'AI-помощник',
      subtitle: 'Ответы на вопросы по данным системы, распознавание документов, анализ расходов',
      children: [
        el('div.grid.grid--sidebar', null, [
          UI.card({
            title: 'Диалог',
            body: [
              log,
              el('div.tag-list.mt-4', null, SUGGESTIONS.map(function (s) {
                return el('button.chip', { type: 'button', onclick: function () { ask(s); } }, [s]);
              })),
              el('form.row.mt-4', {
                onsubmit: function (e) { e.preventDefault(); ask(input.value); }
              }, [
                input,
                el('button.btn.btn--primary', { type: 'submit' }, [App.Icons.get('send'), 'Спросить'])
              ])
            ]
          }),
          el('div.col', null, [
            UI.card({
              title: 'Возможности',
              flush: true,
              body: [el('div.list', null, [
                ['search', 'Поиск информации', 'Договоры, документы, контрагенты, товары'],
                ['scan', 'Распознавание документов', 'OCR сканов, извлечение реквизитов и сумм'],
                ['chart', 'Анализ расходов', 'Структура затрат и причины отклонений'],
                ['trend', 'Объяснение показателей', 'Почему изменилась прибыль, выручка, маржа'],
                ['alert', 'Контроль рисков', 'Просрочки, дубли операций, ошибки проводок']
              ].map(function (x) {
                return el('div.list__item', null, [
                  el('div.notif__icon', null, [App.Icons.get(x[0])]),
                  el('div.list__main', null, [el('div.list__title', { text: x[1] }), el('div.list__sub', { text: x[2] })])
                ]);
              }))]
            }),
            UI.card({
              title: 'Как это работает',
              body: [el('p.fs-sm.muted', { text: 'Помощник анализирует данные вашей организации: продажи, платежи, склад, договоры и проводки. ' +
                'В демо-режиме разбор запроса выполняется на стороне браузера; в боевой версии запрос уходит на сервер, где обрабатывается языковой моделью с доступом к API системы.' })]
            })
          ])
        ])
      ]
    });
  }

  /* --- Маршруты ------------------------------------------------------------------ */
  App.Router.add('requests', { title: 'Заявки', module: 'requests', render: requests });
  App.Router.add('notifications', { title: 'Уведомления', module: 'notifications', render: notifications });
  App.Router.add('ai', { title: 'AI-помощник', module: 'ai', render: ai });

  App.AI = { answer: answer, suggestions: SUGGESTIONS };
})(window.App);

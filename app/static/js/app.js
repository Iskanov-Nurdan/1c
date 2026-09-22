/* =============================================================================
   ТОЧКА ВХОДА: оболочка приложения
   Авторизация, навигация, глобальный поиск, уведомления, тема, язык,
   переключение организаций, AI-панель.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, el = U.el, $ = U.$;

  /* =========================================================================
     СТРУКТУРА НАВИГАЦИИ
     ====================================================================== */
  const NAV = [
    {
      title: 'nav.main', items: [
        { path: 'dashboard', t: 'nav.dashboard', icon: 'home', module: 'dashboard' },
        { path: 'analytics', t: 'nav.analytics', icon: 'chart', module: 'analytics' },
        { path: 'budget', t: 'nav.budget', icon: 'target', module: 'budget' },
        { path: 'debts', t: 'nav.debts', icon: 'scale', module: 'debts', count: function () {
          return H.receivables().filter(function (r) { return r.overdue > 0; }).length;
        }, alert: true },
        { path: 'search', t: 'nav.search', icon: 'search', module: 'dashboard' }
      ]
    },
    {
      title: 'nav.reports', items: [
        { path: 'reports', t: 'nav.reportsHub', icon: 'clipboard', module: 'reports' },
        { path: 'report-turnover', t: 'nav.turnover', icon: 'book', module: 'reports' },
        { path: 'report-balance', t: 'nav.balance', icon: 'scale', module: 'reports' },
        { path: 'report-pnl', t: 'nav.pnl', icon: 'trend', module: 'reports' },
        { path: 'report-cashflow', t: 'nav.cashflow', icon: 'cash', module: 'reports' }
      ]
    },
    {
      title: 'nav.docs', items: [
        { path: 'documents', t: 'nav.documents', icon: 'files', module: 'documents' },
        { path: 'contracts', t: 'nav.contracts', icon: 'contract', module: 'contracts' },
        { path: 'approvals', t: 'nav.approvals', icon: 'clipboard', module: 'approvals', count: function () {
          return App.Store.all('documents').filter(function (d) { return d.status === 'review'; }).length;
        } },
        { path: 'esign', t: 'nav.esign', icon: 'signature', module: 'esign' }
      ]
    },
    {
      title: 'nav.accounting', items: [
        { path: 'chart', t: 'nav.chart', icon: 'book', module: 'accounting' },
        { path: 'entries', t: 'nav.entries', icon: 'calc', module: 'accounting' },
        { path: 'journal', t: 'nav.journal', icon: 'history', module: 'accounting' },
        { path: 'periods', t: 'nav.periods', icon: 'lock', module: 'accounting' },
        { path: 'assets', t: 'nav.assets', icon: 'archive', module: 'assets' },
        { path: 'depreciation', t: 'nav.depreciation', icon: 'trend', module: 'assets' },
        { path: 'taxes', t: 'nav.taxes', icon: 'percent', module: 'taxes' },
        { path: 'validation', t: 'nav.validation', icon: 'shield', module: 'validation', count: function () {
          return H.runChecks().filter(function (i) { return i.level === 'error'; }).length;
        }, alert: true }
      ]
    },
    {
      title: 'nav.money', items: [
        { path: 'cash', t: 'nav.cash', icon: 'cash', module: 'cash' },
        { path: 'bank', t: 'nav.bank', icon: 'bank', module: 'bank' },
        { path: 'payments', t: 'nav.payments', icon: 'card', module: 'payments' }
      ]
    },
    {
      title: 'nav.stock', items: [
        { path: 'products', t: 'nav.products', icon: 'box', module: 'warehouse' },
        { path: 'stock-balance', t: 'nav.stockBalance', icon: 'warehouse', module: 'warehouse' },
        { path: 'moves', t: 'nav.moves', icon: 'refresh', module: 'warehouse' },
        { path: 'inventory', t: 'nav.inventory', icon: 'clipboard', module: 'warehouse' },
        { path: 'purchases', t: 'nav.purchases', icon: 'truck', module: 'purchases' }
      ]
    },
    {
      title: 'nav.sales', items: [
        { path: 'sales', t: 'nav.salesList', icon: 'cart', module: 'sales' },
        { path: 'returns', t: 'nav.returns', icon: 'arrowDown', module: 'sales' },
        { path: 'counterparties', t: 'nav.counterparties', icon: 'users', module: 'counterparties' },
        { path: 'crm', t: 'nav.crm', icon: 'briefcase', module: 'crm' },
        { path: 'tasks', t: 'nav.tasks', icon: 'check', module: 'crm', count: function () {
          return App.Store.all('tasks').filter(function (t) { return t.status !== 'done'; }).length;
        } }
      ]
    },
    {
      title: 'nav.hr', items: [
        { path: 'employees', t: 'nav.employees', icon: 'user', module: 'hr' },
        { path: 'payroll', t: 'nav.payroll', icon: 'wallet', module: 'hr' },
        { path: 'timesheet', t: 'nav.timesheet', icon: 'clock', module: 'hr' }
      ]
    },
    {
      title: 'nav.process', items: [
        { path: 'requests', t: 'nav.requests', icon: 'inbox', module: 'requests', count: function () {
          return App.Store.all('requests').filter(function (r) { return r.status === 'review' || r.status === 'new'; }).length;
        } },
        { path: 'notifications', t: 'nav.notifications', icon: 'bell', module: 'notifications' },
        { path: 'ai', t: 'nav.ai', icon: 'cpu', module: 'ai' }
      ]
    },
    {
      title: 'nav.admin', items: [
        { path: 'users', t: 'nav.users', icon: 'users', module: 'admin' },
        { path: 'roles', t: 'nav.roles', icon: 'key', module: 'admin' },
        { path: 'audit', t: 'nav.audit', icon: 'history', module: 'admin' },
        { path: 'security', t: 'nav.security', icon: 'shield', module: 'admin' },
        { path: 'integrations', t: 'nav.integrations', icon: 'link', module: 'admin' },
        { path: 'settings', t: 'nav.settings', icon: 'settings', module: 'admin' }
      ]
    }
  ];

  /* =========================================================================
     ЭКРАН ВХОДА
     ====================================================================== */
  /** Демо-стенд: роли для входа в один клик. В режиме API справочник ролей
      ещё не загружен, поэтому список статичный. */
  const DEMO_ACCOUNTS = [
    ['admin', 'Администратор системы'],
    ['glavbuh', 'Главный бухгалтер'],
    ['buh', 'Бухгалтер'],
    ['kassa', 'Кассир'],
    ['manager', 'Менеджер'],
    ['director', 'Руководитель']
  ];

  function renderLogin() {
    $('#login-screen').hidden = false;
    $('#app-shell').hidden = true;
    closeOverlays();

    const box = $('#login-roles');
    U.clear(box);

    let accounts = DEMO_ACCOUNTS;
    if (!App.Config.isApi && App.Store.db) {
      accounts = App.Store.all('users').map(function (u) {
        const role = App.Store.all('roles').filter(function (r) { return r.code === u.role; })[0];
        return [u.login, role ? role.name : u.role];
      });
    }

    accounts.forEach(function (item) {
      box.appendChild(el('button.login__role', {
        type: 'button',
        onclick: function () { doLogin(item[0], '1234'); }
      }, [
        el('strong', { text: item[1] }),
        el('small', { text: item[0] })
      ]));
    });

    const note = U.$('.login__note');
    if (note) {
      note.textContent = App.Config.isApi
        ? 'Данные хранятся на сервере · Django REST API'
        : 'Демо-режим: данные хранятся локально в браузере';
    }

    const form = $('#login-form');
    form.onsubmit = function (e) {
      e.preventDefault();
      doLogin(form.login.value, form.password.value);
    };
  }

  /** Глобальные слои лежат вне #app-shell, поэтому при выходе гасим их вручную */
  function closeOverlays() {
    UI.closeModal();
    ['#ai-panel', '#notif-menu', '#user-menu', '#search-results', '#sidebar-backdrop'].forEach(function (sel) {
      const node = $(sel);
      if (node) node.hidden = true;
    });
  }

  function doLogin(login, password) {
    const err = $('#login-error');
    const submit = U.$('#login-form button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Вход…'; }

    App.Auth.login(login, password).then(function (res) {
      if (submit) { submit.disabled = false; submit.textContent = 'Войти'; }
      if (!res.ok) {
        err.textContent = res.error;
        err.hidden = false;
        return;
      }
      err.hidden = true;
      startApp();
    }).catch(function (e) {
      if (submit) { submit.disabled = false; submit.textContent = 'Войти'; }
      err.textContent = 'Ошибка входа: ' + e.message;
      err.hidden = false;
    });
  }

  /* =========================================================================
     ОБОЛОЧКА
     ====================================================================== */
  function startApp() {
    $('#login-screen').hidden = true;
    $('#app-shell').hidden = false;

    const st = App.Store.settings();
    setTheme(st.theme || 'light', true);
    setLang(st.language || 'ru', true);
    if (st.density === 'compact') document.documentElement.setAttribute('data-density', 'compact');

    // Правила оповещений: неоплаченные счета, налоговые сроки,
    // отсутствующие документы и ошибки в операциях (ТЗ п. 6)
    if (App.Auth.canEdit('notifications')) {
      try { H.syncNotifications(); } catch (err) { console.warn('Правила уведомлений', err); }
    }

    renderUser();
    renderCompanies();
    renderNav();
    renderNotifications();
    renderStorage();

    if (!App.Router.path) App.Router.start($('#content'));
    else App.Router.render();

    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) App.Router.go('dashboard');
  }

  function renderUser() {
    const u = App.Auth.user();
    if (!u) return;
    $('#user-name').textContent = u.fullName;
    $('#user-role').textContent = App.Auth.roleName();
    $('#user-avatar').textContent = U.initials(u.fullName);
  }

  function renderCompanies() {
    const sel = $('#company-switch');
    U.clear(sel);
    const u = App.Auth.user();
    App.Store.companies()
      .filter(function (c) { return !u || !u.companies || u.companies.indexOf(c.id) > -1; })
      .forEach(function (c) {
        sel.appendChild(el('option', { value: c.id, text: c.name, selected: App.Store.company().id === c.id }));
      });
    $('#brand-company').textContent = App.Store.company().name;
    sel.onchange = function (e) {
      App.Store.setCompany(e.target.value);
      refreshAll();
      UI.toast({ kind: 'ok', title: 'Организация переключена', text: App.Store.company().name });
    };
  }

  function renderNav() {
    const nav = $('#sidebar-nav');
    U.clear(nav);
    const current = App.Router.current().path;

    NAV.forEach(function (group) {
      const items = group.items.filter(function (i) { return App.Auth.can(i.module); });
      if (!items.length) return;

      const g = el('div.nav-group', null, [el('span.nav-group__title', { text: T(group.title) })]);
      items.forEach(function (i) {
        let count = null;
        try { count = i.count ? i.count() : null; } catch (e) { count = null; }
        g.appendChild(el('a.nav-item', {
          href: '#/' + i.path,
          class: current === i.path ? 'is-active' : '',
          onclick: function () { closeSidebar(); }
        }, [
          App.Icons.get(i.icon, 'nav-item__icon'),
          el('span.nav-item__text', { text: T(i.t) }),
          count ? el('span.nav-item__count' + (i.alert ? '.is-alert' : ''), { text: String(count) }) : null
        ]));
      });
      nav.appendChild(g);
    });
  }

  function renderStorage() {
    const usage = App.Store.usage();
    const onServer = App.Config.isApi;
    const pct = onServer ? 100 : Math.min(100, usage.kb / usage.limit * 100);
    U.clear($('#storage-info')).appendChild(el('div', null, [
      el('div.row.row--between', null, [
        el('span', { text: onServer ? 'Данные с сервера' : 'Локальные данные' }),
        el('span', { text: usage.kb + ' КБ' })
      ]),
      el('div.storage__bar.mt-2', null, [el('div.storage__fill', { style: { width: pct + '%' } })]),
      el('div.fs-xs.mt-2', {
        style: { opacity: .6 },
        text: usage.rows + ' записей · ' + (onServer ? 'Django REST API' : 'демо-режим')
      })
    ]));
  }

  /* --- Уведомления ---------------------------------------------------------- */
  function renderNotifications() {
    const rows = U.sortBy(App.Store.all('notifications'), function (n) { return n.ts; }, 'desc');
    const unread = rows.filter(function (n) { return !n.read; });
    const badge = $('#notif-count');
    badge.textContent = String(unread.length);
    badge.hidden = unread.length === 0;

    const menu = $('#notif-menu');
    U.clear(menu);
    menu.appendChild(el('div.dropdown__head', null, [
      el('span', { text: 'Уведомления' }),
      unread.length ? el('button.btn.btn--sm.btn--ghost', {
        type: 'button',
        onclick: function () {
          unread.forEach(function (n) { App.Store.update('notifications', n.id, { read: true }, { silent: true }); });
          App.Store.persist();
          renderNotifications();
        }
      }, ['Прочитать все']) : null
    ]));

    if (!rows.length) {
      menu.appendChild(el('p.muted-2.center.fs-sm', { style: { padding: '20px' }, text: 'Уведомлений нет' }));
    }

    rows.slice(0, 12).forEach(function (n) {
      menu.appendChild(el('div.notif' + (n.read ? '' : '.is-unread'), {
        onclick: function () {
          App.Store.update('notifications', n.id, { read: true }, { silent: true });
          App.Store.persist();
          menu.hidden = true;
          renderNotifications();
          if (n.link) window.location.hash = n.link;
        }
      }, [
        el('div.notif__icon', null, [App.Icons.get(n.icon || 'bell')]),
        el('div.notif__body', null, [
          el('div.notif__title', { text: n.title }),
          el('div.notif__text', { text: n.text }),
          el('div.notif__time', { text: U.relTime(n.ts) })
        ])
      ]));
    });

    menu.appendChild(el('div.dropdown__sep'));
    menu.appendChild(el('a.dropdown__item', { href: '#/notifications', onclick: function () { menu.hidden = true; } },
      [App.Icons.get('settings'), 'Все уведомления и настройки']));
  }

  /* --- Меню пользователя ----------------------------------------------------- */
  function renderUserMenu() {
    const menu = $('#user-menu');
    U.clear(menu);
    const u = App.Auth.user();

    menu.appendChild(el('div.dropdown__head', { text: u ? u.email : '' }));
    menu.appendChild(el('a.dropdown__item', { href: '#/settings', onclick: function () { menu.hidden = true; } },
      [App.Icons.get('settings'), 'Настройки системы']));
    menu.appendChild(el('a.dropdown__item', { href: '#/audit', onclick: function () { menu.hidden = true; } },
      [App.Icons.get('history'), 'Мои действия']));
    menu.appendChild(el('button.dropdown__item', {
      type: 'button', onclick: function () { menu.hidden = true; toggleTheme(); }
    }, [App.Icons.get(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'), 'Сменить тему']));
    menu.appendChild(el('div.dropdown__sep'));
    menu.appendChild(el('button.dropdown__item.dropdown__item--danger', {
      type: 'button',
      onclick: function () {
        menu.hidden = true;
        App.Auth.logout();
        UI.closeModal();
        renderLogin();
      }
    }, [App.Icons.get('logout'), T('a.logout')]));
  }

  /* --- Тема и язык ------------------------------------------------------------ */
  function setTheme(theme, silent) {
    document.documentElement.dataset.theme = theme;
    // Дубль в localStorage читает инлайновый скрипт в <head> — без него
    // страница успевает моргнуть светлой темой до загрузки настроек.
    try { localStorage.setItem('erp.theme', theme); } catch (err) { /* приватный режим */ }
    if (!silent) App.Store.saveSettings({ theme: theme });
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    UI.toast({ kind: 'ok', title: next === 'dark' ? 'Тёмная тема' : 'Светлая тема' });
  }

  function setLang(code, silent) {
    App.I18n.set(code);
    $('#lang-switch').value = code;
    if (!silent) {
      App.Store.saveSettings({ language: code });
      renderNav();
      App.Router.render();
      UI.toast({ kind: 'ok', title: 'Язык интерфейса изменён' });
    }
  }

  /* --- Глобальный поиск --------------------------------------------------------- */
  function globalSearch(q) {
    const box = $('#search-results');
    U.clear(box);
    if (!q || q.length < 2) { box.hidden = true; return; }

    // Число в запросе ищем ещё и по суммам, дату — по датам документов (ТЗ п. 5)
    const amount = Number(String(q).replace(/[^0-9.]/g, ''));
    const byAmount = isFinite(amount) && amount > 0 && /^[0-9\s.,]+$/.test(q);
    const byDate = /^\d{4}-\d{2}(-\d{2})?$/.test(q);
    const matches = function (rec, value) {
      if (byAmount && Math.abs((Number(value) || 0) - amount) < 0.5) return true;
      if (byDate && String(rec.date || '').indexOf(q) === 0) return true;
      return false;
    };

    const groups = [
      {
        t: 'Документы', icon: 'files', link: 'documents',
        rows: App.Store.all('documents').filter(function (d) {
          return U.includes(d.number, q) || U.includes(d.typeName, q) || U.includes(d.ocrText, q) ||
            U.includes(H.cpName(d.counterpartyId), q) || matches(d, d.amount);
        }).slice(0, 5).map(function (d) {
          return { title: d.typeName + ' ' + d.number, sub: U.fmtDate(d.date) + ' · ' + H.cpName(d.counterpartyId), go: function () { App.Docs.openDoc(d.id); } };
        })
      },
      {
        t: 'Контрагенты', icon: 'users', link: 'counterparties',
        rows: App.Store.all('counterparties').filter(function (c) {
          return U.includes(c.name, q) || U.includes(c.inn, q) || U.includes(c.phone, q);
        }).slice(0, 5).map(function (c) {
          return { title: c.name, sub: 'ИНН ' + c.inn + ' · ' + c.phone, go: function () { App.Router.go('counterparties'); } };
        })
      },
      {
        t: 'Товары', icon: 'box', link: 'products',
        rows: App.Store.all('products').filter(function (p) {
          return U.includes(p.name, q) || U.includes(p.sku, q) || U.includes(p.barcode, q);
        }).slice(0, 5).map(function (p) {
          return { title: p.name, sub: p.sku + ' · ' + U.money(p.price, { digits: 0 }), go: function () { App.Router.go('products'); } };
        })
      },
      {
        t: 'Основные средства', icon: 'archive', link: 'assets',
        rows: App.Store.all('fixedAssets').filter(function (a) {
          return U.includes(a.name, q) || U.includes(a.invNumber, q) ||
            U.includes(a.responsible, q) || U.includes(a.location, q) || matches(a, a.initialCost);
        }).slice(0, 5).map(function (a) {
          return {
            title: a.invNumber + ' · ' + a.name,
            sub: U.money(a.initialCost, { digits: 0 }) + ' · остаточная ' +
              U.money(App.Depreciation.residual(a), { digits: 0 }),
            go: function () { App.Assets.card(a); }
          };
        })
      },
      {
        t: 'Платежи и касса', icon: 'card', link: 'payments',
        rows: App.Store.all('payments').filter(function (p) {
          return U.includes(p.number, q) || U.includes(p.purpose, q) ||
            U.includes(H.cpName(p.counterpartyId), q) || matches(p, p.amount);
        }).slice(0, 4).map(function (p) {
          return {
            title: 'Платёж ' + p.number, sub: U.fmtDate(p.date) + ' · ' + U.money(p.amount, { digits: 0 }),
            go: function () { App.Router.go('payments'); }
          };
        })
      },
      {
        t: 'Договоры', icon: 'contract', link: 'contracts',
        rows: App.Store.all('contracts').filter(function (c) {
          return U.includes(c.number, q) || U.includes(H.cpName(c.counterpartyId), q) || U.includes(c.subject, q);
        }).slice(0, 4).map(function (c) {
          return { title: 'Договор ' + c.number, sub: H.cpName(c.counterpartyId) + ' · до ' + U.fmtDate(c.endDate), go: function () { App.Router.go('contracts'); } };
        })
      },
      {
        t: 'Продажи', icon: 'cart', link: 'sales',
        rows: App.Store.all('sales').filter(function (s) {
          return U.includes(s.number, q) || U.includes(H.cpName(s.counterpartyId), q) || matches(s, s.amount);
        }).slice(0, 4).map(function (s) {
          return { title: 'Реализация ' + s.number, sub: U.fmtDate(s.date) + ' · ' + U.money(s.amount, { digits: 0 }), go: function () { App.Router.go('sales'); } };
        })
      }
    ].filter(function (g) { return g.rows.length; });

    const advanced = el('button.search__item', {
      type: 'button',
      onclick: function () {
        box.hidden = true;
        $('#global-search').value = '';
        App.Router.go('search', { q: q });
      }
    }, [
      App.Icons.get('search'),
      el('div.grow', null, [
        el('strong.truncate', { text: 'Расширенный поиск: «' + q + '»' }),
        el('div', null, [el('small', { text: 'Фильтры по дате, контрагенту, сумме и типу документа' })])
      ])
    ]);

    if (!groups.length) {
      box.appendChild(el('p.muted-2.center.fs-sm', { style: { padding: '16px' }, text: 'Ничего не найдено по запросу «' + q + '»' }));
      box.appendChild(advanced);
      box.hidden = false;
      return;
    }

    groups.forEach(function (g) {
      box.appendChild(el('div.search__group', { text: g.t }));
      g.rows.forEach(function (r) {
        box.appendChild(el('button.search__item', {
          type: 'button',
          onclick: function () {
            box.hidden = true;
            $('#global-search').value = '';
            r.go();
          }
        }, [
          App.Icons.get(g.icon),
          el('div.grow', null, [
            el('strong.truncate', { text: r.title }),
            el('div', null, [el('small', { text: r.sub })])
          ])
        ]));
      });
    });

    box.appendChild(el('div.search__group', { text: 'Не нашли нужное?' }));
    box.appendChild(advanced);
    box.hidden = false;
  }

  /* --- AI-панель ---------------------------------------------------------------- */
  /* Открытие панели вызывается из двух мест (кнопка в шапке и плитка дашборда),
     поэтому логика показа живёт в одном месте — иначе панель открывалась пустой. */
  let openAIPanel = function () {};

  function initAI() {
    const panel = $('#ai-panel'), log = $('#ai-log'), form = $('#ai-form'), input = $('#ai-input');

    function push(who, cfg) {
      const box = el('div.ai-msg.ai-msg--' + who, null, [el('div', { text: cfg.text })]);
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
      setTimeout(function () { push('bot', App.AI.answer(q)); }, 300);
    }

    const hints = $('#ai-hints');
    U.clear(hints);
    App.AI.suggestions.slice(0, 4).forEach(function (s) {
      hints.appendChild(el('button.chip', { type: 'button', onclick: function () { ask(s); } }, [s]));
    });

    form.onsubmit = function (e) { e.preventDefault(); ask(input.value); };

    openAIPanel = function () {
      panel.hidden = false;
      if (!log.children.length) {
        push('bot', { text: 'Здравствуйте! Спросите, например: «Покажи долги клиентов» или «Почему снизилась прибыль?»' });
      }
      input.focus();
    };

    $('#ai-close').onclick = function () { panel.hidden = true; };
    $('#ai-open').onclick = function () {
      if (panel.hidden) openAIPanel();
      else panel.hidden = true;
    };
  }

  /* --- Сайдбар на мобильных ------------------------------------------------------ */
  function openSidebar() {
    $('#sidebar').classList.add('is-open');
    $('#sidebar-backdrop').hidden = false;
    $('#sidebar-toggle').setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('is-open');
    $('#sidebar-backdrop').hidden = true;
    $('#sidebar-toggle').setAttribute('aria-expanded', 'false');
  }

  /* --- Полное обновление интерфейса ------------------------------------------------ */
  function refreshAll() {
    renderUser();
    renderCompanies();
    renderNav();
    renderNotifications();
    renderStorage();
    App.Router.render();
  }

  /* =========================================================================
     ИНИЦИАЛИЗАЦИЯ
     ====================================================================== */
  function init() {
    // В демо-режиме данные генерируются сразу; в режиме API они придут
    // с сервера после входа (или по сохранённому токену).
    if (!App.Config.isApi) App.Store.init();

    // Иконки статичных кнопок
    $('#sidebar-toggle').appendChild(App.Icons.get('menu'));
    $('#sidebar-close').appendChild(App.Icons.get('x'));
    $('#theme-toggle').appendChild(App.Icons.get('moon'));
    $('#ai-open').appendChild(App.Icons.get('cpu'));
    $('#notif-btn').insertBefore(App.Icons.get('bell'), $('#notif-count'));
    $('#ai-close').appendChild(App.Icons.get('x'));
    U.$$('#modal .icon-btn[data-close]').forEach(function (b) { b.appendChild(App.Icons.get('x')); });

    // Верхняя панель
    $('#theme-toggle').onclick = toggleTheme;
    $('#lang-switch').onchange = function (e) { setLang(e.target.value); };
    $('#sidebar-toggle').onclick = openSidebar;
    $('#sidebar-close').onclick = closeSidebar;
    $('#sidebar-backdrop').onclick = closeSidebar;

    // Выпадающие меню
    $('#notif-btn').onclick = function (e) {
      e.stopPropagation();
      const m = $('#notif-menu');
      m.hidden = !m.hidden;
      $('#user-menu').hidden = true;
      $('#notif-btn').setAttribute('aria-expanded', String(!m.hidden));
    };
    $('#user-btn').onclick = function (e) {
      e.stopPropagation();
      renderUserMenu();
      const m = $('#user-menu');
      m.hidden = !m.hidden;
      $('#notif-menu').hidden = true;
      $('#user-btn').setAttribute('aria-expanded', String(!m.hidden));
    };
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#notif-dd')) $('#notif-menu').hidden = true;
      if (!e.target.closest('#user-dd')) $('#user-menu').hidden = true;
      if (!e.target.closest('.search')) $('#search-results').hidden = true;
    });

    // Поиск
    const search = $('#global-search');
    search.addEventListener('input', U.debounce(function (e) { globalSearch(e.target.value.trim()); }, 220));
    search.addEventListener('focus', function (e) { if (e.target.value.trim().length > 1) globalSearch(e.target.value.trim()); });

    // Горячие клавиши
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        search.focus();
        search.select();
      }
      if (e.key === 'Escape') {
        $('#search-results').hidden = true;
        closeSidebar();
      }
    });

    initAI();

    // Реакция на изменение данных: пересчитываем счётчики и уведомления
    App.Store.on('*', U.debounce(function () {
      if (!App.Auth.user()) return;
      renderNav();
      renderNotifications();
      renderStorage();
    }, 300));

    // Подсветка активного пункта меню при смене маршрута
    App.Router.after(function () {
      renderNav();
      const path = App.Router.current().path;
      const def = App.Router.routes[path];
      document.title = (def ? def.title + ' · ' : '') + 'ERP · ' + App.Store.company().name;
    });

    App.Router.setNotFound(null);

    // Восстановление сессии (в режиме API — загрузка данных по токену)
    App.Auth.restoreSession().then(function (user) {
      if (user) startApp();
      else renderLogin();
    }).catch(function () {
      renderLogin();
    });
  }

  App.Shell = {
    renderNav: renderNav,
    renderNotifications: renderNotifications,
    refreshAll: refreshAll,
    setTheme: setTheme,
    setLang: setLang,
    openAI: function () { openAIPanel(); },
    NAV: NAV
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.App);

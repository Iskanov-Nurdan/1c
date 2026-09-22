/* =============================================================================
   МОДУЛЬ: Администрирование — пользователи, роли, аудит, безопасность,
   интеграции, настройки
   ТЗ п. 2, 21, 26, 27, 28, 29
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, el = U.el;

  /* =========================================================================
     ПОЛЬЗОВАТЕЛИ
     ====================================================================== */
  function users() {
    const canEdit = App.Auth.canEdit('admin');
    const rows = App.Store.all('users');
    const roles = App.Store.all('roles');

    return UI.page({
      title: 'Пользователи',
      subtitle: 'Учётные записи, роли, доступ к организациям',
      actions: canEdit ? [UI.btn('Добавить пользователя', { kind: 'primary', icon: 'plus', onClick: function () { editUser(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Пользователей', value: rows.length, icon: 'users', tone: 'info' },
          { label: 'Активных', value: rows.filter(function (u) { return u.active; }).length, icon: 'checkCircle', tone: 'ok' },
          { label: 'Заблокировано', value: rows.filter(function (u) { return !u.active; }).length, icon: 'lock', tone: 'danger' },
          { label: 'С двухфакторной', value: rows.filter(function (u) { return u.twoFactor; }).length, icon: 'shield', tone: 'violet' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['fullName', 'login', 'email'],
            filters: [{ k: 'role', t: 'Роль', options: roles.map(function (r) { return { v: r.code, t: r.name }; }) }],
            columns: [
              { k: 'fullName', t: 'Пользователь', render: function (u) {
                return el('div.row', { style: { gap: '10px' } }, [
                  el('span.avatar', { text: U.initials(u.fullName) }),
                  el('div', null, [
                    el('div.strong', { text: u.fullName }),
                    el('div.fs-xs.muted-2', { text: '@' + u.login + ' · ' + u.email })
                  ])
                ]);
              } },
              { k: 'role', t: 'Роль', w: '210px', render: function (u) {
                const r = roles.filter(function (x) { return x.code === u.role; })[0];
                return UI.badge(r ? r.name : u.role, 'info');
              } },
              { id: 'companies', t: 'Организации', w: '140px', sortable: false, render: function (u) {
                return (u.companies || []).length + ' из ' + App.Store.companies().length;
              } },
              { k: 'lastLogin', t: 'Последний вход', w: '170px', render: function (u) { return U.relTime(u.lastLogin); } },
              { k: 'twoFactor', t: '2FA', w: '90px', render: function (u) { return u.twoFactor ? UI.badge('вкл', 'ok') : UI.badge('выкл', ''); } },
              { k: 'active', t: 'Статус', w: '130px', render: function (u) { return u.active ? UI.badge('активен', 'ok') : UI.badge('заблокирован', 'danger'); } },
              { id: 'act', t: '', w: '110px', sortable: false, render: function (u) {
                if (!canEdit) return '';
                return UI.rowActions([
                  { icon: 'edit', title: 'Изменить', onClick: function () { editUser(u); } },
                  { icon: u.active ? 'lock' : 'key', title: u.active ? 'Заблокировать' : 'Разблокировать', onClick: function () {
                    App.Store.update('users', u.id, { active: !u.active });
                    UI.toast({ kind: u.active ? 'warn' : 'ok', title: u.active ? 'Пользователь заблокирован' : 'Доступ восстановлен' });
                    App.Router.render();
                  } },
                  { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
                    if (u.id === (App.Auth.user() || {}).id) return UI.toast({ kind: 'danger', title: 'Нельзя удалить себя' });
                    UI.confirm({ title: 'Удалить пользователя?', danger: true, text: u.fullName + ' потеряет доступ к системе.',
                      onOk: function () { App.Store.remove('users', u.id); UI.toast({ kind: 'ok', title: 'Пользователь удалён' }); App.Router.render(); } });
                  } }
                ]);
              } }
            ],
            rows: rows, pageSize: 15, exportName: 'users.csv'
          })]
        })])
      ]
    });
  }

  function editUser(u) {
    const roles = App.Store.all('roles');
    UI.formModal({
      title: u ? u.fullName : 'Новый пользователь',
      values: u || { active: true, role: 'accountant', password: '1234', companies: ['co-1'] },
      fields: [
        { k: 'fullName', t: 'ФИО', required: true, col: 12 },
        { k: 'login', t: 'Логин', required: true, col: 4 },
        { k: 'password', t: 'Пароль', required: true, col: 4, hint: 'Минимум 4 символа (демо-режим)' },
        { k: 'role', t: 'Роль', type: 'select', required: true, col: 4, empty: false,
          options: roles.map(function (r) { return { v: r.code, t: r.name }; }) },
        { k: 'email', t: 'Email', type: 'email', col: 6 },
        { k: 'phone', t: 'Телефон', col: 6 },
        { k: 'twoFactor', t: 'Двухфакторная аутентификация', type: 'checkbox', col: 6 },
        { k: 'active', t: 'Учётная запись активна', type: 'checkbox', col: 6 }
      ],
      onSave: function (v) {
        if (u) App.Store.update('users', u.id, v);
        else App.Store.insert('users', Object.assign({ companies: ['co-1'], lastLogin: null }, v));
        UI.toast({ kind: 'ok', title: 'Пользователь сохранён', text: v.fullName });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     РОЛИ И ПРАВА
     ====================================================================== */
  const MODULE_NAMES = {
    dashboard: 'Дашборд', analytics: 'Финансовая аналитика', budget: 'Бюджетирование', debts: 'Задолженность',
    documents: 'Документы', contracts: 'Договоры', approvals: 'Согласование', esign: 'ЭЦП',
    accounting: 'Бухгалтерия', taxes: 'Налоги', validation: 'Проверка ошибок',
    cash: 'Касса', bank: 'Банк', payments: 'Платежи',
    warehouse: 'Склад', purchases: 'Закупки',
    sales: 'Продажи', crm: 'CRM', counterparties: 'Контрагенты',
    hr: 'Сотрудники', requests: 'Заявки', notifications: 'Уведомления', ai: 'AI-помощник', admin: 'Администрирование'
  };

  function roles() {
    const canEdit = App.Auth.canEdit('admin');
    const rows = App.Store.all('roles');
    const modules = App.Seed.MODULES;

    const matrix = UI.table({
      columns: [{ k: 'name', t: 'Модуль', w: '220px' }].concat(rows.map(function (r) {
        return {
          k: r.code, t: r.name, sortable: false,
          render: function (m) {
            const has = r.permissions.indexOf(m.key) > -1;
            const ro = (r.readonly || []).indexOf(m.key) > -1;
            if (!has) return el('span.muted-2', { text: '—' });
            return UI.badge(ro ? 'чтение' : 'полный', ro ? 'warn' : 'ok');
          }
        };
      })),
      rows: modules.map(function (m) { return { key: m, name: MODULE_NAMES[m] || m }; }),
      pageSize: 0, exportName: 'permissions.csv', printable: true
    });

    return UI.page({
      title: 'Роли и права доступа',
      subtitle: 'Матрица доступа ролей к модулям системы',
      children: [
        el('div.grid.grid--3', null, rows.map(function (r) {
          return UI.card({
            title: r.name,
            subtitle: App.Store.all('users').filter(function (u) { return u.role === r.code; }).length + ' пользователей',
            tools: canEdit ? [UI.iconBtn('edit', 'Настроить права', function () { editRole(r); })] : [],
            body: [
              el('p.fs-sm.muted', { text: r.description }),
              el('div.tag-list.mt-3', null, r.permissions.slice(0, 8).map(function (p) {
                return el('span.badge', { text: MODULE_NAMES[p] || p });
              }).concat(r.permissions.length > 8 ? [el('span.badge.badge--info', { text: '+' + (r.permissions.length - 8) })] : []))
            ]
          });
        })),
        el('div.mt-4', null, [UI.card({ title: 'Матрица прав доступа', flush: true, body: [matrix] })])
      ]
    });
  }

  function editRole(r) {
    const modules = App.Seed.MODULES;
    const perms = r.permissions.slice();
    const ro = (r.readonly || []).slice();

    const list = el('div.col');
    modules.forEach(function (m) {
      const has = perms.indexOf(m) > -1;
      const isRo = ro.indexOf(m) > -1;
      const sel = el('select.select', {
        style: { width: '160px' },
        onchange: function (e) {
          const v = e.target.value;
          const pi = perms.indexOf(m), ri = ro.indexOf(m);
          if (v === 'none') { if (pi > -1) perms.splice(pi, 1); if (ri > -1) ro.splice(ri, 1); }
          else if (v === 'read') { if (pi === -1) perms.push(m); if (ri === -1) ro.push(m); }
          else { if (pi === -1) perms.push(m); if (ri > -1) ro.splice(ri, 1); }
        }
      }, [
        el('option', { value: 'none', text: 'Нет доступа', selected: !has }),
        el('option', { value: 'read', text: 'Только чтение', selected: has && isRo }),
        el('option', { value: 'full', text: 'Полный доступ', selected: has && !isRo })
      ]);
      list.appendChild(el('div.row.row--between', null, [
        el('span', { text: MODULE_NAMES[m] || m }),
        sel
      ]));
    });

    UI.modal({
      title: 'Права роли · ' + r.name,
      size: 'lg',
      body: [el('p.muted.mb-4', { text: r.description }), list],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Сохранить', kind: 'primary', icon: 'check', onClick: function () {
          App.Store.update('roles', r.id, { permissions: perms, readonly: ro });
          UI.toast({ kind: 'ok', title: 'Права обновлены', text: r.name });
          App.Shell.renderNav();
          App.Router.render();
        } }
      ]
    });
  }

  /* =========================================================================
     АУДИТ ДЕЙСТВИЙ
     ====================================================================== */
  function audit() {
    const rows = App.Store.all('auditLog');
    const today = rows.filter(function (a) { return U.iso(a.ts) === U.today(); });

    return UI.page({
      title: 'Аудит действий пользователей',
      subtitle: 'Кто, что и когда создал, изменил или удалил',
      actions: [UI.btn('Выгрузить журнал', { icon: 'download', onClick: function () {
        U.download('audit-log.csv', U.toCSV(rows, [
          { k: 'ts', t: 'Дата и время' }, { k: 'user', t: 'Пользователь' }, { k: 'role', t: 'Роль' },
          { k: 'actionText', t: 'Действие' }, { k: 'entityTitle', t: 'Объект' }, { k: 'label', t: 'Идентификатор' }, { k: 'ip', t: 'IP' }
        ]));
        UI.toast({ kind: 'ok', title: 'Журнал выгружен' });
      } })],
      children: [
        UI.statGrid([
          { label: 'Записей в журнале', value: rows.length, icon: 'history', tone: 'info' },
          { label: 'Действий сегодня', value: today.length, icon: 'clock', tone: 'ok' },
          { label: 'Удалений', value: rows.filter(function (a) { return a.action === 'delete'; }).length, icon: 'trash', tone: 'danger' },
          { label: 'Активных пользователей', value: U.uniq(rows.map(function (a) { return a.user; })).length, icon: 'users', tone: 'violet' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          flush: true,
          body: [UI.table({
            search: ['user', 'actionText', 'entityTitle', 'label'],
            searchPlaceholder: 'Поиск по пользователю, действию, объекту…',
            filters: [
              { k: 'action', t: 'Действие', options: [
                { v: 'create', t: 'создание' }, { v: 'update', t: 'изменение' },
                { v: 'delete', t: 'удаление' }, { v: 'custom', t: 'бизнес-операции' }
              ] },
              { k: 'user', t: 'Пользователь', options: U.uniq(rows.map(function (a) { return a.user; })).map(function (u) { return { v: u, t: u }; }) }
            ],
            columns: [
              { k: 'ts', t: 'Дата и время', w: '170px', render: function (a) {
                return el('div', null, [U.fmtDateTime(a.ts), el('div.fs-xs.muted-2', { text: U.relTime(a.ts) })]);
              } },
              { k: 'user', t: 'Пользователь', w: '230px', render: function (a) {
                return el('div.row', { style: { gap: '8px' } }, [
                  el('span.avatar.avatar--sm', { text: U.initials(a.user) }),
                  el('span.truncate', { text: a.user })
                ]);
              } },
              { k: 'actionText', t: 'Действие', render: function (a) {
                const tone = { create: 'ok', update: 'info', delete: 'danger' }[a.action] || '';
                return el('div.row', { style: { gap: '8px' } }, [
                  UI.badge(a.actionText, tone),
                  el('span.truncate', { text: [a.entityTitle, a.label].filter(Boolean).join(' ') })
                ]);
              } },
              { k: 'details', t: 'Изменённые поля', w: '200px' },
              { k: 'ip', t: 'IP-адрес', w: '130px', render: function (a) { return el('span.mono.fs-sm', { text: a.ip }); } }
            ],
            rows: rows, sort: { k: 'ts', dir: 'desc' }, pageSize: 25, exportName: 'audit.csv'
          })]
        })])
      ]
    });
  }

  /* =========================================================================
     БЕЗОПАСНОСТЬ И РЕЗЕРВНОЕ КОПИРОВАНИЕ
     ====================================================================== */
  function security() {
    const st = App.Store.settings();
    const usage = App.Store.usage();
    const canEdit = App.Auth.canEdit('admin');

    const backups = [
      { date: U.iso(U.addDays(new Date(), -1)) + ' 03:00', size: Math.round(usage.kb * 0.98), type: 'Автоматическая', status: 'ok' },
      { date: U.iso(U.addDays(new Date(), -2)) + ' 03:00', size: Math.round(usage.kb * 0.95), type: 'Автоматическая', status: 'ok' },
      { date: U.iso(U.addDays(new Date(), -3)) + ' 14:22', size: Math.round(usage.kb * 0.91), type: 'Ручная', status: 'ok' },
      { date: U.iso(U.addDays(new Date(), -7)) + ' 03:00', size: Math.round(usage.kb * 0.80), type: 'Автоматическая', status: 'ok' }
    ];

    return UI.page({
      title: 'Безопасность и резервное копирование',
      subtitle: 'Политики доступа, журнал безопасности, бэкап и восстановление данных',
      children: [
        UI.statGrid([
          { label: 'Объём базы', value: usage.kb + ' КБ', icon: 'database', tone: 'info', meta: usage.rows + ' записей' },
          { label: 'Последний бэкап', value: 'вчера, 03:00', icon: 'archive', tone: 'ok' },
          { label: 'Автобэкап', value: st.autoBackup ? 'включён' : 'выключен', icon: 'refresh', tone: st.autoBackup ? 'ok' : 'warn', meta: 'ежедневно в ' + st.backupTime },
          { label: 'Тайм-аут сессии', value: st.sessionTimeout + ' мин', icon: 'clock', tone: 'violet' }
        ], 4),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Политика безопасности',
            body: [el('div.col', null, [
              UI.kv([
                ['Требование пароля', st.passwordPolicy],
                ['Двухфакторная аутентификация', st.require2fa ? 'обязательна для всех' : 'по выбору пользователя'],
                ['Тайм-аут неактивной сессии', st.sessionTimeout + ' минут'],
                ['Журналирование действий', 'включено, хранение 12 месяцев'],
                ['Разграничение доступа', 'по ролям и организациям']
              ]),
              canEdit ? el('div.row.mt-3', null, [
                UI.btn('Изменить политику', { icon: 'shield', onClick: function () { editSecurity(st); } })
              ]) : null
            ])]
          }),
          UI.card({
            title: 'Резервное копирование',
            body: [el('div.col', null, [
              el('p.fs-sm.muted', { text: 'Резервная копия содержит все данные организации: документы, проводки, справочники, настройки и журнал аудита.' }),
              el('div.row.row--wrap', null, [
                UI.btn('Создать копию', { kind: 'primary', icon: 'download', onClick: backupNow }),
                UI.btn('Восстановить', { icon: 'upload', onClick: restore }),
                canEdit ? UI.btn('Сбросить демо-данные', { kind: 'danger', icon: 'refresh', onClick: resetDemo }) : null
              ].filter(Boolean)),
              el('div.mt-3', null, [UI.meter({
                label: 'Использование локального хранилища',
                value: usage.kb, max: usage.limit,
                text: usage.kb + ' / ' + usage.limit + ' КБ'
              })])
            ])]
          })
        ]),

        el('div.mt-4', null, [UI.card({
          title: 'История резервных копий',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'date', t: 'Дата и время', w: '200px' },
              { k: 'type', t: 'Тип', w: '180px' },
              { k: 'size', t: 'Размер', num: true, render: function (b) { return b.size + ' КБ'; } },
              { k: 'status', t: 'Статус', w: '140px', render: function () { return UI.badge('успешно', 'ok'); } },
              { id: 'act', t: '', w: '110px', sortable: false, render: function () {
                return UI.rowActions([
                  { icon: 'download', title: 'Скачать', onClick: backupNow },
                  { icon: 'refresh', title: 'Восстановить из копии', onClick: restore }
                ]);
              } }
            ],
            rows: backups, pageSize: 0, exportName: false
          })]
        })]),

        el('div.mt-4', null, [UI.card({
          title: 'Журнал безопасности',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'ts', t: 'Время', w: '180px', render: function (a) { return U.fmtDateTime(a.ts); } },
              { k: 'user', t: 'Пользователь', w: '240px' },
              { k: 'actionText', t: 'Событие' },
              { k: 'ip', t: 'IP-адрес', w: '140px', render: function (a) { return el('span.mono.fs-sm', { text: a.ip }); } }
            ],
            rows: App.Store.all('auditLog').filter(function (a) {
              return /вход|выход|период|прав|пароль/i.test(a.actionText);
            }).slice(0, 50),
            pageSize: 10, exportName: 'security-log.csv',
            emptyTitle: 'Событий безопасности нет'
          })]
        })])
      ]
    });
  }

  function editSecurity(st) {
    UI.formModal({
      title: 'Политика безопасности',
      values: st,
      fields: [
        { k: 'passwordPolicy', t: 'Требования к паролю', col: 12 },
        { k: 'sessionTimeout', t: 'Тайм-аут сессии, мин', type: 'number', col: 6, min: 5, max: 480 },
        { k: 'backupTime', t: 'Время автобэкапа', col: 6, placeholder: '03:00' },
        { k: 'require2fa', t: 'Двухфакторная аутентификация обязательна', type: 'checkbox', col: 6 },
        { k: 'autoBackup', t: 'Автоматическое резервное копирование', type: 'checkbox', col: 6 }
      ],
      onSave: function (v) {
        App.Store.saveSettings(v);
        App.Store.logAction('изменил политику безопасности', 'settings', null);
        UI.toast({ kind: 'ok', title: 'Политика обновлена' });
        App.Router.render();
      }
    });
  }

  function backupNow() {
    const name = 'erp-backup-' + U.today() + '.json';
    U.download(name, App.Store.exportJSON(), 'application/json');
    App.Store.logAction('создал резервную копию', 'settings', null);
    UI.toast({ kind: 'ok', title: 'Резервная копия создана', text: name });
  }

  function restore() {
    const input = el('input', {
      type: 'file', accept: '.json', hidden: true,
      onchange: function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            App.Store.importJSON(String(reader.result));
            UI.closeModal();
            UI.toast({ kind: 'ok', title: 'Данные восстановлены', text: file.name });
            App.Shell.refreshAll();
            App.Router.go('dashboard');
          } catch (err) {
            UI.toast({ kind: 'danger', title: 'Ошибка восстановления', text: err.message });
          }
        };
        reader.readAsText(file);
      }
    });

    UI.modal({
      title: 'Восстановление из резервной копии',
      size: 'lg',
      body: [
        el('div.alert.alert--warn.mb-4', null, [App.Icons.get('alert'),
          'Текущие данные будут заменены содержимым резервной копии. Рекомендуется сначала создать копию текущего состояния.']),
        UI.dropzone({
          title: 'Выберите файл резервной копии',
          hint: 'Файл формата .json, созданный этой системой',
          accept: '.json', multiple: false,
          onFiles: function (files) {
            const reader = new FileReader();
            reader.onload = function () {
              try {
                App.Store.importJSON(String(reader.result));
                UI.closeModal();
                UI.toast({ kind: 'ok', title: 'Данные восстановлены' });
                App.Shell.refreshAll();
                App.Router.go('dashboard');
              } catch (err) {
                UI.toast({ kind: 'danger', title: 'Ошибка восстановления', text: err.message });
              }
            };
            reader.readAsText(files[0]);
          }
        }),
        input
      ],
      buttons: [{ text: 'Отмена', kind: 'ghost' }]
    });
  }

  function resetDemo() {
    const onServer = App.Config.isApi;
    UI.confirm({
      title: onServer ? 'Перезагрузить данные с сервера?' : 'Сбросить все данные?',
      danger: !onServer,
      text: onServer
        ? 'Локальный кэш будет очищен и данные загружены с сервера заново. Изменения в базе не затрагиваются.'
        : 'Система вернётся к исходному демонстрационному набору данных. Все внесённые изменения будут потеряны.',
      okText: onServer ? 'Перезагрузить' : 'Сбросить',
      onOk: function () {
        const result = App.Store.reset();
        const finish = function () {
          UI.toast({ kind: 'ok', title: onServer ? 'Данные обновлены' : 'Демо-данные восстановлены' });
          App.Shell.refreshAll();
          App.Router.go('dashboard');
        };
        if (result && typeof result.then === 'function') result.then(finish);
        else finish();
      }
    });
  }

  /* =========================================================================
     ИНТЕГРАЦИИ
     ====================================================================== */
  function integrations() {
    const rows = App.Store.all('integrations');
    const canEdit = App.Auth.canEdit('admin');
    const groups = {
      bank: 'Банк и платежи', esign: 'Электронная подпись', file: 'Файлы и обмен',
      notify: 'Оповещения', device: 'Оборудование', api: 'API', gov: 'Госорганы'
    };
    const byKind = U.groupBy(rows, function (r) { return r.kind; });

    return UI.page({
      title: 'Интеграции',
      subtitle: 'Банк-клиент, ЭЦП, Excel/CSV, кассовое оборудование, сканеры, внешние API',
      children: [
        UI.statGrid([
          { label: 'Всего интеграций', value: rows.length, icon: 'link', tone: 'info' },
          { label: 'Подключено', value: rows.filter(function (r) { return r.status === 'connected'; }).length, icon: 'checkCircle', tone: 'ok' },
          { label: 'Настраивается', value: rows.filter(function (r) { return r.status === 'pending'; }).length, icon: 'clock', tone: 'warn' },
          { label: 'Отключено', value: rows.filter(function (r) { return r.status === 'disabled'; }).length, icon: 'xCircle', tone: '' }
        ], 4),

        el('div.col.mt-4', null, Object.keys(byKind).map(function (kind) {
          return UI.card({
            title: groups[kind] || kind,
            flush: true,
            body: [el('div.list', null, byKind[kind].map(function (r) {
              return el('div.list__item', null, [
                el('div.notif__icon', null, [App.Icons.get({
                  bank: 'bank', esign: 'signature', file: 'files', notify: 'bell', device: 'scan', api: 'cpu', gov: 'shield'
                }[r.kind] || 'link')]),
                el('div.list__main', null, [
                  el('div.list__title', { text: r.name }),
                  el('div.list__sub', { text: r.description })
                ]),
                el('div.right.fs-xs.muted-2', { text: r.lastSync ? 'синхр. ' + U.relTime(r.lastSync) : 'нет данных' }),
                UI.status(r.status),
                canEdit ? UI.btn(r.status === 'connected' ? 'Отключить' : 'Подключить', {
                  size: 'sm', kind: r.status === 'connected' ? 'ghost' : 'outline',
                  onClick: function () {
                    App.Store.update('integrations', r.id, {
                      status: r.status === 'connected' ? 'disabled' : 'connected',
                      lastSync: r.status === 'connected' ? r.lastSync : new Date().toISOString()
                    });
                    UI.toast({ kind: 'ok', title: r.status === 'connected' ? 'Интеграция отключена' : 'Интеграция подключена', text: r.name });
                    App.Router.render();
                  }
                }) : null
              ]);
            }))]
          });
        })),

        el('div.mt-4', null, [UI.card({
          title: 'Импорт и экспорт данных',
          body: [el('div.grid.grid--3', null, [
            importCard('Контрагенты', 'counterparties', 'users'),
            importCard('Товары', 'products', 'box'),
            importCard('Проводки', 'entries', 'calc')
          ])]
        })])
      ]
    });
  }

  function importCard(title, collection, icon) {
    return UI.card({
      body: [el('div.col', null, [
        el('div.row', null, [
          el('div.notif__icon', null, [App.Icons.get(icon)]),
          el('div.grow', null, [
            el('div.strong', { text: title }),
            el('div.fs-xs.muted-2', { text: App.Store.all(collection).length + ' записей' })
          ])
        ]),
        el('div.row', null, [
          UI.btn('Экспорт CSV', { size: 'sm', icon: 'download', onClick: function () {
            const rows = App.Store.all(collection);
            U.download(collection + '.csv', U.toCSV(rows));
            UI.toast({ kind: 'ok', title: 'Экспортировано', text: rows.length + ' записей' });
          } }),
          UI.btn('Импорт', { size: 'sm', icon: 'upload', onClick: function () {
            UI.toast({ kind: 'warn', title: 'Импорт CSV', text: 'В демо-режиме доступен только экспорт' });
          } })
        ])
      ])]
    });
  }

  /* =========================================================================
     НАСТРОЙКИ
     ====================================================================== */
  function settings() {
    const st = App.Store.settings();
    const canEdit = App.Auth.canEdit('admin');
    const companies = App.Store.companies();

    return UI.page({
      title: 'Настройки системы',
      subtitle: 'Организации, валюта, налоговые ставки, язык и оформление',
      children: [
        UI.tabs([
          {
            id: 'companies', title: 'Организации',
            render: function () {
              return el('div.col', null, [
                el('div.grid.grid--2', null, companies.map(function (c) {
                  return UI.card({
                    title: c.name,
                    subtitle: c.taxMode,
                    tools: [
                      App.Store.company().id === c.id ? UI.badge('текущая', 'ok') : UI.btn('Выбрать', { size: 'sm', onClick: function () {
                        App.Store.setCompany(c.id);
                        App.Shell.refreshAll();
                        UI.toast({ kind: 'ok', title: 'Организация переключена', text: c.name });
                      } })
                    ],
                    body: [UI.kv([
                      ['ИНН', c.inn], ['Адрес', c.address], ['Телефон', c.phone],
                      ['Директор', c.director], ['Главный бухгалтер', c.accountant],
                      ['Банк', c.bank], ['Расчётный счёт', el('span.mono', { text: c.account })]
                    ])]
                  });
                })),
                canEdit ? el('div.mt-3', null, [UI.btn('Добавить организацию', { icon: 'plus', kind: 'primary', onClick: addCompany })]) : null
              ]);
            }
          },
          {
            id: 'general', title: 'Общие',
            render: function () {
              const f = UI.form({
                values: st,
                fields: [
                  { t: 'Учёт', type: 'section' },
                  { k: 'currency', t: 'Валюта учёта', col: 4 },
                  { k: 'fiscalYearStart', t: 'Начало финансового года', col: 4, placeholder: '01-01' },
                  { k: 'docNumberFormat', t: 'Формат номера документа', col: 4 },
                  { t: 'Налоговые ставки', type: 'section' },
                  { k: 'vatRate', t: 'НДС, %', type: 'number', col: 3 },
                  { k: 'salesTaxRate', t: 'Налог с продаж, %', type: 'number', col: 3 },
                  { k: 'incomeTaxRate', t: 'Подоходный налог, %', type: 'number', col: 3 },
                  { k: 'socialFundRate', t: 'Соцфонд, %', type: 'number', col: 3 },
                  { t: 'Оповещения', type: 'section' },
                  { k: 'telegramBot', t: 'Telegram-бот', col: 6 },
                  { k: 'smtpHost', t: 'SMTP-сервер', col: 6 }
                ]
              });
              return el('div.col', null, [
                UI.card({ body: [f.node] }),
                canEdit ? el('div.row', null, [
                  UI.btn('Сохранить настройки', { kind: 'primary', icon: 'check', onClick: function () {
                    if (!f.validate()) return;
                    App.Store.saveSettings(f.read());
                    UI.toast({ kind: 'ok', title: 'Настройки сохранены' });
                  } })
                ]) : el('p.muted-2', { text: 'У вашей роли нет прав на изменение настроек' })
              ]);
            }
          },
          {
            id: 'view', title: 'Оформление и язык',
            render: function () {
              return UI.card({
                body: [el('div.col', null, [
                  el('div.field', null, [
                    el('span.field__label', { text: 'Тема оформления' }),
                    el('div.btn-group', null, [
                      el('button', { type: 'button', class: st.theme === 'light' ? 'is-active' : '', onclick: function () { App.Shell.setTheme('light'); App.Router.render(); } }, ['Светлая']),
                      el('button', { type: 'button', class: st.theme === 'dark' ? 'is-active' : '', onclick: function () { App.Shell.setTheme('dark'); App.Router.render(); } }, ['Тёмная'])
                    ])
                  ]),
                  el('div.field', null, [
                    el('span.field__label', { text: 'Плотность интерфейса' }),
                    el('div.btn-group', null, [
                      el('button', { type: 'button', class: st.density !== 'compact' ? 'is-active' : '', onclick: function () {
                        App.Store.saveSettings({ density: 'comfortable' });
                        document.documentElement.removeAttribute('data-density');
                        App.Router.render();
                      } }, ['Обычная']),
                      el('button', { type: 'button', class: st.density === 'compact' ? 'is-active' : '', onclick: function () {
                        App.Store.saveSettings({ density: 'compact' });
                        document.documentElement.setAttribute('data-density', 'compact');
                        App.Router.render();
                      } }, ['Компактная'])
                    ])
                  ]),
                  el('div.field', null, [
                    el('span.field__label', { text: 'Язык интерфейса' }),
                    el('div.btn-group', null, App.I18n.languages.map(function (l) {
                      return el('button', {
                        type: 'button', class: App.I18n.lang === l.code ? 'is-active' : '',
                        onclick: function () { App.Shell.setLang(l.code); }
                      }, [l.name]);
                    }))
                  ]),
                  el('div.alert', null, [App.Icons.get('info'),
                    'Мультиязычность охватывает навигацию и основные элементы интерфейса. Справочные данные хранятся на языке ввода.'])
                ])]
              });
            }
          },
          {
            id: 'cloud', title: 'Облачная версия',
            render: function () {
              return el('div.grid.grid--2', null, [
                UI.card({
                  title: 'Режим работы',
                  body: [UI.kv([
                    ['Доступ', 'через браузер, без установки'],
                    ['Организаций', App.Store.companies().length],
                    ['Филиалов', U.uniq(App.Store.all('warehouses').map(function (w) { return w.branch; })).length],
                    ['Удалённый доступ', 'да, с любого устройства'],
                    ['Обновления', 'автоматические, без остановки работы'],
                    ['Хранение данных', 'демо-режим: локально в браузере']
                  ])]
                }),
                UI.card({
                  title: 'Подключение к серверу',
                  body: [el('div.col', null, [
                    el('p.fs-sm.muted', { text: 'В боевой конфигурации фронтенд работает с Django REST API. Достаточно указать базовый адрес — слой данных (js/core/store.js) заменяется на HTTP-вызовы.' }),
                    UI.kv([
                      ['API', el('span.mono', { text: 'https://erp.company.kg/api/' })],
                      ['Авторизация', el('span.mono', { text: 'POST /api/token/ (JWT)' })],
                      ['Обновление токена', el('span.mono', { text: 'POST /api/token/refresh/' })],
                      ['Документы', el('span.mono', { text: 'GET /api/documents/' })]
                    ])
                  ])]
                })
              ]);
            }
          }
        ])
      ]
    });
  }

  function addCompany() {
    UI.formModal({
      title: 'Новая организация',
      values: { taxMode: 'Общий режим (НДС)' },
      fields: [
        { k: 'name', t: 'Наименование', required: true, col: 8 },
        { k: 'inn', t: 'ИНН', required: true, col: 4 },
        { k: 'address', t: 'Юридический адрес', col: 8 },
        { k: 'phone', t: 'Телефон', col: 4 },
        { k: 'director', t: 'Директор', col: 6 },
        { k: 'accountant', t: 'Главный бухгалтер', col: 6 },
        { k: 'taxMode', t: 'Режим налогообложения', type: 'select', col: 6, empty: false, options: [
          { v: 'Общий режим (НДС)', t: 'Общий режим (НДС)' },
          { v: 'Упрощённая система', t: 'Упрощённая система' },
          { v: 'Патент', t: 'Патент' }
        ] },
        { k: 'bank', t: 'Банк', type: 'select', col: 6, options: App.Seed.BANKS.map(function (b) { return { v: b, t: b }; }) },
        { k: 'account', t: 'Расчётный счёт', col: 6 },
        { k: 'bik', t: 'БИК', col: 6 }
      ],
      onSave: function (v) {
        App.Store.raw('companies').push(Object.assign({ id: U.uid('co') }, v));
        App.Store.persist();
        UI.toast({ kind: 'ok', title: 'Организация добавлена', text: v.name });
        App.Shell.refreshAll();
        App.Router.render();
      }
    });
  }

  /* --- Маршруты ------------------------------------------------------------------- */
  App.Router.add('users', { title: 'Пользователи', module: 'admin', render: users });
  App.Router.add('roles', { title: 'Роли и права', module: 'admin', render: roles });
  App.Router.add('audit', { title: 'Аудит действий', module: 'admin', render: audit });
  App.Router.add('security', { title: 'Безопасность', module: 'admin', render: security });
  App.Router.add('integrations', { title: 'Интеграции', module: 'admin', render: integrations });
  App.Router.add('settings', { title: 'Настройки', module: 'admin', render: settings });
})(window.App);

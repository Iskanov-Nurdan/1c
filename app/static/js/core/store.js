/* =============================================================================
   ХРАНИЛИЩЕ ДАННЫХ — единая точка доступа к данным для всех модулей.

   Два режима работы:
     • demo — данные генерируются локально и живут в localStorage
              (index.html можно открыть прямо с диска);
     • api  — данные приходят из Django REST API одним запросом /api/bootstrap/
              и держатся в памяти; изменения уходят на сервер.

   В обоих режимах чтение синхронное, поэтому модулям всё равно, откуда данные.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const KEY = 'erp1c.db.v1';
  const UI_KEY = 'erp1c.ui';
  // Настройки оформления хранятся у клиента: их меняет любой пользователь,
  // даже без прав на раздел «Настройки системы».
  const UI_SETTINGS = ['theme', 'language', 'density'];

  /* --- Безопасный доступ к localStorage ------------------------------------ */
  const mem = {};
  const LS = (function () {
    try {
      const probe = '__t';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  /* --- Состояние ------------------------------------------------------------ */
  let db = null;
  let currentCompany = null;
  const listeners = {};
  const anyListeners = [];

  const isApi = function () { return App.Config && App.Config.isApi; };

  /** Коллекции, не привязанные к организации */
  const GLOBAL_COLLECTIONS = [
    'companies', 'users', 'roles', 'accounts', 'categories', 'units',
    'settings', 'integrations', 'auditLog', 'notifications'
  ];

  function persist() {
    if (isApi()) return;
    try {
      LS.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Не удалось сохранить данные:', e);
      if (App.UI && App.UI.toast) {
        App.UI.toast({ kind: 'danger', title: 'Хранилище переполнено', text: 'Изменения не сохранены на диск' });
      }
    }
  }
  const persistSoon = U.debounce(persist, 400);

  function emit(name) {
    (listeners[name] || []).forEach(function (fn) { fn(name); });
    anyListeners.forEach(function (fn) { fn(name); });
  }

  /* --- Инициализация: демо-режим -------------------------------------------- */
  function init(force) {
    const raw = force ? null : LS.getItem(KEY);
    if (raw) {
      try { db = JSON.parse(raw); } catch (e) { db = null; }
    }
    if (!db || !db._meta || db._meta.version !== App.Seed.VERSION) {
      db = App.Seed.build();
      persist();
    }
    currentCompany = db._meta.currentCompany || (db.companies[0] && db.companies[0].id);
    applyUiPrefs();
    return db;
  }

  /* --- Инициализация: данные с сервера --------------------------------------- */
  function initFromServer(payload) {
    db = { _meta: { version: App.Seed.VERSION, source: 'api', loadedAt: new Date().toISOString() } };
    Object.keys(payload.collections || {}).forEach(function (name) {
      db[name] = payload.collections[name] || [];
    });
    if (!db.settings || !db.settings.length) db.settings = [App.Seed.defaultSettings()];

    const allowed = (payload.user && payload.user.companies) || [];
    const companies = db.companies || [];
    const preferred = allowed.length
      ? companies.filter(function (c) { return allowed.indexOf(c.id) > -1; })
      : companies;
    currentCompany = (preferred[0] || companies[0] || {}).id || null;
    db._meta.currentCompany = currentCompany;
    db._meta.blocked = payload.blocked || [];

    applyUiPrefs();
    emit('*');
    return db;
  }

  /** Настройки оформления восстанавливаются из localStorage поверх серверных */
  function applyUiPrefs() {
    try {
      const saved = JSON.parse(LS.getItem(UI_KEY) || '{}');
      Object.keys(saved).forEach(function (k) {
        if (UI_SETTINGS.indexOf(k) > -1) settings()[k] = saved[k];
      });
    } catch (e) { /* нет сохранённых настроек — используем значения по умолчанию */ }
  }

  function saveUiPrefs(patch) {
    try {
      const saved = JSON.parse(LS.getItem(UI_KEY) || '{}');
      UI_SETTINGS.forEach(function (k) {
        if (patch[k] !== undefined) saved[k] = patch[k];
      });
      LS.setItem(UI_KEY, JSON.stringify(saved));
    } catch (e) { /* не критично */ }
  }

  function reset() {
    if (isApi()) {
      return App.Api.bootstrap().then(function (payload) {
        initFromServer(payload);
        return db;
      });
    }
    db = App.Seed.build();
    currentCompany = db.companies[0].id;
    persist();
    emit('*');
    return db;
  }

  /* --- Организации ----------------------------------------------------------- */
  function company() {
    const list = db.companies || [];
    return list.filter(function (c) { return c.id === currentCompany; })[0] || list[0] || { name: '—' };
  }

  function setCompany(id) {
    currentCompany = id;
    db._meta.currentCompany = id;
    persistSoon();
    emit('*');
  }

  function isScoped(name) { return GLOBAL_COLLECTIONS.indexOf(name) === -1; }

  /* --- Чтение ---------------------------------------------------------------- */
  function raw(name) {
    if (!db[name]) db[name] = [];
    return db[name];
  }

  function all(name) {
    const rows = raw(name);
    if (!isScoped(name)) return rows.slice();
    return rows.filter(function (r) { return !r.companyId || r.companyId === currentCompany; });
  }

  function get(name, id) {
    const rows = raw(name);
    for (let i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function query(name, predicate) { return all(name).filter(predicate || function () { return true; }); }

  /* --- Запись ---------------------------------------------------------------- */
  function insert(name, obj, opts) {
    const o = opts || {};
    const rec = Object.assign({}, obj);
    if (!rec.id) rec.id = U.uid(name.slice(0, 3));
    if (isScoped(name) && !rec.companyId) rec.companyId = currentCompany;
    if (!rec.createdAt) rec.createdAt = new Date().toISOString();
    const user = App.Auth && App.Auth.user();
    if (!rec.author && user) rec.author = user.fullName;

    raw(name).unshift(rec);

    if (isApi()) {
      const payload = Object.assign({}, rec);
      delete payload.id;                       // идентификатор присваивает сервер
      App.Api.create(name, payload).then(function (saved) {
        Object.assign(rec, saved);             // подменяем временный id на настоящий
        if (!o.silent) emit(name);
      }).catch(function (e) {
        removeLocal(name, rec.id);
        emit(name);
        reportError('создать запись', e);
      });
    }

    if (!o.silent) {
      audit('create', name, rec);
      persistSoon();
      emit(name);
    }
    return rec;
  }

  function update(name, id, patch, opts) {
    const o = opts || {};
    const rec = get(name, id);
    if (!rec) return null;

    const before = JSON.parse(JSON.stringify(rec));
    Object.assign(rec, patch);
    rec.updatedAt = new Date().toISOString();
    const user = App.Auth && App.Auth.user();
    if (user) rec.updatedBy = user.fullName;

    if (isApi()) {
      App.Api.patch(name, id, patch).then(function (saved) {
        Object.assign(rec, saved);
      }).catch(function (e) {
        Object.assign(rec, before);            // откат: сервер отказал
        emit(name);
        reportError('сохранить изменения', e);
      });
    }

    if (!o.silent) {
      audit('update', name, rec, Object.keys(patch || {}).slice(0, 6).join(', '));
      persistSoon();
      emit(name);
    }
    return rec;
  }

  function remove(name, id, opts) {
    const o = opts || {};
    const rec = get(name, id);
    if (!rec) return null;
    const index = raw(name).indexOf(rec);

    removeLocal(name, id);

    if (isApi()) {
      App.Api.remove(name, id).catch(function (e) {
        raw(name).splice(Math.max(0, index), 0, rec);   // возвращаем на место
        emit(name);
        reportError('удалить запись', e);
      });
    }

    if (!o.silent) {
      audit('delete', name, rec);
      persistSoon();
      emit(name);
    }
    return rec;
  }

  function removeLocal(name, id) {
    const rows = raw(name);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return rows.splice(i, 1)[0];
    }
    return null;
  }

  function insertMany(name, list) {
    list.forEach(function (o) { insert(name, o, { silent: true }); });
    persistSoon();
    emit(name);
    return list.length;
  }

  function reportError(action, error) {
    const text = error && error.status === 403
      ? 'Недостаточно прав для этой операции'
      : (error && error.message) || 'Неизвестная ошибка';
    if (App.UI && App.UI.toast) {
      App.UI.toast({ kind: 'danger', title: 'Не удалось ' + action, text: text });
    }
    console.error('Ошибка обмена с сервером:', error);
  }

  /* --- Журнал аудита ---------------------------------------------------------
     В режиме API аудит пишет сервер (apps/common/services.py) — здесь только
     локальный журнал демо-режима.
     ------------------------------------------------------------------------ */
  const ENTITY_TITLES = {
    documents: 'Документ', contracts: 'Договор', counterparties: 'Контрагент',
    entries: 'Проводка', cashOrders: 'Кассовый ордер', payments: 'Платёж',
    products: 'Товар', stockMoves: 'Движение товара', inventories: 'Инвентаризация',
    sales: 'Продажа', purchaseOrders: 'Заказ поставщику', purchaseRequests: 'Заявка на закупку',
    deals: 'Сделка', tasks: 'Задача', employees: 'Сотрудник', payrolls: 'Расчёт зарплаты',
    requests: 'Внутренняя заявка', taxes: 'Налог', budgets: 'Бюджет', users: 'Пользователь',
    roles: 'Роль', signatures: 'Подпись', periods: 'Период', warehouses: 'Склад', returns: 'Возврат',
    fixedAssets: 'Основное средство', depreciations: 'Начисление амортизации'
  };

  const ACTIONS = { create: 'создал', update: 'изменил', delete: 'удалил', custom: 'выполнил' };

  function audit(action, name, rec, details) {
    if (isApi()) return;
    if (name === 'auditLog' || name === 'notifications') return;
    const user = App.Auth && App.Auth.user();
    raw('auditLog').unshift({
      id: U.uid('aud'),
      ts: new Date().toISOString(),
      user: user ? user.fullName : 'Система',
      userId: user ? user.id : null,
      role: user ? user.role : 'system',
      action: action,
      actionText: ACTIONS[action] || action,
      entity: name,
      entityTitle: ENTITY_TITLES[name] || name,
      entityId: rec ? rec.id : null,
      label: rec ? (rec.number || rec.name || rec.title || rec.fullName || rec.id) : '',
      details: details || '',
      companyId: currentCompany,
      ip: '192.168.1.20'
    });
    if (raw('auditLog').length > 4000) raw('auditLog').length = 4000;
  }

  function logAction(text, name, rec) {
    if (isApi()) return;   // бизнес-операции фиксирует сервер
    const user = App.Auth && App.Auth.user();
    raw('auditLog').unshift({
      id: U.uid('aud'),
      ts: new Date().toISOString(),
      user: user ? user.fullName : 'Система',
      userId: user ? user.id : null,
      role: user ? user.role : 'system',
      action: 'custom',
      actionText: text,
      entity: name || '',
      entityTitle: ENTITY_TITLES[name] || name || '',
      entityId: rec ? rec.id : null,
      label: rec ? (rec.number || rec.name || rec.title || '') : '',
      details: '',
      companyId: currentCompany,
      ip: '192.168.1.20'
    });
    persistSoon();
    emit('auditLog');
  }

  /* --- Настройки -------------------------------------------------------------- */
  function settings() {
    if (!db.settings || !db.settings.length) db.settings = [App.Seed.defaultSettings()];
    return db.settings[0];
  }

  function saveSettings(patch) {
    const current = settings();
    Object.assign(current, patch);
    saveUiPrefs(patch);

    if (isApi()) {
      const serverPatch = {};
      Object.keys(patch).forEach(function (k) {
        if (UI_SETTINGS.indexOf(k) === -1) serverPatch[k] = patch[k];
      });
      if (Object.keys(serverPatch).length && current.id) {
        App.Api.patch('settings', current.id, serverPatch).catch(function (e) {
          reportError('сохранить настройки', e);
        });
      }
    } else {
      persistSoon();
    }
    emit('settings');
  }

  /* --- Подписки ---------------------------------------------------------------- */
  function on(name, fn) {
    if (name === '*') { anyListeners.push(fn); return; }
    (listeners[name] = listeners[name] || []).push(fn);
  }

  function off(name, fn) {
    if (name === '*') {
      const i = anyListeners.indexOf(fn);
      if (i > -1) anyListeners.splice(i, 1);
      return;
    }
    const arr = listeners[name] || [];
    const i = arr.indexOf(fn);
    if (i > -1) arr.splice(i, 1);
  }

  /* --- Резервное копирование ---------------------------------------------------- */
  function exportJSON() { return JSON.stringify(db, null, 2); }

  function importJSON(text) {
    if (isApi()) {
      throw new Error('Восстановление из копии выполняется на сервере: manage.py loaddata');
    }
    const parsed = JSON.parse(text);
    if (!parsed || !parsed._meta) throw new Error('Файл не похож на резервную копию системы');
    db = parsed;
    currentCompany = db._meta.currentCompany || db.companies[0].id;
    persist();
    emit('*');
  }

  function usage() {
    const bytes = new Blob([JSON.stringify(db)]).size;
    const rows = Object.keys(db).reduce(function (a, k) { return a + (Array.isArray(db[k]) ? db[k].length : 0); }, 0);
    return { bytes: bytes, kb: Math.round(bytes / 1024), rows: rows, limit: 5120 };
  }

  App.Store = {
    init: init, initFromServer: initFromServer, reset: reset,
    all: all, raw: raw, get: get, query: query,
    insert: insert, insertMany: insertMany, update: update, remove: remove,
    on: on, off: off, emit: emit,
    settings: settings, saveSettings: saveSettings,
    company: company, setCompany: setCompany,
    companies: function () { return raw('companies'); },
    logAction: logAction,
    exportJSON: exportJSON, importJSON: importJSON, usage: usage,
    persist: persist,
    get db() { return db; }
  };
})(window.App);

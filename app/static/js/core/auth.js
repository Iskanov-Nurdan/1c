/* =============================================================================
   АВТОРИЗАЦИЯ И ПРАВА ДОСТУПА

   demo — проверка по локальной таблице пользователей;
   api  — JWT-токены Django (POST /api/token/), профиль и права приходят
          вместе с данными из /api/bootstrap/.

   Методы can()/canEdit() работают одинаково в обоих режимах, поэтому модули
   не знают, где выполняется проверка.
   ========================================================================== */
(function (App) {
  'use strict';

  const SESSION_KEY = 'erp1c.session';
  let current = null;        // запись пользователя (демо) или профиль (API)
  let profile = null;        // права, полученные с сервера
  const listeners = [];

  const isApi = function () { return App.Config && App.Config.isApi; };

  function readSession() {
    try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function writeSession(v) {
    try {
      if (v) window.localStorage.setItem(SESSION_KEY, JSON.stringify(v));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* приватный режим — сессия живёт только в памяти */ }
  }

  /* --- Демо-режим ------------------------------------------------------------ */
  function restore() {
    if (isApi()) return null;
    const session = readSession();
    if (!session) return null;
    const user = App.Store.get('users', session.userId);
    if (!user || !user.active) return null;
    current = user;
    return user;
  }

  function loginDemo(loginName, password) {
    const users = App.Store.raw('users');
    const user = users.filter(function (x) {
      return String(x.login).toLowerCase() === String(loginName || '').toLowerCase().trim();
    })[0];

    if (!user) return { ok: false, error: 'Пользователь не найден' };
    if (!user.active) return { ok: false, error: 'Учётная запись заблокирована' };
    if (user.password !== String(password)) return { ok: false, error: 'Неверный пароль' };

    current = user;
    App.Store.update('users', user.id, { lastLogin: new Date().toISOString() }, { silent: true });
    writeSession({ userId: user.id, ts: Date.now() });
    App.Store.logAction('вошёл в систему', 'users', user);
    listeners.forEach(function (fn) { fn(user); });
    return { ok: true, user: user };
  }

  /* --- Режим API -------------------------------------------------------------- */
  function applyProfile(payload) {
    profile = payload.user;
    current = {
      id: profile.id,
      login: profile.login,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      companies: profile.companies,
      active: true
    };
    App.Store.initFromServer(payload);
    listeners.forEach(function (fn) { fn(current); });
    return current;
  }

  /** Загрузка данных по сохранённому токену. Resolve(null) — нужен вход. */
  function restoreSession() {
    if (!isApi()) return Promise.resolve(restore());
    if (!App.Api.hasToken) return Promise.resolve(null);
    return App.Api.bootstrap()
      .then(function (payload) { return applyProfile(payload); })
      .catch(function () { App.Api.logout(); return null; });
  }

  function loginApi(loginName, password) {
    return App.Api.login(loginName, password).then(function (result) {
      if (!result.ok) return result;
      return App.Api.bootstrap().then(function (payload) {
        applyProfile(payload);
        return { ok: true, user: current };
      }).catch(function (e) {
        return { ok: false, error: 'Не удалось загрузить данные: ' + e.message };
      });
    });
  }

  /* --- Общий интерфейс --------------------------------------------------------- */
  /** Возвращает Promise в обоих режимах, чтобы вызывающий код был единым */
  function login(loginName, password) {
    if (isApi()) return loginApi(loginName, password);
    return Promise.resolve(loginDemo(loginName, password));
  }

  function logout() {
    if (current && !isApi()) App.Store.logAction('вышел из системы', 'users', current);
    if (isApi()) App.Api.logout();
    current = null;
    profile = null;
    writeSession(null);
    listeners.forEach(function (fn) { fn(null); });
  }

  function user() { return current; }

  function role() {
    if (!current) return null;
    const stored = App.Store.raw('roles').filter(function (r) { return r.code === current.role; })[0];
    if (stored) return stored;
    // Сервер прислал права, но справочник ролей роли недоступен
    if (profile) {
      return { code: profile.role, name: profile.role, permissions: profile.permissions, readonly: profile.readonly };
    }
    return null;
  }

  function roleName() {
    const r = role();
    return r ? (r.name || r.code) : '—';
  }

  function can(module) {
    if (!current) return false;
    const r = role();
    return !!r && (r.permissions || []).indexOf(module) !== -1;
  }

  function canEdit(module) {
    if (!can(module)) return false;
    const r = role();
    return (r.readonly || []).indexOf(module) === -1;
  }

  function canApprove() {
    return !!current && ['director', 'chief', 'admin'].indexOf(current.role) !== -1;
  }

  function canClosePeriod() {
    return !!current && ['chief', 'admin'].indexOf(current.role) !== -1;
  }

  function onChange(fn) { listeners.push(fn); }

  App.Auth = {
    login: login, logout: logout, restore: restore, restoreSession: restoreSession,
    user: user, role: role, roleName: roleName,
    can: can, canEdit: canEdit, canApprove: canApprove, canClosePeriod: canClosePeriod,
    onChange: onChange
  };
})(window.App);

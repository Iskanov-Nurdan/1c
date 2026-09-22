/* =============================================================================
   КЛИЕНТ REST API (Django + SimpleJWT)
   Единственное место, где приложение ходит в сеть. Все модули работают через
   App.Store, поэтому смена источника данных их не касается.
   ========================================================================== */
(function (App) {
  'use strict';

  const TOKEN_KEY = 'erp1c.jwt';
  let access = null;
  let refresh = null;
  let refreshing = null;

  function readTokens() {
    try {
      const raw = window.localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      access = data.access;
      refresh = data.refresh;
      return data;
    } catch (e) { return null; }
  }

  function writeTokens(data) {
    access = data ? data.access : null;
    refresh = data ? data.refresh : null;
    try {
      if (data) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* приватный режим — токен живёт до перезагрузки */ }
  }

  function url(path) {
    return App.Config.apiBase + String(path).replace(/^\//, '');
  }

  /** Базовый запрос: подставляет токен и один раз пробует обновить его при 401 */
  function request(method, path, body, opts) {
    const options = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (access && !options.anonymous) headers.Authorization = 'Bearer ' + access;

    return fetch(url(path), {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (response) {
      if (response.status === 401 && !options.retry && refresh) {
        return renewToken().then(function (ok) {
          if (!ok) return failure(response);
          return request(method, path, body, Object.assign({}, options, { retry: true }));
        });
      }
      if (!response.ok) return failure(response);
      if (response.status === 204) return null;
      return response.json();
    });
  }

  function failure(response) {
    return response.json().catch(function () { return {}; }).then(function (data) {
      const detail = data.detail
        || (data.non_field_errors && data.non_field_errors[0])
        || Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('; ')
        || ('HTTP ' + response.status);
      const error = new Error(detail);
      error.status = response.status;
      error.data = data;
      throw error;
    });
  }

  function renewToken() {
    if (refreshing) return refreshing;
    refreshing = fetch(url('token/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refresh })
    }).then(function (response) {
      if (!response.ok) throw new Error('refresh failed');
      return response.json();
    }).then(function (data) {
      writeTokens({ access: data.access, refresh: data.refresh || refresh });
      refreshing = null;
      return true;
    }).catch(function () {
      writeTokens(null);
      refreshing = null;
      return false;
    });
    return refreshing;
  }

  /* --- Публичные операции --------------------------------------------------- */
  function login(loginName, password) {
    return fetch(url('token/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginName, password: password })
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: false, error: data.detail || 'Неверный логин или пароль' };
        });
      }
      return response.json().then(function (data) {
        writeTokens({ access: data.access, refresh: data.refresh });
        return { ok: true };
      });
    }).catch(function (e) {
      return { ok: false, error: 'Сервер недоступен: ' + e.message };
    });
  }

  function logout() { writeTokens(null); }

  function bootstrap() { return request('GET', 'bootstrap/'); }

  function create(collection, payload) { return request('POST', collection + '/', payload); }

  function patch(collection, id, payload) {
    return request('PATCH', collection + '/' + encodeURIComponent(id) + '/', payload);
  }

  function destroy(collection, id) {
    return request('DELETE', collection + '/' + encodeURIComponent(id) + '/');
  }

  function summary() { return request('GET', 'summary/'); }

  App.Api = {
    request: request,
    login: login,
    logout: logout,
    bootstrap: bootstrap,
    create: create,
    patch: patch,
    remove: destroy,
    summary: summary,
    readTokens: readTokens,
    get hasToken() { return !!access; }
  };

  readTokens();
})(window.App);

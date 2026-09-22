/* =============================================================================
   МАРШРУТИЗАТОР (hash-based — работает и с file://)
   Route.add('documents', {title, module, render(ctx)})
   ========================================================================== */
(function (App) {
  'use strict';

  const routes = {};
  let notFound = null;
  let currentPath = null;
  let mountEl = null;
  const beforeHooks = [];
  const afterHooks = [];

  function add(path, def) { routes[path] = def; return App.Router; }

  function parse() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const qIndex = raw.indexOf('?');
    const path = (qIndex > -1 ? raw.slice(0, qIndex) : raw) || 'dashboard';
    const params = {};
    if (qIndex > -1) {
      raw.slice(qIndex + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        const kv = pair.split('=');
        params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    const segs = path.split('/');
    return { path: segs[0], sub: segs.slice(1), params: params, full: path };
  }

  function go(path, params) {
    let hash = '#/' + path;
    if (params) {
      const q = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      if (q) hash += '?' + q;
    }
    if (window.location.hash === hash) render();
    else window.location.hash = hash;
  }

  function current() { return parse(); }

  function render() {
    if (!mountEl) return;
    const ctx = parse();
    const def = routes[ctx.path] || notFound;
    currentPath = ctx.path;

    beforeHooks.forEach(function (fn) { fn(ctx, def); });

    App.U.clear(mountEl);

    if (!def) {
      mountEl.appendChild(App.UI.empty({
        icon: 'search',
        title: 'Раздел не найден',
        text: 'Страница «' + App.U.escapeHtml(ctx.path) + '» не существует или была перемещена.',
        action: { text: 'На дашборд', onClick: function () { go('dashboard'); } }
      }));
      return;
    }

    if (def.module && App.Auth.user() && !App.Auth.can(def.module)) {
      mountEl.appendChild(App.UI.empty({
        icon: 'lock',
        title: 'Доступ запрещён',
        text: 'У роли «' + App.Auth.roleName() + '» нет прав на раздел «' + (def.title || ctx.path) + '». Обратитесь к администратору системы.',
        action: { text: 'На дашборд', onClick: function () { go('dashboard'); } }
      }));
      return;
    }

    try {
      const node = def.render(ctx);
      if (node) mountEl.appendChild(node);
    } catch (err) {
      console.error('Ошибка отрисовки раздела', ctx.path, err);
      mountEl.appendChild(App.UI.empty({
        icon: 'alert',
        title: 'Ошибка отображения раздела',
        text: String(err && err.message ? err.message : err),
        action: { text: 'Перезагрузить', onClick: function () { window.location.reload(); } }
      }));
    }

    mountEl.scrollTop = 0;
    window.scrollTo(0, 0);
    afterHooks.forEach(function (fn) { fn(ctx, def); });
  }

  function start(mount) {
    mountEl = mount;
    window.addEventListener('hashchange', render);
    render();
  }

  App.Router = {
    add: add, go: go, render: render, start: start, current: current,
    routes: routes,
    setNotFound: function (d) { notFound = d; },
    before: function (fn) { beforeHooks.push(fn); },
    after: function (fn) { afterHooks.push(fn); },
    get path() { return currentPath; }
  };
})(window.App);

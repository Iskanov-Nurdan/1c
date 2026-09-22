/* =============================================================================
   КОНФИГУРАЦИЯ КЛИЕНТА
   Django передаёт настройки через <script id="app-config" type="application/json">
   (шаблонный фильтр json_script — безопасная передача данных в JS).
   Если тега нет, приложение работает автономно на демо-данных.
   ========================================================================== */
(function (App) {
  'use strict';

  function readConfig() {
    const node = document.getElementById('app-config');
    if (node) {
      try { return JSON.parse(node.textContent); }
      catch (e) { console.warn('Не удалось разобрать конфигурацию приложения', e); }
    }
    return window.APP_CONFIG || {};
  }

  const cfg = readConfig();
  const mode = cfg.mode === 'api' ? 'api' : 'demo';

  App.Config = {
    mode: mode,
    isApi: mode === 'api',
    apiBase: (cfg.apiBase || '/api/').replace(/\/?$/, '/'),
    staticUrl: (cfg.staticUrl || '/static/').replace(/\/?$/, '/'),
    companyName: cfg.companyName || '',
    currency: cfg.currency || 'сом',
    version: cfg.version || 1
  };
})(window.App);

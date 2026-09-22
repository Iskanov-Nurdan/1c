/* =============================================================================
   БИБЛИОТЕКА UI-КОМПОНЕНТОВ
   Всё, что рисуют модули, собирается из этих кирпичиков: страница, карточка,
   KPI, таблица с поиском/сортировкой/пагинацией/экспортом, форма, модальное
   окно, тосты, вкладки, таймлайн. Разметка семантическая, состояния
   (загрузка / пусто / ошибка) предусмотрены на уровне компонентов.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const el = U.el;
  const Icons = App.Icons;

  /* =========================================================================
     СТРАНИЦА
     ====================================================================== */
  function page(cfg) {
    const head = el('div.page__head', null, [
      el('div.page__title', null, [
        cfg.breadcrumbs ? el('div.breadcrumbs', null, cfg.breadcrumbs.map(function (b) { return el('span', { text: b }); })) : null,
        el('h1', { text: cfg.title }),
        cfg.subtitle ? el('p', { text: cfg.subtitle }) : null
      ]),
      cfg.actions && cfg.actions.length ? el('div.page__actions', null, cfg.actions) : null
    ]);
    return el('section', null, [head].concat(cfg.children || []));
  }

  /* =========================================================================
     КАРТОЧКА
     ====================================================================== */
  function card(cfg) {
    const c = cfg || {};
    const head = (c.title || c.tools) ? el('header.card__head', null, [
      el('div.card__title', null, [
        c.title ? el('h3', { text: c.title }) : null,
        c.subtitle ? el('small', { text: c.subtitle }) : null
      ]),
      c.tools ? el('div.card__tools', null, [].concat(c.tools)) : null
    ]) : null;

    return el('div.card', { class: c.class || '' }, [
      head,
      el('div.card__body' + (c.flush ? '.card__body--flush' : ''), null, [].concat(c.body || [])),
      c.foot ? el('footer.card__foot', null, [].concat(c.foot)) : null
    ]);
  }

  /* =========================================================================
     KPI-ПЛИТКА
     ====================================================================== */
  function stat(cfg) {
    const tone = cfg.tone ? '.stat--' + cfg.tone : '';
    let delta = null;
    if (cfg.delta !== undefined && cfg.delta !== null && isFinite(cfg.delta)) {
      const up = cfg.delta >= 0;
      const good = cfg.invert ? !up : up;
      delta = el('span.stat__delta', {
        class: good ? 'up' : 'down',
        text: (up ? '▲ ' : '▼ ') + U.num(Math.abs(cfg.delta), 1) + '%'
      });
    }
    return el('div.stat' + tone, { role: 'group' }, [
      el('div.stat__label', null, [
        cfg.icon ? Icons.get(cfg.icon) : null,
        el('span', { text: cfg.label })
      ]),
      el('div.stat__value', { text: cfg.value, title: cfg.valueTitle || '' }),
      (cfg.meta || delta || cfg.spark) ? el('div.stat__meta', null, [
        delta,
        cfg.meta ? el('span', { text: cfg.meta }) : null,
        // Спарклайн окрашен в акцент плитки: иначе его «рост/падение» спорит с дельтой,
        // которая считается по двум последним точкам, а не по краям ряда.
        cfg.spark ? App.Charts.spark(cfg.spark, { width: 70, height: 20, color: 'var(--accent, var(--brand-500))' }) : null
      ]) : null
    ]);
  }

  function statGrid(list, cols) {
    return el('div.grid.grid--' + (cols || 4), null, list.filter(Boolean).map(function (s) {
      return s instanceof Node ? s : stat(s);
    }));
  }

  /* =========================================================================
     БЕЙДЖИ И СТАТУСЫ
     ====================================================================== */
  const STATUS_MAP = {
    draft:     { t: 'Черновик',      tone: '' },
    new:       { t: 'Новая',         tone: 'info' },
    review:    { t: 'На проверке',   tone: 'warn' },
    approved:  { t: 'Одобрено',      tone: 'ok' },
    rejected:  { t: 'Отклонено',     tone: 'danger' },
    posted:    { t: 'Проведено',     tone: 'ok' },
    done:      { t: 'Выполнено',     tone: 'ok' },
    paid:      { t: 'Оплачено',      tone: 'ok' },
    partial:   { t: 'Частично',      tone: 'warn' },
    unpaid:    { t: 'Не оплачено',   tone: 'danger' },
    overdue:   { t: 'Просрочено',    tone: 'danger' },
    planned:   { t: 'Запланирован',  tone: 'info' },
    active:    { t: 'Действует',     tone: 'ok' },
    expired:   { t: 'Истёк',         tone: 'danger' },
    closed:    { t: 'Закрыт',        tone: '' },
    sent:      { t: 'Отправлен',     tone: 'info' },
    received:  { t: 'Получен',       tone: 'ok' },
    cancelled: { t: 'Отменён',       tone: 'danger' },
    executed:  { t: 'Исполнен',      tone: 'ok' },
    loaded:    { t: 'Загружена',     tone: 'warn' },
    processed: { t: 'Обработана',    tone: 'ok' },
    progress:  { t: 'В работе',      tone: 'info' },
    connected: { t: 'Подключено',    tone: 'ok' },
    disabled:  { t: 'Отключено',     tone: '' },
    pending:   { t: 'Настраивается', tone: 'warn' },
    work:      { t: 'Работает',      tone: 'ok' },
    vacation:  { t: 'В отпуске',     tone: 'info' },
    sick:      { t: 'Больничный',    tone: 'warn' },
    calculated:{ t: 'Рассчитано',    tone: 'info' },
    won:       { t: 'Выиграна',      tone: 'ok' },
    lost:      { t: 'Проиграна',     tone: 'danger' },
    contact:   { t: 'Контакт',       tone: 'info' },
    offer:     { t: 'КП отправлено', tone: 'info' },
    negotiation: { t: 'Переговоры',  tone: 'warn' }
  };

  function badge(text, tone) {
    return el('span.badge' + (tone ? '.badge--' + tone : ''), { text: text });
  }

  function status(code) {
    const s = STATUS_MAP[code] || { t: code || '—', tone: '' };
    return badge(s.t, s.tone);
  }

  function statusText(code) { return (STATUS_MAP[code] || { t: code }).t; }

  function statusOptions(codes) {
    return codes.map(function (c) { return { v: c, t: statusText(c) }; });
  }

  /* =========================================================================
     ТАБЛИЦА
     ====================================================================== */
  function table(cfg) {
    const state = {
      search: '',
      sort: cfg.sort ? Object.assign({}, cfg.sort) : null,
      page: 1,
      pageSize: cfg.pageSize || 20,
      filters: {}
    };
    (cfg.filters || []).forEach(function (f) { state.filters[f.k] = f.value || ''; });

    const root = el('div.card');
    const toolbar = el('div.table-toolbar');
    const body = el('div.table-wrap');
    const footer = el('div');

    /* --- Панель инструментов --- */
    if (cfg.search) {
      const inp = el('input.input', {
        type: 'search', placeholder: cfg.searchPlaceholder || 'Поиск…',
        'aria-label': 'Поиск по таблице',
        oninput: U.debounce(function (e) { state.search = e.target.value; state.page = 1; draw(); }, 200)
      });
      toolbar.appendChild(inp);
    }

    (cfg.filters || []).forEach(function (f) {
      const sel = el('select.select', {
        'aria-label': f.t,
        onchange: function (e) { state.filters[f.k] = e.target.value; state.page = 1; draw(); }
      }, [el('option', { value: '', text: f.t + ': все' })].concat(
        f.options.map(function (o) { return el('option', { value: o.v, text: o.t, selected: state.filters[f.k] === o.v }); })
      ));
      toolbar.appendChild(sel);
    });

    (cfg.toolbar || []).forEach(function (n) { toolbar.appendChild(n); });

    toolbar.appendChild(el('div.grow'));

    const countLabel = el('span.fs-sm.muted-2');
    toolbar.appendChild(countLabel);

    if (cfg.exportName !== false) {
      const exportCols = cfg.columns.filter(function (c) { return c.k; });

      // Excel — основной формат для бухгалтера: числа остаются числами
      toolbar.appendChild(el('button.btn.btn--sm.btn--ghost', {
        type: 'button', title: 'Выгрузить в Excel',
        onclick: function () {
          const rows = apply();
          if (!rows.length) return toast({ kind: 'warn', title: 'Нечего выгружать' });
          App.Xlsx.save(cfg.exportName || 'export', {
            name: cfg.sheetName || 'Данные',
            title: cfg.exportTitle || '',
            columns: exportCols,
            rows: rows
          });
        }
      }, [Icons.get('grid'), 'Excel']));

      // CSV оставлен для обмена с внешними системами
      toolbar.appendChild(el('button.btn.btn--sm.btn--ghost', {
        type: 'button', title: 'Экспорт в CSV',
        onclick: function () {
          const rows = apply();
          if (!rows.length) return toast({ kind: 'warn', title: 'Нечего экспортировать' });
          U.download(cfg.exportName || 'export.csv', U.toCSV(rows, exportCols));
          toast({ kind: 'ok', title: 'Файл выгружен', text: rows.length + ' строк' });
        }
      }, [Icons.get('download'), 'CSV']));
    }

    if (cfg.printable !== false) {
      toolbar.appendChild(el('button.icon-btn', {
        type: 'button', title: 'Печать', onclick: function () { window.print(); }
      }, [Icons.get('print')]));
    }

    root.appendChild(toolbar);
    root.appendChild(body);
    root.appendChild(footer);

    /* --- Фильтрация / сортировка --- */
    function apply() {
      let rows = (typeof cfg.rows === 'function' ? cfg.rows() : cfg.rows) || [];

      if (state.search && cfg.search) {
        const fields = Array.isArray(cfg.search) ? cfg.search : null;
        rows = rows.filter(function (r) {
          if (fields) return fields.some(function (f) { return U.includes(typeof f === 'function' ? f(r) : r[f], state.search); });
          return U.includes(JSON.stringify(r), state.search);
        });
      }

      Object.keys(state.filters).forEach(function (k) {
        const v = state.filters[k];
        if (!v) return;
        const f = (cfg.filters || []).filter(function (x) { return x.k === k; })[0];
        rows = rows.filter(function (r) {
          if (f && f.test) return f.test(r, v);
          return String(r[k]) === v;
        });
      });

      if (state.sort) {
        const col = cfg.columns.filter(function (c) { return (c.k || c.id) === state.sort.k; })[0];
        const getter = col && col.sort ? col.sort : function (r) { return r[state.sort.k]; };
        rows = U.sortBy(rows, getter, state.sort.dir);
      }
      return rows;
    }

    /* --- Отрисовка --- */
    function draw() {
      U.clear(body);
      U.clear(footer);
      const rows = apply();
      countLabel.textContent = rows.length + ' ' + T('w.rows');

      if (!rows.length) {
        body.appendChild(empty({
          icon: cfg.emptyIcon || 'inbox',
          title: cfg.emptyTitle || T('w.nothing'),
          text: state.search || Object.keys(state.filters).some(function (k) { return state.filters[k]; })
            ? 'По заданным условиям ничего не найдено. Измените фильтры или поисковый запрос.'
            : (cfg.emptyText || T('w.nothingHint')),
          action: cfg.emptyAction
        }));
        return;
      }

      const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
      const pageRows = cfg.pageSize === 0 ? rows : rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);

      const thead = el('thead', null, [
        el('tr', null, cfg.columns.map(function (c) {
          const key = c.k || c.id;
          const sortable = c.sortable !== false && key;
          const isSorted = state.sort && state.sort.k === key;
          return el('th', {
            class: (c.num ? 'num ' : '') + (sortable ? 'sortable ' : '') + (isSorted ? 'is-sorted' : ''),
            style: c.w ? { width: c.w } : null,
            scope: 'col',
            onclick: sortable ? function () {
              if (isSorted) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
              else state.sort = { k: key, dir: c.num ? 'desc' : 'asc' };
              draw();
            } : null
          }, [
            c.t || '',
            sortable ? el('span.sort-ind', { text: isSorted ? (state.sort.dir === 'asc' ? '↑' : '↓') : '↕' }) : null
          ]);
        }))
      ]);

      const tbody = el('tbody', null, pageRows.map(function (r, i) {
        const tr = el('tr', {
          class: (cfg.onRow ? 'is-clickable ' : '') + (cfg.rowClass ? cfg.rowClass(r) || '' : ''),
          onclick: cfg.onRow ? function (e) {
            if (e.target.closest('.row-actions')) return;
            cfg.onRow(r);
          } : null
        }, cfg.columns.map(function (c) {
          const content = c.render ? c.render(r, i) : (r[c.k] === undefined || r[c.k] === null || r[c.k] === '' ? '—' : r[c.k]);
          return el('td', { class: c.num ? 'num' : '' }, [content instanceof Node ? content : String(content)]);
        }));
        return tr;
      }));

      const tableEl = el('table.table' + (cfg.dangerRows ? '.table--rows-danger' : ''), null, [thead, tbody]);

      if (cfg.totals) {
        const totalsRow = el('tr', null, cfg.columns.map(function (c, ci) {
          if (ci === 0) return el('td', { text: T('w.total') });
          const fn = cfg.totals[c.k];
          if (!fn) return el('td');
          const v = typeof fn === 'function' ? fn(rows) : U.sum(rows, function (r) { return r[c.k]; });
          return el('td', { class: c.num ? 'num' : '', text: v });
        }));
        tableEl.appendChild(el('tfoot', null, [totalsRow]));
      }

      body.appendChild(tableEl);

      if (cfg.pageSize !== 0 && rows.length > state.pageSize) {
        footer.appendChild(pager(state, rows.length, totalPages, draw));
      }
    }

    draw();
    root.refresh = draw;
    return root;
  }

  function pager(state, total, totalPages, draw) {
    const btns = [];
    const push = function (n, label, disabled) {
      btns.push(el('button', {
        class: n === state.page ? 'is-active' : '',
        disabled: disabled || false, type: 'button',
        text: label || String(n),
        onclick: function () { state.page = n; draw(); }
      }));
    };
    push(Math.max(1, state.page - 1), '‹', state.page === 1);
    const from = Math.max(1, Math.min(state.page - 2, totalPages - 4));
    const to = Math.min(totalPages, from + 4);
    if (from > 1) push(1, '1');
    if (from > 2) btns.push(el('button', { disabled: true, text: '…', type: 'button' }));
    for (let i = from; i <= to; i++) push(i);
    if (to < totalPages - 1) btns.push(el('button', { disabled: true, text: '…', type: 'button' }));
    if (to < totalPages) push(totalPages, String(totalPages));
    push(Math.min(totalPages, state.page + 1), '›', state.page === totalPages);

    return el('div.pager', null, [
      el('span', { text: 'Показано ' + ((state.page - 1) * state.pageSize + 1) + '–' +
        Math.min(state.page * state.pageSize, total) + ' из ' + total }),
      el('div.pager__pages', null, btns)
    ]);
  }

  /* =========================================================================
     ФОРМА
     ====================================================================== */
  function form(cfg) {
    const values = Object.assign({}, cfg.values || {});
    const nodes = {};
    const grid = el('div.form-grid');

    (cfg.fields || []).forEach(function (f) {
      if (f.type === 'section') {
        grid.appendChild(el('div.form-section', { text: f.t }));
        return;
      }
      if (f.type === 'hidden') return;

      const id = 'f-' + f.k + '-' + Math.round(Math.random() * 1e6);
      let input;
      const common = {
        id: id, name: f.k,
        disabled: f.disabled || false,
        placeholder: f.placeholder || '',
        required: f.required || false
      };

      if (f.type === 'select') {
        const opts = (typeof f.options === 'function' ? f.options(values) : f.options) || [];
        input = el('select.select', common, [f.empty !== false ? el('option', { value: '', text: f.placeholder || '— не выбрано —' }) : null]
          .concat(opts.map(function (o) {
            return el('option', { value: o.v, text: o.t, selected: String(values[f.k]) === String(o.v) });
          })));
      } else if (f.type === 'textarea') {
        input = el('textarea.textarea', Object.assign({ rows: f.rows || 3 }, common));
        input.value = values[f.k] || '';
      } else if (f.type === 'checkbox') {
        input = el('input', Object.assign({ type: 'checkbox' }, common));
        input.checked = !!values[f.k];
        const wrapCheck = el('label.check', { for: id }, [input, el('span', { text: f.t })]);
        const fieldC = el('div.field.col-' + (f.col || 12), null, [wrapCheck, f.hint ? el('span.field__hint', { text: f.hint }) : null]);
        nodes[f.k] = { input: input, field: fieldC, def: f };
        grid.appendChild(fieldC);
        return;
      } else {
        const type = f.type === 'money' || f.type === 'number' ? 'number' : (f.type || 'text');
        input = el('input.input', Object.assign({
          type: type,
          step: f.step || (f.type === 'money' ? '0.01' : null),
          min: f.min !== undefined ? f.min : null,
          max: f.max !== undefined ? f.max : null,
          autocomplete: 'off'
        }, common));
        input.value = values[f.k] === undefined || values[f.k] === null ? '' : values[f.k];
      }

      const err = el('span.field__error', { hidden: true });
      const field = el('div.field.col-' + (f.col || 12), null, [
        el('label.field__label', { for: id }, [f.t, f.required ? el('span.req', { text: ' *' }) : null]),
        input,
        f.hint ? el('span.field__hint', { text: f.hint }) : null,
        err
      ]);
      nodes[f.k] = { input: input, field: field, error: err, def: f };
      grid.appendChild(field);

      if (f.onChange) input.addEventListener('change', function () { f.onChange(read(), api); });
    });

    function read() {
      const out = Object.assign({}, cfg.values || {});
      Object.keys(nodes).forEach(function (k) {
        const n = nodes[k];
        if (n.def.type === 'checkbox') out[k] = n.input.checked;
        else if (n.def.type === 'money' || n.def.type === 'number') out[k] = n.input.value === '' ? null : Number(n.input.value);
        else out[k] = n.input.value;
      });
      (cfg.fields || []).forEach(function (f) { if (f.type === 'hidden') out[f.k] = f.value; });
      return out;
    }

    function validate() {
      let ok = true;
      const v = read();
      Object.keys(nodes).forEach(function (k) {
        const n = nodes[k];
        if (!n.error) return;
        let msg = '';
        if (n.def.required && (v[k] === '' || v[k] === null || v[k] === undefined)) msg = 'Поле обязательно для заполнения';
        else if (n.def.validate) msg = n.def.validate(v[k], v) || '';
        else if ((n.def.type === 'money' || n.def.type === 'number') && v[k] !== null && isNaN(v[k])) msg = 'Введите число';
        n.field.classList.toggle('is-invalid', !!msg);
        n.error.textContent = msg;
        n.error.hidden = !msg;
        if (msg) ok = false;
      });
      if (!ok && cfg.onInvalid) cfg.onInvalid();
      return ok;
    }

    function setValue(k, val) {
      const n = nodes[k];
      if (!n) return;
      if (n.def.type === 'checkbox') n.input.checked = !!val;
      else n.input.value = val === null || val === undefined ? '' : val;
    }

    const api = { node: grid, read: read, validate: validate, setValue: setValue, nodes: nodes };
    return api;
  }

  /* =========================================================================
     МОДАЛЬНЫЕ ОКНА
     ====================================================================== */
  const modalRoot = function () { return U.$('#modal-root'); };
  let escHandler = null;

  function modal(cfg) {
    const root = modalRoot();
    const box = U.$('#modal');
    const titleEl = U.$('#modal-title');
    const bodyEl = U.$('#modal-body');
    const footEl = U.$('#modal-foot');

    box.className = 'modal' + (cfg.size ? ' modal--' + cfg.size : '');
    titleEl.textContent = cfg.title || '';
    U.clear(bodyEl);
    U.append(bodyEl, cfg.body);
    U.clear(footEl);

    const buttons = cfg.buttons || [{ text: T('a.close'), close: true }];
    footEl.className = 'modal__foot' + (cfg.footSplit ? ' modal__foot--split' : '');
    buttons.filter(Boolean).forEach(function (b) {
      if (b instanceof Node) { footEl.appendChild(b); return; }
      footEl.appendChild(el('button.btn', {
        class: b.kind ? 'btn--' + b.kind : '',
        type: 'button',
        onclick: function () {
          if (b.onClick && b.onClick() === false) return;
          if (b.close !== false) closeModal();
        }
      }, [b.icon ? Icons.get(b.icon) : null, b.text]));
    });

    root.hidden = false;
    U.$$('[data-close]', root).forEach(function (n) { n.onclick = closeModal; });

    escHandler = function (e) { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);

    const focusable = box.querySelector('input, select, textarea, button.btn--primary');
    if (focusable) setTimeout(function () { focusable.focus(); }, 60);

    return { close: closeModal, body: bodyEl };
  }

  function closeModal() {
    const root = modalRoot();
    if (!root || root.hidden) return;
    root.hidden = true;
    U.$('#modal-title').textContent = '';
    U.clear(U.$('#modal-body'));
    U.clear(U.$('#modal-foot'));
    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }

  /** Модальное окно с формой */
  function formModal(cfg) {
    const f = form({ fields: cfg.fields, values: cfg.values });
    modal({
      title: cfg.title,
      size: cfg.size || 'lg',
      body: [cfg.note ? el('div.alert.mb-4', null, [Icons.get('info'), cfg.note]) : null, f.node],
      buttons: [
        { text: T('a.cancel'), kind: 'ghost' },
        {
          text: cfg.saveText || T('a.save'), kind: 'primary', icon: 'check',
          onClick: function () {
            if (!f.validate()) {
              toast({ kind: 'danger', title: 'Проверьте форму', text: 'Не все обязательные поля заполнены' });
              return false;
            }
            const res = cfg.onSave(f.read(), f);
            return res === false ? false : true;
          }
        }
      ]
    });
    return f;
  }

  function confirm(cfg) {
    modal({
      title: cfg.title || 'Подтверждение',
      size: 'sm',
      body: el('p', { text: cfg.text || 'Вы уверены?' }),
      buttons: [
        { text: T('a.cancel'), kind: 'ghost' },
        {
          text: cfg.okText || T('a.confirm'),
          kind: cfg.danger ? 'danger' : 'primary',
          onClick: function () { cfg.onOk && cfg.onOk(); }
        }
      ]
    });
  }

  /** Просмотр карточки объекта: список пар + произвольные блоки */
  function detailModal(cfg) {
    modal({
      title: cfg.title,
      size: cfg.size || 'lg',
      body: [
        cfg.pairs ? kv(cfg.pairs) : null,
        cfg.extra ? el('div.mt-4', null, [].concat(cfg.extra)) : null
      ],
      buttons: cfg.buttons || [{ text: T('a.close'), kind: 'ghost' }],
      footSplit: cfg.footSplit
    });
  }

  /* =========================================================================
     ТОСТЫ
     ====================================================================== */
  function toast(cfg) {
    const host = U.$('#toasts');
    if (!host) return;
    const icons = { ok: 'checkCircle', danger: 'xCircle', warn: 'alert', info: 'info' };
    const node = el('div.toast' + (cfg.kind ? '.toast--' + cfg.kind : ''), null, [
      Icons.get(icons[cfg.kind] || 'info'),
      el('div.toast__body', null, [
        el('div.toast__title', { text: cfg.title || '' }),
        cfg.text ? el('div.toast__text', { text: cfg.text }) : null
      ]),
      el('button.icon-btn', {
        type: 'button', 'aria-label': 'Закрыть',
        onclick: function () { remove(); }
      }, [Icons.get('x')])
    ]);
    host.appendChild(node);
    let t = setTimeout(remove, cfg.timeout || 4200);
    function remove() {
      clearTimeout(t);
      node.classList.add('is-out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    return node;
  }

  /* =========================================================================
     СОСТОЯНИЯ
     ====================================================================== */
  function empty(cfg) {
    return el('div.empty', null, [
      el('div.empty__icon', null, [Icons.get(cfg.icon || 'inbox')]),
      el('h3', { text: cfg.title || T('w.nothing') }),
      el('p', { text: cfg.text || T('w.nothingHint') }),
      cfg.action ? el('button.btn.btn--primary', {
        type: 'button', onclick: cfg.action.onClick
      }, [Icons.get(cfg.action.icon || 'plus'), cfg.action.text]) : null
    ]);
  }

  function loading(text) {
    return el('div.empty', null, [
      el('div.spinner'),
      el('p', { text: text || T('w.loading') })
    ]);
  }

  function errorState(text, retry) {
    return el('div.empty', null, [
      el('div.empty__icon', null, [Icons.get('alert')]),
      el('h3', { text: 'Не удалось загрузить данные' }),
      el('p', { text: text || '' }),
      retry ? el('button.btn', { type: 'button', onclick: retry }, [Icons.get('refresh'), 'Повторить']) : null
    ]);
  }

  /* =========================================================================
     ВКЛАДКИ
     ====================================================================== */
  function tabs(list, opts) {
    const o = opts || {};
    const bar = el('div.tabs', { role: 'tablist' });
    const panel = el('div');
    let active = o.active || (list[0] && list[0].id);

    function show(id) {
      active = id;
      U.$$('.tabs__btn', bar).forEach(function (b) {
        const on = b.dataset.id === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      U.clear(panel);
      const t = list.filter(function (x) { return x.id === id; })[0];
      if (t) U.append(panel, t.render());
      if (o.onChange) o.onChange(id);
    }

    list.forEach(function (t) {
      bar.appendChild(el('button.tabs__btn', {
        type: 'button', role: 'tab', dataset: { id: t.id },
        onclick: function () { show(t.id); }
      }, [t.title, t.count !== undefined ? el('span.badge', { text: String(t.count), style: { marginLeft: '6px' } }) : null]));
    });

    const root = el('div', null, [bar, panel]);
    show(active);
    root.show = show;
    return root;
  }

  /* =========================================================================
     МЕЛОЧИ
     ====================================================================== */
  function kv(pairs) {
    const dl = el('dl.kv');
    pairs.filter(Boolean).forEach(function (p) {
      dl.appendChild(el('dt', { text: p[0] }));
      dl.appendChild(el('dd', null, [p[1] instanceof Node ? p[1] : String(p[1] === undefined || p[1] === null || p[1] === '' ? '—' : p[1])]));
    });
    return dl;
  }

  function timeline(steps) {
    return el('div.timeline', null, steps.map(function (s) {
      const cls = s.state === 'done' ? '.is-done' : s.state === 'current' ? '.is-current' : s.state === 'rejected' ? '.is-reject' : '';
      return el('div.timeline__item' + cls, null, [
        el('div.timeline__title', { text: (s.action || s.title) + (s.role ? ' · ' + s.role : '') }),
        el('div.timeline__meta', { text: [s.name, s.ts ? U.fmtDateTime(s.ts) : (s.state === 'current' ? 'ожидает решения' : 'ожидает')].filter(Boolean).join(' · ') }),
        s.comment ? el('div.alert.alert--danger.mt-2', { text: s.comment }) : null
      ]);
    }));
  }

  function progress(value, max, tone) {
    const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
    return el('div.progress', null, [
      el('div.progress__bar' + (tone ? '.progress__bar--' + tone : ''), { style: { width: p + '%' } })
    ]);
  }

  function meter(cfg) {
    const p = (cfg.value / (cfg.max || 1)) * 100;
    const tone = cfg.tone || (p > 100 ? 'danger' : p > 85 ? 'warn' : 'ok');
    return el('div.meter', null, [
      el('div.meter__top', null, [
        el('span', { text: cfg.label }),
        el('b', { text: cfg.text || (U.moneyShort(cfg.value) + ' / ' + U.moneyShort(cfg.max)) })
      ]),
      progress(Math.min(cfg.value, cfg.max), cfg.max, tone),
      cfg.hint ? el('span.fs-xs.muted-2', { text: cfg.hint }) : null
    ]);
  }

  function dropzone(cfg) {
    const input = el('input', {
      type: 'file', hidden: true, multiple: cfg.multiple !== false,
      accept: cfg.accept || '.pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt',
      onchange: function (e) { handle(e.target.files); }
    });
    const zone = el('div.dropzone', {
      role: 'button', tabindex: '0',
      onclick: function () { input.click(); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
      ondragover: function (e) { e.preventDefault(); zone.classList.add('is-over'); },
      ondragleave: function () { zone.classList.remove('is-over'); },
      ondrop: function (e) {
        e.preventDefault();
        zone.classList.remove('is-over');
        handle(e.dataTransfer.files);
      }
    }, [
      Icons.get('upload', '', 28),
      el('strong', { text: cfg.title || 'Перетащите файлы сюда' }),
      el('span.fs-sm', { text: cfg.hint || 'или нажмите для выбора · PDF, JPG, PNG, XLSX' }),
      input
    ]);

    function handle(files) {
      const list = Array.prototype.slice.call(files || []);
      if (list.length && cfg.onFiles) cfg.onFiles(list);
    }
    return zone;
  }

  function fileItem(name, size, onRemove) {
    const ext = String(name).split('.').pop().toUpperCase().slice(0, 4);
    return el('div.file-item', null, [
      el('div.file-item__ico', { text: ext }),
      el('div.grow', null, [
        el('div.fs-md.truncate', { text: name }),
        el('div.fs-xs.muted-2', { text: size ? Math.round(size / 1024) + ' КБ' : '' })
      ]),
      onRemove ? el('button.icon-btn', { type: 'button', 'aria-label': 'Удалить', onclick: onRemove }, [Icons.get('trash')]) : null
    ]);
  }

  function btn(text, opts) {
    const o = opts || {};
    return el('button.btn', {
      class: (o.kind ? 'btn--' + o.kind : '') + (o.size ? ' btn--' + o.size : ''),
      type: 'button', title: o.title || '', disabled: o.disabled || false,
      onclick: o.onClick
    }, [o.icon ? Icons.get(o.icon) : null, text]);
  }

  function iconBtn(icon, title, onClick, kind) {
    return el('button.icon-btn', {
      type: 'button', title: title, 'aria-label': title, onclick: onClick,
      style: kind === 'danger' ? { color: 'var(--danger-fg)' } : null
    }, [Icons.get(icon)]);
  }

  /** Стандартный набор действий строки таблицы */
  function rowActions(list) {
    return el('div.row-actions', null, list.filter(Boolean).map(function (a) {
      return iconBtn(a.icon, a.title, function (e) { e.stopPropagation(); a.onClick(); }, a.kind);
    }));
  }

  App.UI = {
    page: page, card: card, stat: stat, statGrid: statGrid,
    badge: badge, status: status, statusText: statusText, statusOptions: statusOptions, STATUS_MAP: STATUS_MAP,
    table: table, form: form,
    modal: modal, closeModal: closeModal, formModal: formModal, confirm: confirm, detailModal: detailModal,
    toast: toast, empty: empty, loading: loading, errorState: errorState,
    tabs: tabs, kv: kv, timeline: timeline, progress: progress, meter: meter,
    dropzone: dropzone, fileItem: fileItem, btn: btn, iconBtn: iconBtn, rowActions: rowActions
  };
})(window.App);

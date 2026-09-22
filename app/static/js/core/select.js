/* =============================================================================
   СЕЛЕКТ: доступный выпадающий список поверх нативного <select>

   ЗАЧЕМ
   Список нативного <select> рисует операционная система: его нельзя ни
   покрасить, ни скруглить, ни выровнять по сетке приложения. В тёмной теме
   он выпадает из дизайн-системы особенно заметно.

   ПРИНЦИП — прогрессивное улучшение, а не замена.
   Нативный <select> остаётся в DOM и остаётся источником истины: значение,
   события change, сериализация формы и нативная валидация работают как
   раньше. Поверх него строится кнопка-триггер и всплывающий listbox.
   Поэтому существующий код (`sel.value`, `onchange`, `UI.form().read()`)
   менять не нужно — апгрейд подхватывается автоматически.

   ДОСТУПНОСТЬ
   Паттерн WAI-ARIA «combobox + listbox»: фокус остаётся на триггере (или в
   поле фильтра), активный пункт объявляется через aria-activedescendant.
   Клавиатура: ↑ ↓ Home End PageUp PageDown Enter Space Esc, Alt+↓, а также
   набор первых букв (typeahead), как в нативном списке.

   ПЕРЕНОС В ДРУГОЙ ПРОЕКТ
   Файл самодостаточный: не зависит ни от одного модуля приложения. Нужны
   только select.css и подключение скрипта. Без App-объекта компонент
   публикуется как window.PrettySelect.
   ========================================================================== */
(function (App) {
  'use strict';

  /* Минимальное число опций, при котором появляется поле фильтра.
     Ниже порога поиск только мешает: список и так виден целиком. */
  const SEARCH_FROM = 8;
  const TYPEAHEAD_MS = 700;
  const MOBILE = '(max-width: 640px)';
  const GAP = 6;          /* зазор между полем и списком */
  const EDGE = 8;         /* минимальный отступ от края экрана */
  const MAX_H = 320;      /* максимальная высота списка на десктопе */
  const MIN_H = 160;

  const CARET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  let seq = 0;
  let open = null;        /* единственный открытый список на всё приложение */
  let swallowClick = false;

  /* =========================================================================
     ПОМОЩНИКИ
     ====================================================================== */
  function make(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function isMobile() {
    return window.matchMedia(MOBILE).matches;
  }

  /** Нормализация для поиска: регистр и «ё» не должны мешать найти пункт */
  function norm(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е').trim();
  }

  /* =========================================================================
     ЭКЗЕМПЛЯР
     ====================================================================== */
  function Instance(select) {
    const self = this;

    this.select = select;
    this.id = 'xs-' + (++seq);
    this.items = [];
    this.active = -1;
    this.query = '';
    this.typed = '';
    this.typedAt = 0;

    /* Обёртка встаёт на место селекта, сам селект переезжает внутрь.
       Он не hidden, а прозрачный: скрытый required-элемент ломает нативную
       валидацию формы («not focusable»), а прозрачный — нет. */
    const wrap = make('div', 'xselect');
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('xselect__native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    /* Триггер наследует классы исходного селекта (.select, .select--ghost,
       .select--lang и т.д.), поэтому подхватывает всю типовую геометрию
       полей ввода без единой новой строки CSS. */
    const trigger = make('button', select.className.replace('xselect__native', '').trim() + ' xselect__trigger');
    trigger.type = 'button';
    trigger.id = this.id + '-btn';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', this.id + '-list');

    const label = make('span', 'xselect__label');
    trigger.appendChild(label);
    trigger.appendChild(make('span', 'xselect__caret', CARET));
    wrap.appendChild(trigger);

    this.wrap = wrap;
    this.trigger = trigger;
    this.label = label;

    /* Подпись поля нужна списку как aria-label — иначе на мобильном
       листе непонятно, что именно выбирают. */
    this.title = select.getAttribute('aria-label')
      || (select.id && document.querySelector('label[for="' + select.id + '"]')
        ? document.querySelector('label[for="' + select.id + '"]').textContent.replace('*', '').trim()
        : '');
    if (this.title) trigger.setAttribute('aria-label', this.title);

    /* <label for="..."> указывал на нативный селект — клик по подписи
       фокусировал невидимый элемент. Перевешиваем подпись на триггер. */
    const lab = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
    if (lab) lab.setAttribute('for', trigger.id);

    trigger.addEventListener('click', function () { self.toggle(); });
    trigger.addEventListener('keydown', function (e) { self.onTriggerKey(e); });

    /* Программная установка значения (`sel.value = x`) не поднимает change,
       поэтому перехватываем присваивание и обновляем подпись сами. */
    this.patchValue('value');
    this.patchValue('selectedIndex');
    select.addEventListener('change', function () { self.sync(); });

    /* Опции могут дорисовываться асинхронно (справочники, зависимые поля) */
    this.mo = new MutationObserver(function () { self.sync(); });
    this.mo.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

    this.sync();
  }

  Instance.prototype.patchValue = function (prop) {
    const self = this;
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(this.select, prop, {
      configurable: true,
      enumerable: false,
      get: function () { return desc.get.call(this); },
      set: function (v) { desc.set.call(this, v); self.sync(); }
    });
  };

  /** Подпись, состояние и структура списка — из нативного селекта */
  Instance.prototype.sync = function () {
    const select = this.select;
    const items = [];

    Array.prototype.forEach.call(select.children, function (node) {
      if (node.tagName === 'OPTGROUP') {
        items.push({ group: true, text: node.label });
        Array.prototype.forEach.call(node.children, function (o) {
          items.push({ value: o.value, text: o.textContent, disabled: o.disabled || node.disabled });
        });
      } else if (node.tagName === 'OPTION') {
        items.push({ value: node.value, text: node.textContent, disabled: node.disabled });
      }
    });
    this.items = items;

    const picked = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    const text = picked ? picked.textContent.trim() : '';
    /* Пустое значение показываем как подсказку, а не как выбранный пункт */
    const empty = !picked || picked.value === '';

    this.label.textContent = text || (select.getAttribute('data-placeholder') || '—');
    this.trigger.classList.toggle('is-empty', empty);
    this.trigger.disabled = select.disabled;
    this.wrap.classList.toggle('is-disabled', select.disabled);

    if (open === this) this.renderList();
  };

  /* --- Открытие и закрытие ------------------------------------------------- */
  Instance.prototype.toggle = function () {
    if (open === this) this.close();
    else this.openPopup();
  };

  Instance.prototype.openPopup = function () {
    if (open) open.close();
    if (this.select.disabled) return;

    const self = this;
    const mobile = isMobile();
    const searchable = this.items.filter(function (i) { return !i.group; }).length >= SEARCH_FROM;

    const pop = make('div', 'xselect-pop' + (mobile ? ' xselect-pop--sheet' : ''));
    pop.id = this.id + '-pop';

    if (mobile) {
      const head = make('div', 'xselect-pop__head');
      head.appendChild(make('span', 'xselect-pop__title', this.title || 'Выбор значения'));
      const close = make('button', 'xselect-pop__close', '✕');
      close.type = 'button';
      close.setAttribute('aria-label', 'Закрыть');
      close.addEventListener('click', function () { self.close(); });
      head.appendChild(close);
      pop.appendChild(head);
    }

    if (searchable) {
      const box = make('div', 'xselect-pop__search');
      const input = make('input', 'xselect-pop__input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.placeholder = 'Поиск…';
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-controls', this.id + '-list');
      input.setAttribute('aria-label', (this.title ? this.title + ': ' : '') + 'поиск по списку');
      input.addEventListener('input', function () {
        self.query = input.value;
        self.renderList();
        self.moveTo(self.firstEnabled(), true);
      });
      input.addEventListener('keydown', function (e) { self.onListKey(e); });
      box.appendChild(input);
      pop.appendChild(box);
      this.search = input;
    } else {
      this.search = null;
    }

    const list = make('ul', 'xselect-pop__list');
    list.id = this.id + '-list';
    list.setAttribute('role', 'listbox');
    if (this.title) list.setAttribute('aria-label', this.title);
    pop.appendChild(list);
    pop.appendChild(make('div', 'xselect-pop__empty', 'Ничего не найдено'));

    /* mousedown, а не click: список не должен успеть закрыться от
       глобального обработчика раньше, чем сработает выбор. */
    list.addEventListener('mousedown', function (e) {
      const li = e.target.closest('.xselect-opt');
      if (!li || li.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      self.pick(Number(li.getAttribute('data-i')));
    });
    list.addEventListener('mousemove', function (e) {
      const li = e.target.closest('.xselect-opt');
      if (li && li.getAttribute('aria-disabled') !== 'true') self.moveTo(Number(li.getAttribute('data-i')), false);
    });

    this.pop = pop;
    this.list = list;
    this.query = '';

    if (mobile) {
      this.backdrop = make('div', 'xselect-backdrop');
      this.backdrop.addEventListener('click', function () { self.close(); });
      document.body.appendChild(this.backdrop);
    }
    document.body.appendChild(pop);

    open = this;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.trigger.classList.add('is-open');

    this.renderList();
    this.moveTo(this.currentIndex(), true);
    if (!mobile) this.place();

    if (this.search) this.search.focus();
    else this.trigger.focus();
  };

  Instance.prototype.close = function () {
    if (open !== this) return;
    open = null;
    if (this.pop) this.pop.remove();
    if (this.backdrop) this.backdrop.remove();
    this.pop = this.list = this.search = this.backdrop = null;
    this.active = -1;
    this.query = '';
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.classList.remove('is-open');
    this.trigger.removeAttribute('aria-activedescendant');
  };

  /* --- Отрисовка списка ---------------------------------------------------- */
  Instance.prototype.renderList = function () {
    if (!this.list) return;
    const self = this;
    const q = norm(this.query);
    const current = this.select.value;
    let shown = 0;

    this.list.innerHTML = '';

    this.items.forEach(function (item, i) {
      if (item.group) {
        /* Заголовок группы виден, только если в ней что-то осталось */
        const next = self.items.slice(i + 1);
        const till = next.findIndex(function (x) { return x.group; });
        const inGroup = (till === -1 ? next : next.slice(0, till));
        if (q && !inGroup.some(function (x) { return norm(x.text).indexOf(q) !== -1; })) return;
        self.list.appendChild(make('li', 'xselect-group', item.text));
        return;
      }
      if (q && norm(item.text).indexOf(q) === -1) return;

      const li = make('li', 'xselect-opt');
      li.id = self.id + '-o' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('data-i', String(i));
      li.setAttribute('aria-selected', String(item.value === current));
      if (item.disabled) li.setAttribute('aria-disabled', 'true');
      if (item.value === current) li.classList.add('is-selected');
      if (item.value === '') li.classList.add('is-placeholder');

      li.appendChild(make('span', 'xselect-opt__text', highlight(item.text, q)));
      li.appendChild(make('span', 'xselect-opt__tick', TICK));
      self.list.appendChild(li);
      shown++;
    });

    this.pop.classList.toggle('is-empty', shown === 0);
    this.paintActive();
  };

  /** Подсветка совпадения — без innerHTML пользовательского текста */
  function highlight(text, q) {
    const safe = text.replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
    if (!q) return safe;
    const at = norm(text).indexOf(q);
    if (at === -1) return safe;
    const esc = function (s) { return s.replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; }); };
    return esc(text.slice(0, at)) + '<mark>' + esc(text.slice(at, at + q.length)) + '</mark>' + esc(text.slice(at + q.length));
  }

  /* --- Активный пункт ------------------------------------------------------ */
  Instance.prototype.visible = function () {
    if (!this.list) return [];
    return Array.prototype.map.call(this.list.querySelectorAll('.xselect-opt:not([aria-disabled="true"])'),
      function (li) { return Number(li.getAttribute('data-i')); });
  };

  Instance.prototype.currentIndex = function () {
    const current = this.select.value;
    const vis = this.visible();
    const self = this;
    const found = vis.filter(function (i) { return self.items[i].value === current; })[0];
    return found === undefined ? this.firstEnabled() : found;
  };

  Instance.prototype.firstEnabled = function () {
    const vis = this.visible();
    return vis.length ? vis[0] : -1;
  };

  Instance.prototype.moveTo = function (i, scroll) {
    this.active = i;
    this.paintActive(scroll);
  };

  Instance.prototype.paintActive = function (scroll) {
    if (!this.list) return;
    const self = this;
    let node = null;
    Array.prototype.forEach.call(this.list.querySelectorAll('.xselect-opt'), function (li) {
      const on = Number(li.getAttribute('data-i')) === self.active;
      li.classList.toggle('is-active', on);
      if (on) node = li;
    });
    const owner = this.search || this.trigger;
    if (node) owner.setAttribute('aria-activedescendant', node.id);
    else owner.removeAttribute('aria-activedescendant');
    if (node && scroll !== false) {
      const box = this.list.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      if (r.top < box.top) this.list.scrollTop -= box.top - r.top;
      else if (r.bottom > box.bottom) this.list.scrollTop += r.bottom - box.bottom;
    }
  };

  Instance.prototype.step = function (delta) {
    const vis = this.visible();
    if (!vis.length) return;
    let at = vis.indexOf(this.active);
    if (at === -1) at = delta > 0 ? -1 : vis.length;
    let next = at + delta;
    next = Math.max(0, Math.min(vis.length - 1, next));
    this.moveTo(vis[next], true);
  };

  Instance.prototype.pick = function (i) {
    const item = this.items[i];
    if (!item || item.disabled) return;
    const changed = this.select.value !== item.value;
    this.select.value = item.value;
    this.close();
    this.trigger.focus();
    if (changed) {
      this.select.dispatchEvent(new Event('input', { bubbles: true }));
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  /* --- Позиционирование ---------------------------------------------------- */
  Instance.prototype.place = function () {
    if (!this.pop || this.pop.classList.contains('xselect-pop--sheet')) return;
    const pop = this.pop;
    const r = this.trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;

    pop.style.minWidth = r.width + 'px';
    pop.style.maxWidth = (vw - EDGE * 2) + 'px';

    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = below < Math.min(pop.scrollHeight, MIN_H) && above > below;

    pop.style.maxHeight = Math.max(MIN_H, Math.min(MAX_H, up ? above : below)) + 'px';
    pop.classList.toggle('is-up', up);

    const w = pop.offsetWidth;
    pop.style.left = Math.max(EDGE, Math.min(r.left, vw - w - EDGE)) + 'px';
    pop.style.top = up ? '' : (r.bottom + GAP) + 'px';
    pop.style.bottom = up ? (vh - r.top + GAP) + 'px' : '';
  };

  /* --- Клавиатура ---------------------------------------------------------- */
  Instance.prototype.onTriggerKey = function (e) {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      this.openPopup();
      return;
    }
    /* Набор букв на закрытом списке меняет значение, как в нативном селекте */
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = this.typeahead(k);
      if (i !== -1) this.pick(i);
    }
  };

  Instance.prototype.onListKey = function (e) {
    const k = e.key;
    if (k === 'ArrowDown') { e.preventDefault(); this.step(1); return; }
    if (k === 'ArrowUp') { e.preventDefault(); this.step(-1); return; }
    if (k === 'PageDown') { e.preventDefault(); this.step(8); return; }
    if (k === 'PageUp') { e.preventDefault(); this.step(-8); return; }
    if (k === 'Home') { e.preventDefault(); this.moveTo(this.firstEnabled(), true); return; }
    if (k === 'End') {
      e.preventDefault();
      const vis = this.visible();
      if (vis.length) this.moveTo(vis[vis.length - 1], true);
      return;
    }
    if (k === 'Enter' || ((k === ' ' || k === 'Spacebar') && !this.search)) {
      e.preventDefault();
      if (this.active !== -1) this.pick(this.active);
      return;
    }
    if (k === 'Tab') { this.close(); return; }
    if (!this.search && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = this.typeahead(k);
      if (i !== -1) this.moveTo(i, true);
    }
  };

  /** Поиск по набранным буквам: «до» + «го» → «Договоры» */
  Instance.prototype.typeahead = function (ch) {
    const now = Date.now();
    this.typed = now - this.typedAt > TYPEAHEAD_MS ? ch : this.typed + ch;
    this.typedAt = now;
    const q = norm(this.typed);
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (!items[i].group && !items[i].disabled && norm(items[i].text).indexOf(q) === 0) return i;
    }
    return -1;
  };

  Instance.prototype.destroy = function () {
    if (open === this) this.close();
    if (this.mo) this.mo.disconnect();
    delete this.select.value;
    delete this.select.selectedIndex;
    this.select.classList.remove('xselect__native');
    this.select.removeAttribute('aria-hidden');
    this.select.removeAttribute('tabindex');
    this.wrap.parentNode.insertBefore(this.select, this.wrap);
    this.wrap.remove();
    this.select.__xselect = null;
  };

  /* =========================================================================
     ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
     ====================================================================== */
  document.addEventListener('mousedown', function (e) {
    if (!open) return;
    if (e.target.closest('.xselect-pop') || e.target.closest('.xselect__trigger')) return;
    /* Клик по подложке модалки не должен закрывать сразу и список, и окно */
    swallowClick = !!e.target.closest('.modal-root__backdrop, [data-close]');
    open.close();
  }, true);

  document.addEventListener('click', function (e) {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  /* Escape перехватываем в фазе перехвата: иначе модальное окно закроется
     вместе со списком. */
  document.addEventListener('keydown', function (e) {
    if (!open || e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    const inst = open;
    inst.close();
    inst.trigger.focus();
  }, true);

  document.addEventListener('focusin', function (e) {
    if (!open) return;
    if (e.target.closest('.xselect-pop') || e.target === open.trigger) return;
    open.close();
  });

  window.addEventListener('resize', function () { if (open) open.place(); });
  window.addEventListener('scroll', function () {
    if (!open) return;
    /* Ушёл за пределы экрана вместе с полем — закрываем, иначе догоняем */
    const r = open.trigger.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) open.close();
    else open.place();
  }, true);

  /* =========================================================================
     ПУБЛИЧНЫЙ ИНТЕРФЕЙС
     ====================================================================== */
  function skip(select) {
    return select.multiple
      || select.size > 1
      || select.hasAttribute('data-no-xselect')
      || select.closest('.no-xselect');
  }

  /** Апгрейд всех подходящих селектов внутри узла (по умолчанию — документа) */
  function enhance(root) {
    const scope = root || document;
    const list = scope.querySelectorAll ? scope.querySelectorAll('select.select') : [];
    Array.prototype.forEach.call(list, function (select) {
      if (select.__xselect || skip(select)) return;
      select.__xselect = new Instance(select);
    });
    if (scope.matches && scope.matches('select.select') && !scope.__xselect && !skip(scope)) {
      scope.__xselect = new Instance(scope);
    }
  }

  function refresh(select) {
    if (select && select.__xselect) select.__xselect.sync();
    else enhance(select);
  }

  function destroy(select) {
    if (select && select.__xselect) select.__xselect.destroy();
  }

  /** Автоапгрейд: SPA перерисовывает разделы, ловим новые селекты сами */
  function observe(root) {
    const scope = root || document.body;
    let queued = false;

    enhance(scope);
    new MutationObserver(function (records) {
      let dirty = false;
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType === 1 && !n.classList.contains('xselect')) dirty = true;
        });
      });
      /* Список открыт, а его поле уже удалено из DOM — закрываем */
      if (open && !document.contains(open.trigger)) open.close();
      /* Разделы перерисовываются пачками узлов: один проход на кадр */
      if (dirty && !queued) {
        queued = true;
        requestAnimationFrame(function () { queued = false; enhance(scope); });
      }
    }).observe(scope, { childList: true, subtree: true });
  }

  const api = { enhance: enhance, refresh: refresh, destroy: destroy, observe: observe };

  window.PrettySelect = api;
  if (App) App.Select = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { observe(document.body); });
  } else {
    observe(document.body);
  }
})(window.App);

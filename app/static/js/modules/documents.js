/* =============================================================================
   МОДУЛЬ: Документооборот · Договоры · Согласование · ЭЦП
   ТЗ п. 3, 4, 16, 22
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, el = U.el;

  const DOC_TYPES = [
    { v: 'invoice', t: 'Счёт на оплату' },
    { v: 'waybill', t: 'Накладная' },
    { v: 'act', t: 'Акт выполненных работ' },
    { v: 'contract', t: 'Договор' },
    { v: 'payment', t: 'Платёжный документ' },
    { v: 'cash_order', t: 'Кассовый ордер' },
    { v: 'vat_invoice', t: 'Счёт-фактура' },
    { v: 'poa', t: 'Доверенность' },
    { v: 'statement', t: 'Банковская выписка' },
    { v: 'hr', t: 'Кадровый документ' }
  ];

  function typeName(code) {
    const t = DOC_TYPES.filter(function (x) { return x.v === code; })[0];
    return t ? t.t : code;
  }

  /* =========================================================================
     ДОКУМЕНТЫ (ЭДО)
     ====================================================================== */
  function documents() {
    const canEdit = App.Auth.canEdit('documents');
    const rows = App.Store.all('documents');

    const tbl = UI.table({
      search: ['number', 'typeName', 'ocrText', function (r) { return H.cpName(r.counterpartyId); }],
      searchPlaceholder: 'Поиск по номеру, контрагенту и содержимому (OCR)…',
      filters: [
        { k: 'type', t: 'Тип', options: DOC_TYPES },
        { k: 'status', t: 'Статус', options: UI.statusOptions(['draft', 'review', 'approved', 'posted', 'rejected']) },
        { k: 'ocr', t: 'OCR', options: [{ v: 'yes', t: 'распознан' }, { v: 'no', t: 'не распознан' }],
          test: function (r, v) { return v === 'yes' ? !!r.ocr : !r.ocr; } }
      ],
      columns: [
        { k: 'number', t: '№ документа', w: '150px', render: function (r) {
          return el('div', null, [
            el('div.strong', { text: r.number }),
            el('div.fs-xs.muted-2', { text: r.typeName })
          ]);
        } },
        { k: 'date', t: 'Дата', w: '110px', render: function (r) { return U.fmtDate(r.date); } },
        { k: 'counterpartyId', t: 'Контрагент', render: function (r) { return H.cpName(r.counterpartyId); },
          sort: function (r) { return H.cpName(r.counterpartyId); } },
        { k: 'amount', t: 'Сумма', num: true, render: function (r) { return r.amount ? U.money(r.amount, { digits: 0 }) : '—'; } },
        { id: 'file', t: 'Файл', w: '190px', sortable: false, render: function (r) {
          return el('div.row', { style: { gap: '6px' } }, [
            App.Icons.get(r.fileName && /\.pdf$/i.test(r.fileName) ? 'file' : 'files'),
            el('span.fs-sm.truncate', { text: r.fileName || 'нет файла', style: { maxWidth: '90px' } }),
            r.ocr ? UI.badge('OCR', 'info') : null,
            r.signed ? el('span', { title: 'Подписан ЭЦП', style: { color: 'var(--ok-fg)' } }, [App.Icons.get('shield')]) : null
          ]);
        } },
        { k: 'status', t: 'Статус', w: '130px', render: function (r) { return UI.status(r.status); } },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
          return UI.rowActions([
            { icon: 'eye', title: 'Открыть карточку', onClick: function () { openDoc(r.id); } },
            canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editDoc(r); } } : null,
            canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () { removeDoc(r); } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'date', dir: 'desc' },
      pageSize: 15,
      exportName: 'documents.csv',
      onRow: function (r) { openDoc(r.id); },
      emptyAction: canEdit ? { text: 'Загрузить документ', onClick: function () { uploadDoc(); } } : null
    });

    const byType = U.groupBy(rows, function (r) { return r.typeName; });
    const typeStats = Object.keys(byType).map(function (k) { return { name: k, value: byType[k].length }; })
      .sort(function (a, b) { return b.value - a.value; });

    return UI.page({
      title: 'Электронный документооборот',
      subtitle: 'Хранение, распознавание и поиск документов · ' + rows.length + ' документов в архиве',
      actions: [
        canEdit ? UI.btn('Загрузить документ', { kind: 'primary', icon: 'upload', onClick: uploadDoc }) : null,
        canEdit ? UI.btn('Сканировать', { icon: 'scan', onClick: scanDoc }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Всего документов', value: rows.length, icon: 'files', tone: 'info' },
          { label: 'На согласовании', value: rows.filter(function (r) { return r.status === 'review'; }).length, icon: 'clock', tone: 'warn' },
          { label: 'Распознано (OCR)', value: rows.filter(function (r) { return r.ocr; }).length, icon: 'scan', tone: 'ok' },
          { label: 'Подписано ЭЦП', value: rows.filter(function (r) { return r.signed; }).length, icon: 'shield', tone: 'violet' },
          { label: 'Объём архива', value: U.num(U.sum(rows, function (r) { return r.fileSize || 0; }) / 1024, 1) + ' МБ', icon: 'database', tone: '' }
        ], 4),
        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({ title: 'Архив документов', flush: true, body: [tbl] }),
          UI.card({ title: 'По типам документов', body: [App.Charts.hbars({ items: typeStats, format: function (v) { return v + ' шт.'; } })] })
        ])
      ]
    });
  }

  /* --- Карточка документа --------------------------------------------------- */
  function openDoc(id) {
    const d = App.Store.get('documents', id);
    if (!d) return;
    const cp = H.cp(d.counterpartyId);
    const sigs = App.Store.all('signatures').filter(function (s) { return s.docId === d.id; });
    const canEdit = App.Auth.canEdit('documents');

    const tabs = UI.tabs([
      {
        id: 'main', title: 'Реквизиты',
        render: function () {
          return el('div.grid.grid--2', null, [
            UI.kv([
              ['Номер', d.number],
              ['Тип', d.typeName],
              ['Дата', U.fmtDate(d.date)],
              ['Контрагент', cp ? cp.name : '—'],
              ['ИНН', cp ? cp.inn : '—'],
              ['Сумма', d.amount ? U.money(d.amount) : '—'],
              ['Статус', UI.status(d.status)],
              ['Автор', d.author],
              ['Создан', U.fmtDateTime(d.createdAt)],
              ['ЭЦП', d.signed ? UI.badge('подписан', 'ok') : UI.badge('не подписан', '')]
            ]),
            el('div.col', null, [
              el('div.doc-preview', null, [
                el('div.center', null, [
                  App.Icons.get('file', '', 40),
                  el('div.mt-2.fs-sm', { text: d.fileName || 'файл не загружен' }),
                  el('div.fs-xs.muted-2', { text: d.fileSize ? Math.round(d.fileSize) + ' КБ' : '' })
                ])
              ]),
              el('div.row', null, [
                UI.btn('Скачать', { size: 'sm', icon: 'download', onClick: function () {
                  U.download(d.fileName || 'document.txt', d.ocrText || d.number);
                  UI.toast({ kind: 'ok', title: 'Файл выгружен' });
                } }),
                UI.btn('Печать', { size: 'sm', icon: 'print', onClick: function () { window.print(); } })
              ])
            ])
          ]);
        }
      },
      {
        id: 'ocr', title: 'Распознанный текст',
        render: function () {
          if (!d.ocr) {
            return UI.empty({
              icon: 'scan', title: 'Документ не распознан',
              text: 'Запустите OCR — система извлечёт текст, реквизиты и сумму, после чего документ станет доступен для поиска по содержимому.',
              action: canEdit ? { icon: 'scan', text: 'Распознать (OCR)', onClick: function () { runOCR(d); } } : null
            });
          }
          return el('div.col', null, [
            el('div.alert.alert--ok', null, [App.Icons.get('checkCircle'), 'Текст успешно распознан. Документ участвует в полнотекстовом поиске.']),
            el('div.card__body', { style: { background: 'var(--surface-2)', borderRadius: 'var(--r-md)', whiteSpace: 'pre-wrap' }, text: d.ocrText })
          ]);
        }
      },
      {
        id: 'route', title: 'Согласование',
        render: function () {
          return el('div.col', null, [
            UI.timeline(d.route || H.defaultRoute()),
            App.Auth.canApprove() && d.status === 'review'
              ? el('div.row.mt-4', null, [
                UI.btn('Одобрить', { kind: 'success', icon: 'check', onClick: function () { decide(d.id, 'approve'); } }),
                UI.btn('Отклонить', { kind: 'danger', icon: 'x', onClick: function () { decide(d.id, 'reject'); } })
              ]) : null
          ]);
        }
      },
      {
        id: 'sign', title: 'ЭЦП',
        render: function () {
          if (!sigs.length) {
            return UI.empty({
              icon: 'signature', title: 'Документ не подписан',
              text: 'Подпишите документ электронной подписью — она будет привязана к файлу и проверяема.',
              action: canEdit ? { icon: 'signature', text: 'Подписать ЭЦП', onClick: function () { signDoc(d); } } : null
            });
          }
          return el('div.col', null, sigs.map(function (s) {
            return el('div.card__body', { style: { border: '1px solid var(--line)', borderRadius: 'var(--r-md)' } }, [
              el('div.row.row--between', null, [
                UI.kv([
                  ['Подписал', s.signer], ['Сертификат', s.cert], ['Издатель', s.issuer],
                  ['Алгоритм', s.algorithm], ['Дата подписи', U.fmtDateTime(s.ts)],
                  ['Действителен до', U.fmtDate(s.validUntil)]
                ]),
                el('div.sign-stamp', null, [
                  el('b', { text: s.valid ? 'Подпись верна' : 'Подпись недействительна' }),
                  el('span', { text: s.signer }),
                  el('span', { text: U.fmtDateTime(s.ts) })
                ])
              ])
            ]);
          }));
        }
      },
      {
        id: 'history', title: 'История',
        render: function () {
          const log = App.Store.all('auditLog').filter(function (a) { return a.entityId === d.id; });
          const items = (d.history || []).map(function (h) {
            return { action: h.action, name: h.user, ts: h.ts, state: 'done' };
          }).concat(log.map(function (a) {
            return { action: a.actionText + ' ' + (a.entityTitle || ''), name: a.user, ts: a.ts, state: 'done' };
          }));
          return items.length ? UI.timeline(items) : UI.empty({ icon: 'history', title: 'История пуста' });
        }
      }
    ]);

    UI.modal({
      title: d.typeName + ' ' + d.number,
      size: 'xl',
      body: tabs,
      footSplit: true,
      buttons: [
        el('div.row', null, [
          canEdit && d.status === 'draft' ? UI.btn('Отправить на согласование', {
            icon: 'send', kind: 'primary', onClick: function () {
              App.Store.update('documents', d.id, { status: 'review', route: H.defaultRoute() });
              H.notify({ kind: 'info', icon: 'clipboard', title: 'Документ на согласовании', text: d.typeName + ' ' + d.number, link: '#/approvals' });
              UI.toast({ kind: 'ok', title: 'Отправлено на согласование' });
              UI.closeModal();
              App.Router.render();
            }
          }) : null,
          canEdit && d.status === 'approved' ? UI.btn('Провести', {
            icon: 'check', kind: 'success', onClick: function () { postDoc(d); }
          }) : null
        ].filter(Boolean)),
        { text: 'Закрыть', kind: 'ghost' }
      ]
    });
  }

  function decide(id, decision) {
    if (decision === 'reject') {
      const f = UI.form({ fields: [{ k: 'comment', t: 'Причина отклонения', type: 'textarea', required: true }] });
      UI.modal({
        title: 'Отклонить документ', size: 'sm', body: f.node,
        buttons: [
          { text: 'Отмена', kind: 'ghost' },
          { text: 'Отклонить', kind: 'danger', onClick: function () {
            if (!f.validate()) return false;
            H.routeStep('documents', id, 'reject', f.read().comment);
            UI.toast({ kind: 'warn', title: 'Документ отклонён' });
            App.Router.render();
          } }
        ]
      });
    } else {
      H.routeStep('documents', id, 'approve');
      UI.toast({ kind: 'ok', title: 'Решение сохранено' });
      UI.closeModal();
      App.Router.render();
    }
  }

  function postDoc(d) {
    App.Store.update('documents', d.id, { status: 'posted' });
    const n = H.autoEntries(d.type === 'invoice' ? 'sale' : 'purchase', d.amount || 0, d.date, d);
    App.Store.logAction('провёл документ', 'documents', d);
    UI.toast({ kind: 'ok', title: 'Документ проведён', text: 'Создано проводок: ' + n });
    UI.closeModal();
    App.Router.render();
  }

  function runOCR(d) {
    UI.toast({ title: 'Распознавание…', text: 'Обработка файла ' + d.fileName });
    setTimeout(function () {
      const cp = H.cp(d.counterpartyId);
      App.Store.update('documents', d.id, {
        ocr: true,
        ocrText: 'Документ ' + d.typeName + ' № ' + d.number + ' от ' + U.fmtDate(d.date) +
          '.\nКонтрагент: ' + (cp ? cp.name : '—') + ', ИНН ' + (cp ? cp.inn : '—') +
          '.\nСумма: ' + U.num(d.amount, 2) + ' сом, в том числе НДС 12%: ' + U.num(d.amount * 12 / 112, 2) +
          ' сом.\nОснование: договор поставки.\nПодписи сторон: имеются.'
      });
      UI.toast({ kind: 'ok', title: 'Текст распознан', text: 'Документ добавлен в полнотекстовый поиск' });
      UI.closeModal();
      openDoc(d.id);
    }, 900);
  }

  function signDoc(d) {
    UI.confirm({
      title: 'Подписание ЭЦП',
      text: 'Подписать «' + d.typeName + ' ' + d.number + '» электронной подписью текущего пользователя?',
      okText: 'Подписать',
      onOk: function () {
        const u = App.Auth.user();
        App.Store.insert('signatures', {
          docId: d.id, docNumber: d.number, docType: d.typeName,
          signer: u ? u.fullName : 'Пользователь',
          cert: 'KG-CERT-' + Math.floor(100000 + Math.random() * 899999),
          issuer: 'ГП «Инфоком» — Центр сертификации КР',
          validUntil: U.iso(U.addDays(new Date(), 365)),
          ts: new Date().toISOString(),
          algorithm: 'ГОСТ Р 34.10-2012',
          valid: true
        });
        App.Store.update('documents', d.id, { signed: true });
        UI.toast({ kind: 'ok', title: 'Документ подписан', text: 'ЭЦП успешно применена' });
        UI.closeModal();
        App.Router.render();
      }
    });
  }

  function docFields() {
    return [
      { k: 'type', t: 'Тип документа', type: 'select', options: DOC_TYPES, required: true, col: 6, empty: false },
      { k: 'number', t: 'Номер', required: true, col: 6 },
      { k: 'date', t: 'Дата', type: 'date', required: true, col: 6 },
      { k: 'counterpartyId', t: 'Контрагент', type: 'select', options: H.cpOptions(), col: 6 },
      { k: 'amount', t: 'Сумма, сом', type: 'money', col: 6 },
      { k: 'status', t: 'Статус', type: 'select', options: UI.statusOptions(['draft', 'review', 'approved', 'posted']), col: 6, empty: false },
      { k: 'fileName', t: 'Имя файла', col: 6, placeholder: 'scan_001.pdf' },
      { k: 'ocr', t: 'Распознать текст (OCR) при сохранении', type: 'checkbox', col: 6 }
    ];
  }

  function editDoc(d) {
    UI.formModal({
      title: 'Документ ' + d.number,
      values: d,
      fields: docFields(),
      onSave: function (v) {
        v.typeName = typeName(v.type);
        App.Store.update('documents', d.id, v);
        UI.toast({ kind: 'ok', title: 'Документ сохранён' });
        App.Router.render();
      }
    });
  }

  function removeDoc(d) {
    UI.confirm({
      title: 'Удалить документ?', danger: true,
      text: 'Документ «' + d.typeName + ' ' + d.number + '» будет удалён. Действие фиксируется в журнале аудита.',
      okText: 'Удалить',
      onOk: function () {
        App.Store.remove('documents', d.id);
        UI.toast({ kind: 'ok', title: 'Документ удалён' });
        App.Router.render();
      }
    });
  }

  function uploadDoc() {
    const files = [];
    const list = el('div.col.mt-3');
    const zone = UI.dropzone({
      title: 'Перетащите скан или фото документа',
      hint: 'PDF, JPG, PNG · распознавание текста выполняется автоматически',
      onFiles: function (fs) {
        fs.forEach(function (f) {
          files.push(f);
          list.appendChild(UI.fileItem(f.name, f.size, function () {
            const i = files.indexOf(f);
            if (i > -1) files.splice(i, 1);
            list.innerHTML = '';
            files.forEach(function (x) { list.appendChild(UI.fileItem(x.name, x.size)); });
          }));
        });
      }
    });

    const f = UI.form({
      fields: docFields(),
      values: { date: U.today(), status: 'draft', ocr: true, number: H.nextNumber('documents', 'ДОК') }
    });

    UI.modal({
      title: 'Загрузка документа',
      size: 'lg',
      body: [zone, list, el('div.mt-4', null, [f.node])],
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Загрузить', kind: 'primary', icon: 'upload', onClick: function () {
          if (!f.validate()) return false;
          const v = f.read();
          const file = files[0];
          const doc = App.Store.insert('documents', Object.assign(v, {
            typeName: typeName(v.type),
            fileName: file ? file.name : (v.fileName || 'document.pdf'),
            fileSize: file ? Math.round(file.size / 1024) : 120,
            ocrText: v.ocr ? 'Документ ' + typeName(v.type) + ' № ' + v.number + ' от ' + U.fmtDate(v.date) +
              '. Контрагент: ' + H.cpName(v.counterpartyId) + '. Сумма: ' + U.num(v.amount || 0, 2) + ' сом.' : '',
            signed: false,
            route: v.status === 'review' ? H.defaultRoute() : null,
            history: [{ ts: new Date().toISOString(), user: (App.Auth.user() || {}).fullName, action: 'Документ загружен' }]
          }));
          UI.toast({ kind: 'ok', title: 'Документ загружен', text: doc.number + (v.ocr ? ' · текст распознан' : '') });
          App.Router.render();
        } }
      ]
    });
  }

  function scanDoc() {
    UI.modal({
      title: 'Сканирование документа',
      size: 'sm',
      body: el('div.col.center', null, [
        el('div.empty__icon', null, [App.Icons.get('scan', '', 26)]),
        el('p', { text: 'Устройство: HP ScanJet Pro 2000 (сетевой)' }),
        el('div.progress', null, [el('div.progress__bar', { style: { width: '0%' }, id: 'scan-bar' })]),
        el('p.fs-sm.muted-2', { id: 'scan-status', text: 'Готов к сканированию' })
      ]),
      buttons: [
        { text: 'Отмена', kind: 'ghost' },
        { text: 'Сканировать', kind: 'primary', icon: 'scan', close: false, onClick: function () {
          const bar = U.$('#scan-bar'), st = U.$('#scan-status');
          let p = 0;
          const t = setInterval(function () {
            p += 12;
            bar.style.width = Math.min(100, p) + '%';
            st.textContent = p < 50 ? 'Сканирование страницы…' : p < 100 ? 'Распознавание текста (OCR)…' : 'Готово';
            if (p >= 100) {
              clearInterval(t);
              UI.closeModal();
              UI.toast({ kind: 'ok', title: 'Документ отсканирован', text: 'Файл добавлен в архив, текст распознан' });
              App.Store.insert('documents', {
                number: H.nextNumber('documents', 'СКАН'), type: 'invoice', typeName: 'Счёт на оплату',
                date: U.today(), amount: 0, status: 'draft', fileName: 'scan_' + Date.now() + '.pdf',
                fileSize: 340, ocr: true, ocrText: 'Отсканированный документ, текст распознан автоматически.',
                signed: false, history: [{ ts: new Date().toISOString(), user: 'Сканер', action: 'Документ отсканирован' }]
              });
              App.Router.render();
            }
          }, 260);
        } }
      ]
    });
  }

  /* =========================================================================
     ДОГОВОРЫ
     ====================================================================== */
  function contracts() {
    const canEdit = App.Auth.canEdit('contracts');
    const rows = App.Store.all('contracts').map(function (c) {
      return Object.assign({}, c, { daysLeft: U.daysLeft(c.endDate), cpName: H.cpName(c.counterpartyId) });
    });
    const expiring = rows.filter(function (c) { return c.daysLeft >= 0 && c.daysLeft <= 30; });

    const tbl = UI.table({
      search: ['number', 'cpName', 'subject', 'type'],
      searchPlaceholder: 'Поиск по номеру, контрагенту, предмету…',
      filters: [
        { k: 'side', t: 'Сторона', options: [{ v: 'client', t: 'с покупателями' }, { v: 'supplier', t: 'с поставщиками' }] },
        { k: 'status', t: 'Статус', options: UI.statusOptions(['active', 'expired']) },
        { k: 'signed', t: 'Подпись', options: [{ v: 'yes', t: 'подписан' }, { v: 'no', t: 'не подписан' }],
          test: function (r, v) { return v === 'yes' ? !!r.signed : !r.signed; } }
      ],
      columns: [
        { k: 'number', t: '№ договора', w: '130px' },
        { k: 'cpName', t: 'Контрагент' },
        { k: 'type', t: 'Тип', w: '150px' },
        { k: 'date', t: 'Дата', w: '105px', render: function (r) { return U.fmtDate(r.date); } },
        { k: 'endDate', t: 'Действует до', w: '120px', render: function (r) { return U.fmtDate(r.endDate); } },
        { k: 'daysLeft', t: 'Осталось', w: '120px', render: function (r) {
          if (r.daysLeft < 0) return UI.badge('истёк ' + (-r.daysLeft) + ' дн. назад', 'danger');
          if (r.daysLeft <= 30) return UI.badge(r.daysLeft + ' дн.', 'warn');
          return el('span.muted', { text: r.daysLeft + ' дн.' });
        } },
        { k: 'amount', t: 'Сумма', num: true, render: function (r) { return U.money(r.amount, { digits: 0 }); } },
        { k: 'signed', t: 'Подписан', w: '110px', render: function (r) { return r.signed ? UI.badge('да', 'ok') : UI.badge('нет', 'warn'); } },
        { id: 'act', t: '', w: '110px', sortable: false, render: function (r) {
          return UI.rowActions([
            { icon: 'eye', title: 'Карточка договора', onClick: function () { openContract(r.id); } },
            canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editContract(r); } } : null,
            canEdit ? { icon: 'trash', title: 'Удалить', kind: 'danger', onClick: function () {
              UI.confirm({ title: 'Удалить договор?', text: 'Договор ' + r.number + ' будет удалён.', danger: true,
                onOk: function () { App.Store.remove('contracts', r.id); UI.toast({ kind: 'ok', title: 'Договор удалён' }); App.Router.render(); } });
            } } : null
          ]);
        } }
      ],
      rows: rows,
      sort: { k: 'date', dir: 'desc' },
      pageSize: 15,
      exportName: 'contracts.csv',
      onRow: function (r) { openContract(r.id); },
      rowClass: function (r) { return r.daysLeft < 0 ? 'is-danger' : ''; },
      dangerRows: true
    });

    return UI.page({
      title: 'Управление договорами',
      subtitle: 'Шаблоны, сроки действия, связь с платежами и документами',
      actions: [
        canEdit ? UI.btn('Новый договор', { kind: 'primary', icon: 'plus', onClick: function () { editContract(null); } }) : null,
        UI.btn('Шаблоны', { icon: 'files', onClick: templates })
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Всего договоров', value: rows.length, icon: 'contract', tone: 'info' },
          { label: 'Действующих', value: rows.filter(function (r) { return r.status === 'active'; }).length, icon: 'checkCircle', tone: 'ok' },
          { label: 'Истекают в 30 дней', value: expiring.length, icon: 'clock', tone: 'warn' },
          { label: 'Не подписано', value: rows.filter(function (r) { return !r.signed; }).length, icon: 'alert', tone: 'danger' },
          { label: 'Сумма договоров', value: U.moneyShort(U.sum(rows, function (r) { return r.amount; })), icon: 'wallet', tone: 'violet' }
        ], 4),

        expiring.length ? el('div.alert.alert--warn.mt-4', null, [
          App.Icons.get('alert'),
          el('div', null, [
            el('strong', { text: 'Скоро заканчиваются договоры: ' }),
            expiring.map(function (c) { return c.number + ' (' + c.daysLeft + ' дн.)'; }).join(', '),
            el('div.fs-sm.mt-2', { text: 'Уведомления отправлены ответственным по Email и Telegram.' })
          ])
        ]) : null,

        el('div.mt-4', null, [UI.card({ title: 'Реестр договоров', flush: true, body: [tbl] })])
      ]
    });
  }

  function openContract(id) {
    const c = App.Store.get('contracts', id);
    if (!c) return;
    const payments = App.Store.all('payments').filter(function (p) { return p.counterpartyId === c.counterpartyId; }).slice(0, 8);
    const docs = App.Store.all('documents').filter(function (d) { return d.counterpartyId === c.counterpartyId; }).slice(0, 8);
    const left = U.daysLeft(c.endDate);

    UI.detailModal({
      title: 'Договор ' + c.number,
      size: 'xl',
      pairs: [
        ['Контрагент', H.cpName(c.counterpartyId)],
        ['Тип договора', c.type],
        ['Предмет', c.subject],
        ['Дата заключения', U.fmtDate(c.date)],
        ['Срок действия', U.fmtDate(c.startDate) + ' — ' + U.fmtDate(c.endDate) +
          (left >= 0 ? ' (осталось ' + left + ' дн.)' : ' (истёк)')],
        ['Сумма', U.money(c.amount)],
        ['Автопролонгация', c.autoRenew ? 'да' : 'нет'],
        ['Ответственный', c.responsible],
        ['Шаблон', c.template],
        ['Статус', UI.status(c.status)],
        ['Подписан', c.signed ? UI.badge('да', 'ok') : UI.badge('нет', 'warn')]
      ],
      extra: [
        el('h4.mt-4.mb-2', { text: 'Связанные платежи' }),
        payments.length ? UI.table({
          columns: [
            { k: 'date', t: 'Дата', render: function (p) { return U.fmtDate(p.date); } },
            { k: 'number', t: '№' },
            { k: 'purpose', t: 'Назначение' },
            { k: 'amount', t: 'Сумма', num: true, render: function (p) { return U.money(p.amount, { digits: 0 }); } }
          ], rows: payments, pageSize: 0, exportName: false, printable: false
        }) : el('p.muted-2', { text: 'Платежей по контрагенту нет' }),
        el('h4.mt-4.mb-2', { text: 'Связанные документы' }),
        docs.length ? UI.table({
          columns: [
            { k: 'date', t: 'Дата', render: function (d) { return U.fmtDate(d.date); } },
            { k: 'number', t: '№' },
            { k: 'typeName', t: 'Тип' },
            { k: 'status', t: 'Статус', render: function (d) { return UI.status(d.status); } }
          ], rows: docs, pageSize: 0, exportName: false, printable: false
        }) : el('p.muted-2', { text: 'Документов нет' })
      ],
      buttons: [
        { text: 'Закрыть', kind: 'ghost' },
        { text: 'Печать', kind: 'primary', icon: 'print', close: false, onClick: function () { window.print(); } }
      ]
    });
  }

  function editContract(c) {
    UI.formModal({
      title: c ? 'Договор ' + c.number : 'Новый договор',
      values: c || {
        number: H.nextNumber('contracts', 'Д'), date: U.today(), startDate: U.today(),
        endDate: U.iso(U.addDays(new Date(), 365)), status: 'active', side: 'client', currency: 'KGS'
      },
      fields: [
        { k: 'number', t: 'Номер договора', required: true, col: 4 },
        { k: 'date', t: 'Дата', type: 'date', required: true, col: 4 },
        { k: 'type', t: 'Тип договора', type: 'select', col: 4, empty: false,
          options: ['Поставка товара', 'Оказание услуг', 'Аренда', 'Подряд', 'Агентский'].map(function (t) { return { v: t, t: t }; }) },
        { k: 'side', t: 'Сторона', type: 'select', col: 6, empty: false,
          options: [{ v: 'client', t: 'Покупатель' }, { v: 'supplier', t: 'Поставщик' }] },
        { k: 'counterpartyId', t: 'Контрагент', type: 'select', options: H.cpOptions(), required: true, col: 6 },
        { k: 'subject', t: 'Предмет договора', type: 'textarea', col: 12 },
        { k: 'amount', t: 'Сумма, сом', type: 'money', required: true, col: 4 },
        { k: 'startDate', t: 'Действует с', type: 'date', col: 4 },
        { k: 'endDate', t: 'Действует до', type: 'date', required: true, col: 4 },
        { k: 'responsible', t: 'Ответственный', type: 'select', options: H.employeeOptions().map(function (o) { return { v: o.t, t: o.t }; }), col: 6 },
        { k: 'template', t: 'Шаблон', type: 'select', col: 6, options: [
          { v: 'Стандартный договор поставки', t: 'Стандартный договор поставки' },
          { v: 'Договор услуг', t: 'Договор услуг' },
          { v: 'Рамочный договор', t: 'Рамочный договор' }
        ] },
        { k: 'autoRenew', t: 'Автоматическая пролонгация', type: 'checkbox', col: 6 },
        { k: 'signed', t: 'Договор подписан сторонами', type: 'checkbox', col: 6 }
      ],
      onSave: function (v) {
        v.status = U.daysLeft(v.endDate) < 0 ? 'expired' : 'active';
        if (c) App.Store.update('contracts', c.id, v);
        else App.Store.insert('contracts', v);
        UI.toast({ kind: 'ok', title: 'Договор сохранён', text: v.number });
        App.Router.render();
      }
    });
  }

  function templates() {
    const list = [
      { name: 'Стандартный договор поставки', fields: 'Реквизиты сторон, предмет, цена, сроки поставки, ответственность' },
      { name: 'Договор оказания услуг', fields: 'Перечень услуг, стоимость, порядок сдачи-приёмки' },
      { name: 'Рамочный договор', fields: 'Общие условия, спецификации отдельными приложениями' },
      { name: 'Договор аренды', fields: 'Объект, срок, арендная плата, коммунальные платежи' },
      { name: 'Доверенность на получение ТМЦ', fields: 'Доверенное лицо, перечень ТМЦ, срок действия' }
    ];
    UI.modal({
      title: 'Шаблоны документов',
      size: 'lg',
      body: [
        el('p.muted', { text: 'При создании договора реквизиты организации и контрагента подставляются автоматически.' }),
        el('div.list', null, list.map(function (t) {
          return el('div.list__item', null, [
            el('div.notif__icon', null, [App.Icons.get('files')]),
            el('div.list__main', null, [
              el('div.list__title', { text: t.name }),
              el('div.list__sub', { text: t.fields })
            ]),
            UI.btn('Использовать', { size: 'sm', onClick: function () {
              UI.closeModal();
              editContract(null);
            } })
          ]);
        }))
      ]
    });
  }

  /* =========================================================================
     СОГЛАСОВАНИЕ ДОКУМЕНТОВ
     ====================================================================== */
  function approvals() {
    const docs = App.Store.all('documents').filter(function (d) { return d.status === 'review' || d.status === 'rejected'; });
    const reqs = App.Store.all('requests').filter(function (r) { return r.status === 'review' || r.status === 'new'; });
    const canApprove = App.Auth.canApprove();

    function queue(items, collection) {
      if (!items.length) return UI.empty({ icon: 'checkCircle', title: 'Очередь пуста', text: 'Нет документов, ожидающих вашего решения.' });
      return el('div.col', null, items.map(function (d) {
        const cur = (d.route || []).filter(function (s) { return s.state === 'current'; })[0];
        return UI.card({
          title: (d.typeName || d.typeName || d.subject || 'Заявка') + ' ' + d.number,
          subtitle: 'от ' + U.fmtDate(d.date) + ' · ' + (d.counterpartyId ? H.cpName(d.counterpartyId) : d.author || ''),
          tools: [
            d.amount ? UI.badge(U.money(d.amount, { digits: 0 }), 'info') : null,
            UI.status(d.status)
          ].filter(Boolean),
          body: [
            el('div.grid.grid--sidebar', null, [
              UI.timeline(d.route || H.defaultRoute()),
              el('div.col', null, [
                el('div.fs-sm.muted', { text: cur ? 'Ожидает решения: ' + cur.role + ' (' + cur.name + ')' : 'Маршрут завершён' }),
                canApprove && d.status === 'review' ? el('div.row', null, [
                  UI.btn('Одобрить', { kind: 'success', icon: 'check', onClick: function () {
                    H.routeStep(collection, d.id, 'approve');
                    UI.toast({ kind: 'ok', title: 'Согласовано' });
                    App.Router.render();
                  } }),
                  UI.btn('Отклонить', { kind: 'danger', icon: 'x', onClick: function () {
                    if (collection === 'documents') decide(d.id, 'reject');
                    else {
                      H.routeStep(collection, d.id, 'reject', 'Отклонено руководителем');
                      UI.toast({ kind: 'warn', title: 'Отклонено' });
                      App.Router.render();
                    }
                  } })
                ]) : el('p.fs-sm.muted-2', { text: canApprove ? 'Документ уже обработан' : 'У вашей роли нет прав на утверждение' }),
                collection === 'documents' ? UI.btn('Открыть документ', { size: 'sm', kind: 'ghost', icon: 'eye', onClick: function () { openDoc(d.id); } }) : null
              ])
            ])
          ]
        });
      }));
    }

    return UI.page({
      title: 'Согласование документов',
      subtitle: 'Маршрут: Сотрудник → Бухгалтер → Руководитель',
      children: [
        UI.statGrid([
          { label: 'Документов в очереди', value: docs.filter(function (d) { return d.status === 'review'; }).length, icon: 'clipboard', tone: 'warn' },
          { label: 'Заявок в очереди', value: reqs.length, icon: 'inbox', tone: 'info' },
          { label: 'Отклонено', value: App.Store.all('documents').filter(function (d) { return d.status === 'rejected'; }).length, icon: 'xCircle', tone: 'danger' },
          { label: 'Утверждено за месяц', value: App.Store.all('documents').filter(function (d) {
            return d.status === 'approved' && U.ym(d.date) === U.ym(U.today());
          }).length, icon: 'checkCircle', tone: 'ok' }
        ], 4),
        el('div.mt-4', null, [UI.tabs([
          { id: 'docs', title: 'Документы', count: docs.length, render: function () { return queue(docs, 'documents'); } },
          { id: 'reqs', title: 'Внутренние заявки', count: reqs.length, render: function () { return queue(reqs, 'requests'); } }
        ])])
      ]
    });
  }

  /* =========================================================================
     ЭЛЕКТРОННАЯ ПОДПИСЬ
     ====================================================================== */
  function esign() {
    const sigs = App.Store.all('signatures');
    const unsigned = App.Store.all('documents').filter(function (d) { return !d.signed && d.status !== 'draft'; });

    return UI.page({
      title: 'Электронная подпись (ЭЦП)',
      subtitle: 'Подписание документов, проверка подписи, хранение подписанных файлов',
      children: [
        UI.statGrid([
          { label: 'Подписанных документов', value: sigs.length, icon: 'signature', tone: 'ok' },
          { label: 'Действительных подписей', value: sigs.filter(function (s) { return s.valid; }).length, icon: 'shield', tone: 'ok' },
          { label: 'Недействительных', value: sigs.filter(function (s) { return !s.valid; }).length, icon: 'alert', tone: 'danger' },
          { label: 'Ожидают подписи', value: unsigned.length, icon: 'clock', tone: 'warn' }
        ], 4),

        el('div.mt-4', null, [UI.card({
          title: 'Сертификат текущего пользователя',
          body: [el('div.grid.grid--2', null, [
            UI.kv([
              ['Владелец', (App.Auth.user() || {}).fullName],
              ['Сертификат', 'KG-CERT-448921'],
              ['Издатель', 'ГП «Инфоком» — Центр сертификации КР'],
              ['Алгоритм', 'ГОСТ Р 34.10-2012'],
              ['Действителен до', U.fmtDate(U.addDays(new Date(), 280))],
              ['Статус', UI.badge('действителен', 'ok')]
            ]),
            el('div.center', null, [el('div.sign-stamp', null, [
              el('b', { text: 'Документ подписан ЭЦП' }),
              el('span', { text: (App.Auth.user() || {}).fullName }),
              el('span', { text: 'Сертификат: KG-CERT-448921' }),
              el('span', { text: 'Действителен до ' + U.fmtDate(U.addDays(new Date(), 280)) })
            ])])
          ])]
        })]),

        el('div.mt-4', null, [UI.card({
          title: 'Журнал подписей',
          flush: true,
          body: [UI.table({
            search: ['docNumber', 'signer', 'cert'],
            columns: [
              { k: 'ts', t: 'Дата подписи', w: '150px', render: function (s) { return U.fmtDateTime(s.ts); } },
              { k: 'docNumber', t: 'Документ', render: function (s) { return s.docType + ' ' + s.docNumber; } },
              { k: 'signer', t: 'Подписал' },
              { k: 'cert', t: 'Сертификат', w: '160px' },
              { k: 'validUntil', t: 'Действует до', w: '130px', render: function (s) { return U.fmtDate(s.validUntil); } },
              { k: 'valid', t: 'Проверка', w: '150px', render: function (s) {
                return s.valid ? UI.badge('подпись верна', 'ok') : UI.badge('недействительна', 'danger');
              } },
              { id: 'act', t: '', w: '60px', sortable: false, render: function (s) {
                return UI.rowActions([{ icon: 'shield', title: 'Проверить подпись', onClick: function () { verify(s); } }]);
              } }
            ],
            rows: sigs,
            sort: { k: 'ts', dir: 'desc' },
            pageSize: 15,
            exportName: 'signatures.csv',
            emptyTitle: 'Подписанных документов нет'
          })]
        })]),

        unsigned.length ? el('div.mt-4', null, [UI.card({
          title: 'Ожидают подписи',
          flush: true,
          body: [UI.table({
            columns: [
              { k: 'number', t: '№' },
              { k: 'typeName', t: 'Тип' },
              { k: 'date', t: 'Дата', render: function (d) { return U.fmtDate(d.date); } },
              { k: 'amount', t: 'Сумма', num: true, render: function (d) { return d.amount ? U.money(d.amount, { digits: 0 }) : '—'; } },
              { id: 'act', t: '', w: '130px', sortable: false, render: function (d) {
                return UI.btn('Подписать', { size: 'sm', icon: 'signature', onClick: function () { signDoc(d); } });
              } }
            ],
            rows: unsigned, pageSize: 8, exportName: false
          })]
        })]) : null
      ]
    });
  }

  function verify(s) {
    UI.toast({ title: 'Проверка подписи…' });
    setTimeout(function () {
      UI.modal({
        title: 'Результат проверки подписи',
        size: 'sm',
        body: [
          el('div.alert' + (s.valid ? '.alert--ok' : '.alert--danger'), null, [
            App.Icons.get(s.valid ? 'checkCircle' : 'xCircle'),
            s.valid ? 'Подпись действительна, документ не изменялся после подписания.'
              : 'Подпись недействительна: сертификат отозван или файл был изменён.'
          ]),
          el('div.mt-3', null, [UI.kv([
            ['Документ', s.docType + ' ' + s.docNumber],
            ['Подписал', s.signer],
            ['Сертификат', s.cert],
            ['Алгоритм', s.algorithm],
            ['Отпечаток', 'A4:F1:9C:22:8B:04:E7:31']
          ])])
        ]
      });
    }, 600);
  }

  /* --- Маршруты ------------------------------------------------------------ */
  App.Router.add('documents', { title: 'Документы', module: 'documents', render: documents });
  App.Router.add('contracts', { title: 'Договоры', module: 'contracts', render: contracts });
  App.Router.add('approvals', { title: 'Согласование', module: 'approvals', render: approvals });
  App.Router.add('esign', { title: 'Электронная подпись', module: 'esign', render: esign });

  App.Docs = { openDoc: openDoc, typeName: typeName, DOC_TYPES: DOC_TYPES };
})(window.App);

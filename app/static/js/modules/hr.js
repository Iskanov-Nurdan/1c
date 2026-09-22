/* =============================================================================
   МОДУЛЬ: Сотрудники · Зарплата · Учёт рабочего времени
   ТЗ п. 13
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U, UI = App.UI, H = App.H, C = App.Charts, el = U.el;

  /* =========================================================================
     КАДРЫ
     ====================================================================== */
  function employees() {
    const canEdit = App.Auth.canEdit('hr');
    const rows = App.Store.all('employees');
    const fund = U.sum(rows, function (e) { return e.salary; });
    const byDept = U.groupBy(rows, function (e) { return e.department; });

    return UI.page({
      title: 'Сотрудники',
      subtitle: 'Кадровый учёт: должности, оклады, отпуска, больничные',
      actions: canEdit ? [UI.btn('Принять сотрудника', { kind: 'primary', icon: 'plus', onClick: function () { editEmployee(null); } })] : [],
      children: [
        UI.statGrid([
          { label: 'Сотрудников', value: rows.length, icon: 'users', tone: 'info' },
          { label: 'Фонд оплаты труда', value: U.moneyShort(fund), icon: 'wallet', tone: 'violet', meta: 'в месяц' },
          { label: 'В отпуске', value: rows.filter(function (e) { return e.status === 'vacation'; }).length, icon: 'sun', tone: 'warn' },
          { label: 'На больничном', value: rows.filter(function (e) { return e.status === 'sick'; }).length, icon: 'alert', tone: 'danger' },
          { label: 'Средний оклад', value: U.moneyShort(rows.length ? fund / rows.length : 0), icon: 'scale', tone: 'ok' }
        ], 4),

        el('div.grid.grid--sidebar.mt-4', null, [
          UI.card({
            title: 'Штат',
            flush: true,
            body: [UI.table({
              search: ['fullName', 'position', 'department', 'phone'],
              searchPlaceholder: 'Поиск по ФИО, должности, отделу…',
              filters: [
                { k: 'department', t: 'Отдел', options: U.uniq(rows.map(function (e) { return e.department; })).map(function (d) { return { v: d, t: d }; }) },
                { k: 'status', t: 'Статус', options: UI.statusOptions(['work', 'vacation', 'sick']) }
              ],
              columns: [
                { k: 'fullName', t: 'Сотрудник', render: function (e) {
                  return el('div.row', { style: { gap: '10px' } }, [
                    el('span.avatar', { text: U.initials(e.fullName) }),
                    el('div', null, [
                      el('div.strong', { text: e.fullName }),
                      el('div.fs-xs.muted-2', { text: e.position })
                    ])
                  ]);
                } },
                { k: 'department', t: 'Отдел', w: '150px' },
                { k: 'hireDate', t: 'Принят', w: '120px', render: function (e) { return U.fmtDate(e.hireDate); } },
                { id: 'exp', t: 'Стаж', w: '110px', sort: function (e) { return e.hireDate; },
                  render: function (e) { return Math.floor(-U.daysLeft(e.hireDate) / 365 * 10) / 10 + ' г.'; } },
                { k: 'salary', t: 'Оклад', num: true, render: function (e) { return U.money(e.salary, { digits: 0 }); } },
                { k: 'phone', t: 'Телефон', w: '150px' },
                { k: 'status', t: 'Статус', w: '130px', render: function (e) { return UI.status(e.status); } },
                { id: 'act', t: '', w: '110px', sortable: false, render: function (e) {
                  return UI.rowActions([
                    { icon: 'eye', title: 'Личная карточка', onClick: function () { openEmployee(e); } },
                    canEdit ? { icon: 'edit', title: 'Изменить', onClick: function () { editEmployee(e); } } : null,
                    canEdit ? { icon: 'trash', title: 'Уволить', kind: 'danger', onClick: function () {
                      UI.confirm({ title: 'Уволить сотрудника?', danger: true, text: e.fullName + ' будет удалён из штата.',
                        onOk: function () { App.Store.remove('employees', e.id); UI.toast({ kind: 'ok', title: 'Сотрудник уволен' }); App.Router.render(); } });
                    } } : null
                  ]);
                } }
              ],
              rows: rows, sort: { k: 'fullName', dir: 'asc' }, pageSize: 15, exportName: 'employees.csv',
              onRow: openEmployee
            })]
          }),
          UI.card({
            title: 'Структура по отделам',
            body: [C.donut({
              items: Object.keys(byDept).map(function (d) { return { name: d, value: byDept[d].length }; }),
              size: 180, centerTop: String(rows.length), centerBottom: 'человек'
            })]
          })
        ])
      ]
    });
  }

  function openEmployee(e) {
    const payrolls = App.Store.all('payrolls').filter(function (p) { return p.employeeId === e.id; });
    const times = App.Store.all('timesheets').filter(function (t) { return t.employeeId === e.id; });
    const hours = U.sum(times, function (t) { return t.hours; });

    UI.modal({
      title: e.fullName,
      size: 'lg',
      body: [UI.tabs([
        {
          id: 'card', title: 'Личная карточка', render: function () {
            return UI.kv([
              ['ФИО', e.fullName], ['Должность', e.position], ['Отдел', e.department],
              ['Дата приёма', U.fmtDate(e.hireDate)], ['Трудовой договор', e.contractNo],
              ['Оклад', U.money(e.salary)], ['Телефон', e.phone], ['Email', e.email],
              ['ИНН', e.inn], ['Статус', UI.status(e.status)]
            ]);
          }
        },
        {
          id: 'pay', title: 'Начисления (' + payrolls.length + ')', render: function () {
            return payrolls.length ? UI.table({
              columns: [
                { k: 'period', t: 'Период' },
                { k: 'base', t: 'Оклад', num: true, render: function (p) { return U.money(p.base, { digits: 0 }); } },
                { k: 'bonus', t: 'Премия', num: true, render: function (p) { return p.bonus ? U.money(p.bonus, { digits: 0 }) : '—'; } },
                { k: 'incomeTax', t: 'Подоходный', num: true, render: function (p) { return U.money(p.incomeTax, { digits: 0 }); } },
                { k: 'social', t: 'Соцфонд', num: true, render: function (p) { return U.money(p.social, { digits: 0 }); } },
                { k: 'net', t: 'К выплате', num: true, render: function (p) { return el('strong', { text: U.money(p.net, { digits: 0 }) }); } },
                { k: 'status', t: 'Статус', render: function (p) { return UI.status(p.status); } }
              ], rows: payrolls, pageSize: 8, exportName: false
            }) : UI.empty({ icon: 'wallet', title: 'Начислений нет' });
          }
        },
        {
          id: 'time', title: 'Табель', render: function () {
            return el('div.col', null, [
              UI.statGrid([
                { label: 'Отработано часов', value: U.num(hours, 0), tone: 'ok' },
                { label: 'Рабочих дней', value: times.filter(function (t) { return t.type === 'work'; }).length, tone: 'info' },
                { label: 'Отпуск / больничный', value: times.filter(function (t) { return t.type !== 'work'; }).length + ' дн.', tone: 'warn' }
              ], 3),
              UI.table({
                columns: [
                  { k: 'date', t: 'Дата', render: function (t) { return U.fmtDate(t.date); } },
                  { k: 'type', t: 'Вид', render: function (t) {
                    return UI.badge({ work: 'рабочий день', vacation: 'отпуск', sick: 'больничный' }[t.type],
                      t.type === 'work' ? 'ok' : t.type === 'vacation' ? 'info' : 'warn');
                  } },
                  { k: 'hours', t: 'Часов', num: true }
                ], rows: U.sortBy(times, function (t) { return t.date; }, 'desc'), pageSize: 10, exportName: false
              })
            ]);
          }
        }
      ])]
    });
  }

  function editEmployee(e) {
    UI.formModal({
      title: e ? e.fullName : 'Приём сотрудника',
      values: e || { status: 'work', hireDate: U.today(), contractNo: 'ТД-' + (100 + App.Store.all('employees').length) },
      fields: [
        { k: 'fullName', t: 'ФИО', required: true, col: 12 },
        { k: 'position', t: 'Должность', type: 'select', required: true, col: 6,
          options: App.Seed.POSITIONS.map(function (p) { return { v: p, t: p }; }) },
        { k: 'department', t: 'Отдел', type: 'select', required: true, col: 6,
          options: App.Seed.DEPARTMENTS.map(function (d) { return { v: d, t: d }; }) },
        { k: 'hireDate', t: 'Дата приёма', type: 'date', required: true, col: 4 },
        { k: 'contractNo', t: 'Трудовой договор', col: 4 },
        { k: 'salary', t: 'Оклад, сом', type: 'money', required: true, col: 4 },
        { k: 'phone', t: 'Телефон', col: 4 },
        { k: 'email', t: 'Email', type: 'email', col: 4 },
        { k: 'inn', t: 'ИНН', col: 4 },
        { k: 'status', t: 'Статус', type: 'select', col: 6, empty: false, options: UI.statusOptions(['work', 'vacation', 'sick']) }
      ],
      onSave: function (v) {
        if (e) App.Store.update('employees', e.id, v);
        else App.Store.insert('employees', v);
        UI.toast({ kind: 'ok', title: 'Сотрудник сохранён', text: v.fullName });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     ЗАРПЛАТА
     ====================================================================== */
  function payroll() {
    const canEdit = App.Auth.canEdit('hr');
    const all = App.Store.all('payrolls');
    const periods = U.uniq(all.map(function (p) { return p.periodKey; })).sort().reverse();
    const periodKey = App.Router.current().params.period || periods[0];
    const rows = all.filter(function (p) { return p.periodKey === periodKey; });

    const gross = U.sum(rows, function (p) { return p.gross; });
    const net = U.sum(rows, function (p) { return p.net; });
    const taxes = U.sum(rows, function (p) { return p.incomeTax + p.social; });

    const periodSelect = el('select.select', {
      style: { width: 'auto' },
      onchange: function (e) { App.Router.go('payroll', { period: e.target.value }); }
    }, periods.map(function (p) {
      return el('option', { value: p, text: H.periodLabel(p), selected: p === periodKey });
    }));

    const trend = U.lastMonths(6);
    const trendVals = trend.map(function (m) {
      return U.sum(all.filter(function (p) { return p.periodKey === m.key; }), function (p) { return p.gross; });
    });

    return UI.page({
      title: 'Заработная плата',
      subtitle: 'Расчёт начислений, удержаний и выплат',
      actions: [
        periodSelect,
        canEdit ? UI.btn('Рассчитать зарплату', { kind: 'primary', icon: 'calc', onClick: function () { calcPayroll(periodKey); } }) : null,
        canEdit ? UI.btn('Выплатить', { icon: 'cash', onClick: function () { payAll(rows); } }) : null
      ].filter(Boolean),
      children: [
        UI.statGrid([
          { label: 'Начислено', value: U.moneyShort(gross), icon: 'wallet', tone: 'info' },
          { label: 'К выплате', value: U.moneyShort(net), icon: 'cash', tone: 'ok' },
          { label: 'Налоги и взносы', value: U.moneyShort(taxes), icon: 'percent', tone: 'warn',
            meta: U.pct(gross ? taxes / gross * 100 : 0, 1) + ' от ФОТ' },
          { label: 'Сотрудников в расчёте', value: rows.length, icon: 'users', tone: 'violet' }
        ], 4),

        el('div.grid.grid--2.mt-4', null, [
          UI.card({
            title: 'Динамика ФОТ',
            subtitle: 'начислено помесячно',
            body: [C.bars({ labels: trend.map(function (m) { return m.label; }), height: 210,
              series: [{ name: 'Начислено', values: trendVals, color: 'var(--c5)' }] })]
          }),
          UI.card({
            title: 'Структура выплаты',
            body: [C.donut({
              items: [
                { name: 'На руки', value: net, color: 'var(--c2)' },
                { name: 'Подоходный налог', value: U.sum(rows, function (p) { return p.incomeTax; }), color: 'var(--c3)' },
                { name: 'Соцфонд', value: U.sum(rows, function (p) { return p.social; }), color: 'var(--c4)' }
              ], size: 180, centerTop: U.moneyShort(gross), centerBottom: 'начислено'
            })]
          })
        ]),

        el('div.mt-4', null, [
          UI.card({
            title: 'Расчётная ведомость · ' + H.periodLabel(periodKey),
            flush: true,
            body: [UI.table({
              search: ['employeeName', 'position'],
              columns: [
                { k: 'employeeName', t: 'Сотрудник' },
                { k: 'position', t: 'Должность', w: '180px' },
                { k: 'base', t: 'Оклад', num: true, render: function (p) { return U.money(p.base, { digits: 0 }); } },
                { k: 'bonus', t: 'Премия', num: true, render: function (p) { return p.bonus ? U.money(p.bonus, { digits: 0 }) : '—'; } },
                { k: 'gross', t: 'Начислено', num: true, render: function (p) { return U.money(p.gross, { digits: 0 }); } },
                { k: 'incomeTax', t: 'Подоходный 10%', num: true, render: function (p) { return U.money(p.incomeTax, { digits: 0 }); } },
                { k: 'social', t: 'Соцфонд 10%', num: true, render: function (p) { return U.money(p.social, { digits: 0 }); } },
                { k: 'net', t: 'К выплате', num: true, render: function (p) { return el('strong', { text: U.money(p.net, { digits: 0 }) }); } },
                { k: 'status', t: 'Статус', w: '130px', render: function (p) { return UI.status(p.status); } }
              ],
              rows: rows, sort: { k: 'employeeName', dir: 'asc' }, pageSize: 20, exportName: 'payroll.csv',
              totals: {
                base: function (rs) { return U.money(U.sum(rs, function (r) { return r.base; }), { digits: 0 }); },
                gross: function (rs) { return U.money(U.sum(rs, function (r) { return r.gross; }), { digits: 0 }); },
                incomeTax: function (rs) { return U.money(U.sum(rs, function (r) { return r.incomeTax; }), { digits: 0 }); },
                social: function (rs) { return U.money(U.sum(rs, function (r) { return r.social; }), { digits: 0 }); },
                net: function (rs) { return U.money(U.sum(rs, function (r) { return r.net; }), { digits: 0 }); }
              }
            })]
          })
        ])
      ]
    });
  }

  function calcPayroll(periodKey) {
    const emps = App.Store.all('employees');
    const exists = App.Store.all('payrolls').filter(function (p) { return p.periodKey === periodKey; });
    UI.confirm({
      title: 'Расчёт заработной платы',
      text: 'Рассчитать зарплату за ' + H.periodLabel(periodKey) + ' для ' + emps.length + ' сотрудников?' +
        (exists.length ? ' Существующий расчёт (' + exists.length + ' записей) будет перезаписан.' : ''),
      okText: 'Рассчитать',
      onOk: function () {
        exists.forEach(function (p) { App.Store.remove('payrolls', p.id, { silent: true }); });
        emps.forEach(function (e) {
          const times = App.Store.all('timesheets').filter(function (t) { return t.employeeId === e.id && U.ym(t.date) === periodKey; });
          const workDays = times.filter(function (t) { return t.type === 'work'; }).length || 22;
          const base = Math.round(e.salary * Math.min(1, workDays / 22));
          const bonus = 0;
          const g = base + bonus;
          App.Store.insert('payrolls', {
            periodKey: periodKey, period: H.periodLabel(periodKey),
            employeeId: e.id, employeeName: e.fullName, position: e.position,
            base: base, bonus: bonus, gross: g,
            incomeTax: Math.round(g * 0.1), social: Math.round(g * 0.1),
            net: g - Math.round(g * 0.1) - Math.round(g * 0.1),
            status: 'calculated', paidAt: null
          }, { silent: true });
        });
        App.Store.emit('payrolls');
        App.Store.persist();
        App.Store.logAction('рассчитал зарплату за ' + H.periodLabel(periodKey), 'payrolls', null);
        UI.toast({ kind: 'ok', title: 'Зарплата рассчитана', text: emps.length + ' сотрудников' });
        App.Router.render();
      }
    });
  }

  function payAll(rows) {
    const pending = rows.filter(function (p) { return p.status !== 'paid'; });
    if (!pending.length) return UI.toast({ kind: 'warn', title: 'Все выплаты уже проведены' });
    const sum = U.sum(pending, function (p) { return p.net; });
    UI.confirm({
      title: 'Выплата заработной платы',
      text: 'Выплатить ' + U.money(sum, { digits: 0 }) + ' по ' + pending.length + ' сотрудникам? Будут созданы кассовые операции и проводки.',
      okText: 'Выплатить',
      onOk: function () {
        pending.forEach(function (p) {
          App.Store.update('payrolls', p.id, { status: 'paid', paidAt: U.today() }, { silent: true });
        });
        App.Store.emit('payrolls');
        H.autoEntries('cashOut', sum, U.today(), null);
        App.Store.insert('cashOrders', {
          number: H.nextNumber('cashOrders', 'РКО'), kind: 'out', date: U.today(), amount: sum,
          person: 'Ведомость по заработной плате', basis: 'Выплата заработной платы',
          cashier: (App.Auth.user() || {}).fullName, status: 'posted'
        });
        UI.toast({ kind: 'ok', title: 'Зарплата выплачена', text: U.money(sum, { digits: 0 }) });
        App.Router.render();
      }
    });
  }

  /* =========================================================================
     УЧЁТ РАБОЧЕГО ВРЕМЕНИ
     ====================================================================== */
  function timesheet() {
    const canEdit = App.Auth.canEdit('hr');
    const emps = App.Store.all('employees');
    const times = App.Store.all('timesheets');

    const days = [];
    for (let i = 13; i >= 0; i--) days.push(U.iso(U.addDays(new Date(), -i)));

    const rows = emps.map(function (e) {
      const r = { id: e.id, name: e.fullName, position: e.position, total: 0 };
      days.forEach(function (d) {
        const t = times.filter(function (x) { return x.employeeId === e.id && x.date === d; })[0];
        r['d_' + d] = t || null;
        r.total += t ? t.hours : 0;
      });
      return r;
    });

    const columns = [
      { k: 'name', t: 'Сотрудник', w: '230px', render: function (r) {
        return el('div', null, [el('div.strong.truncate', { text: r.name }), el('div.fs-xs.muted-2', { text: r.position })]);
      } }
    ].concat(days.map(function (d) {
      const dt = new Date(d);
      const weekend = dt.getDay() === 0 || dt.getDay() === 6;
      return {
        k: 'd_' + d, t: U.pad(dt.getDate()) + '.' + U.pad(dt.getMonth() + 1), num: true, sortable: false,
        render: function (r) {
          const t = r['d_' + d];
          if (!t) return el('span.muted-2', { text: weekend ? 'вх' : '—' });
          if (t.type === 'vacation') return el('span', { style: { color: 'var(--c6)' }, text: 'отп' });
          if (t.type === 'sick') return el('span', { style: { color: 'var(--c3)' }, text: 'б/л' });
          const cell = el('span', { text: String(t.hours) });
          if (canEdit) {
            cell.style.cursor = 'pointer';
            cell.title = 'Изменить';
            cell.onclick = function () { editTime(t); };
          }
          return cell;
        }
      };
    })).concat([
      { k: 'total', t: 'Итого', num: true, render: function (r) { return el('strong', { text: U.num(r.total, 0) + ' ч' }); } }
    ]);

    const monthHours = U.sum(times.filter(function (t) { return U.ym(t.date) === U.ym(U.today()); }), function (t) { return t.hours; });

    return UI.page({
      title: 'Учёт рабочего времени',
      subtitle: 'Табель за последние 14 дней · отпуска и больничные',
      actions: canEdit ? [UI.btn('Отметить отсутствие', { kind: 'primary', icon: 'calendar', onClick: markAbsence })] : [],
      children: [
        UI.statGrid([
          { label: 'Отработано за месяц', value: U.num(monthHours, 0) + ' ч', icon: 'clock', tone: 'info' },
          { label: 'Сотрудников в табеле', value: emps.length, icon: 'users', tone: 'ok' },
          { label: 'Дней отпуска', value: times.filter(function (t) { return t.type === 'vacation'; }).length, icon: 'sun', tone: 'warn' },
          { label: 'Дней больничного', value: times.filter(function (t) { return t.type === 'sick'; }).length, icon: 'alert', tone: 'danger' }
        ], 4),
        el('div.mt-4', null, [UI.card({
          title: 'Табель учёта рабочего времени',
          subtitle: 'вх — выходной, отп — отпуск, б/л — больничный',
          flush: true,
          body: [UI.table({
            search: ['name', 'position'],
            columns: columns, rows: rows, pageSize: 20, exportName: 'timesheet.csv'
          })]
        })])
      ]
    });
  }

  function editTime(t) {
    UI.formModal({
      title: 'Табель · ' + t.employeeName + ' · ' + U.fmtDate(t.date),
      size: 'sm',
      values: t,
      fields: [
        { k: 'type', t: 'Вид дня', type: 'select', empty: false, options: [
          { v: 'work', t: 'Рабочий день' }, { v: 'vacation', t: 'Отпуск' }, { v: 'sick', t: 'Больничный' }
        ] },
        { k: 'hours', t: 'Часов', type: 'number', min: 0, max: 24 }
      ],
      onSave: function (v) {
        if (v.type !== 'work') v.hours = 0;
        App.Store.update('timesheets', t.id, v);
        UI.toast({ kind: 'ok', title: 'Табель обновлён' });
        App.Router.render();
      }
    });
  }

  function markAbsence() {
    UI.formModal({
      title: 'Отметить отпуск или больничный',
      values: { type: 'vacation', from: U.today(), to: U.iso(U.addDays(new Date(), 7)) },
      fields: [
        { k: 'employeeId', t: 'Сотрудник', type: 'select', options: H.employeeOptions(), required: true, col: 12 },
        { k: 'type', t: 'Вид', type: 'select', empty: false, col: 4, options: [
          { v: 'vacation', t: 'Отпуск' }, { v: 'sick', t: 'Больничный' }
        ] },
        { k: 'from', t: 'С', type: 'date', required: true, col: 4 },
        { k: 'to', t: 'По', type: 'date', required: true, col: 4 }
      ],
      onSave: function (v) {
        const emp = App.Store.get('employees', v.employeeId);
        let d = new Date(v.from);
        let count = 0;
        while (U.iso(d) <= v.to && count < 90) {
          const iso = U.iso(d);
          const exist = App.Store.all('timesheets').filter(function (t) { return t.employeeId === v.employeeId && t.date === iso; })[0];
          if (exist) App.Store.update('timesheets', exist.id, { type: v.type, hours: 0 }, { silent: true });
          else App.Store.insert('timesheets', {
            employeeId: v.employeeId, employeeName: emp.fullName, date: iso, type: v.type, hours: 0
          }, { silent: true });
          d = U.addDays(d, 1);
          count++;
        }
        App.Store.update('employees', v.employeeId, { status: v.type }, { silent: true });
        App.Store.emit('timesheets');
        App.Store.persist();
        UI.toast({ kind: 'ok', title: 'Отмечено', text: emp.fullName + ' · ' + count + ' дней' });
        App.Router.render();
      }
    });
  }

  /* --- Маршруты ---------------------------------------------------------------- */
  App.Router.add('employees', { title: 'Сотрудники', module: 'hr', render: employees });
  App.Router.add('payroll', { title: 'Зарплата', module: 'hr', render: payroll });
  App.Router.add('timesheet', { title: 'Учёт времени', module: 'hr', render: timesheet });
})(window.App);

/* =============================================================================
   МУЛЬТИЯЗЫЧНОСТЬ: русский / кыргызский / английский
   T('nav.dashboard') → строка на текущем языке (фолбэк — русский, затем ключ).
   ========================================================================== */
(function (App) {
  'use strict';

  const DICT = {
    ru: {
      /* Навигация */
      'nav.main': 'Главное',
      'nav.dashboard': 'Дашборд',
      'nav.analytics': 'Финансовая аналитика',
      'nav.budget': 'Бюджетирование',
      'nav.debts': 'Задолженность',
      'nav.search': 'Расширенный поиск',

      'nav.reports': 'Отчётность',
      'nav.reportsHub': 'Центр отчётности',
      'nav.turnover': 'Оборотно-сальдовая',
      'nav.balance': 'Бухгалтерский баланс',
      'nav.pnl': 'Прибыли и убытки',
      'nav.cashflow': 'Движение денег',

      'nav.docs': 'Документооборот',
      'nav.documents': 'Документы',
      'nav.contracts': 'Договоры',
      'nav.approvals': 'Согласование',
      'nav.esign': 'Электронная подпись',

      'nav.accounting': 'Бухгалтерия',
      'nav.chart': 'План счетов',
      'nav.entries': 'Проводки',
      'nav.journal': 'Журнал операций',
      'nav.periods': 'Закрытие периода',
      'nav.assets': 'Основные средства',
      'nav.depreciation': 'Амортизация',
      'nav.taxes': 'Налоговый учёт',
      'nav.validation': 'Проверка ошибок',

      'nav.money': 'Деньги',
      'nav.cash': 'Касса',
      'nav.bank': 'Банк',
      'nav.payments': 'Платежи',

      'nav.stock': 'Склад и закупки',
      'nav.products': 'Товары',
      'nav.stockBalance': 'Остатки',
      'nav.moves': 'Движения',
      'nav.inventory': 'Инвентаризация',
      'nav.purchases': 'Закупки',

      'nav.sales': 'Продажи и CRM',
      'nav.salesList': 'Продажи',
      'nav.returns': 'Возвраты',
      'nav.counterparties': 'Контрагенты',
      'nav.crm': 'CRM · сделки',
      'nav.tasks': 'Задачи',

      'nav.hr': 'Сотрудники',
      'nav.employees': 'Кадры',
      'nav.payroll': 'Зарплата',
      'nav.timesheet': 'Учёт времени',

      'nav.process': 'Процессы',
      'nav.requests': 'Заявки',
      'nav.notifications': 'Уведомления',
      'nav.ai': 'AI-помощник',

      'nav.admin': 'Администрирование',
      'nav.users': 'Пользователи',
      'nav.roles': 'Роли и права',
      'nav.audit': 'Аудит действий',
      'nav.security': 'Безопасность и бэкап',
      'nav.integrations': 'Интеграции',
      'nav.settings': 'Настройки',

      /* Общее */
      'a.create': 'Создать',
      'a.edit': 'Изменить',
      'a.delete': 'Удалить',
      'a.save': 'Сохранить',
      'a.cancel': 'Отмена',
      'a.close': 'Закрыть',
      'a.search': 'Поиск',
      'a.export': 'Экспорт CSV',
      'a.print': 'Печать',
      'a.open': 'Открыть',
      'a.approve': 'Одобрить',
      'a.reject': 'Отклонить',
      'a.post': 'Провести',
      'a.sign': 'Подписать',
      'a.upload': 'Загрузить',
      'a.all': 'Все',
      'a.logout': 'Выйти',
      'a.confirm': 'Подтвердить',
      'a.filters': 'Фильтры',
      'a.reset': 'Сбросить',

      'w.total': 'Итого',
      'w.amount': 'Сумма',
      'w.date': 'Дата',
      'w.number': 'Номер',
      'w.status': 'Статус',
      'w.author': 'Автор',
      'w.type': 'Тип',
      'w.name': 'Наименование',
      'w.comment': 'Комментарий',
      'w.period': 'Период',
      'w.nothing': 'Нет данных',
      'w.nothingHint': 'Здесь пока пусто. Создайте первую запись.',
      'w.rows': 'записей',
      'w.loading': 'Загрузка…',

      /* Статусы */
      's.draft': 'Черновик',
      's.review': 'На проверке',
      's.approved': 'Одобрено',
      's.rejected': 'Отклонено',
      's.posted': 'Проведено',
      's.paid': 'Оплачено',
      's.partial': 'Частично',
      's.unpaid': 'Не оплачено',
      's.overdue': 'Просрочено',
      's.active': 'Действует',
      's.closed': 'Закрыт',
      's.new': 'Новая',
      's.done': 'Выполнено'
    },

    ky: {
      'nav.main': 'Башкы',
      'nav.dashboard': 'Башкы бет',
      'nav.analytics': 'Каржы аналитикасы',
      'nav.budget': 'Бюджеттөө',
      'nav.debts': 'Карыздар',
      'nav.search': 'Кеңейтилген издөө',

      'nav.reports': 'Отчёттуулук',
      'nav.reportsHub': 'Отчёт борбору',
      'nav.turnover': 'Жүгүртүү-сальдо',
      'nav.balance': 'Бухгалтердик баланс',
      'nav.pnl': 'Киреше жана чыгаша',
      'nav.cashflow': 'Акча кыймылы',

      'nav.docs': 'Документ жүгүртүү',
      'nav.documents': 'Документтер',
      'nav.contracts': 'Келишимдер',
      'nav.approvals': 'Макулдашуу',
      'nav.esign': 'Электрондук кол тамга',

      'nav.accounting': 'Бухгалтерия',
      'nav.chart': 'Эсептер планы',
      'nav.entries': 'Проводкалар',
      'nav.journal': 'Операциялар журналы',
      'nav.periods': 'Мезгилди жабуу',
      'nav.assets': 'Негизги каражаттар',
      'nav.depreciation': 'Амортизация',
      'nav.taxes': 'Салык эсеби',
      'nav.validation': 'Каталарды текшерүү',

      'nav.money': 'Акча',
      'nav.cash': 'Касса',
      'nav.bank': 'Банк',
      'nav.payments': 'Төлөмдөр',

      'nav.stock': 'Кампа жана сатып алуу',
      'nav.products': 'Товарлар',
      'nav.stockBalance': 'Калдыктар',
      'nav.moves': 'Кыймылдар',
      'nav.inventory': 'Инвентаризация',
      'nav.purchases': 'Сатып алуулар',

      'nav.sales': 'Сатуу жана CRM',
      'nav.salesList': 'Сатуулар',
      'nav.returns': 'Кайтаруулар',
      'nav.counterparties': 'Контрагенттер',
      'nav.crm': 'CRM · бүтүмдөр',
      'nav.tasks': 'Тапшырмалар',

      'nav.hr': 'Кызматкерлер',
      'nav.employees': 'Кадрлар',
      'nav.payroll': 'Эмгек акы',
      'nav.timesheet': 'Убакыт эсеби',

      'nav.process': 'Процесстер',
      'nav.requests': 'Арыздар',
      'nav.notifications': 'Билдирүүлөр',
      'nav.ai': 'AI-жардамчы',

      'nav.admin': 'Администрациялоо',
      'nav.users': 'Колдонуучулар',
      'nav.roles': 'Ролдор жана укуктар',
      'nav.audit': 'Аракеттер аудити',
      'nav.security': 'Коопсуздук жана камдык көчүрмө',
      'nav.integrations': 'Интеграциялар',
      'nav.settings': 'Жөндөөлөр',

      'a.create': 'Түзүү',
      'a.edit': 'Өзгөртүү',
      'a.delete': 'Өчүрүү',
      'a.save': 'Сактоо',
      'a.cancel': 'Жокко чыгаруу',
      'a.close': 'Жабуу',
      'a.search': 'Издөө',
      'a.export': 'CSV экспорт',
      'a.print': 'Басып чыгаруу',
      'a.open': 'Ачуу',
      'a.approve': 'Бекитүү',
      'a.reject': 'Четке кагуу',
      'a.post': 'Өткөрүү',
      'a.sign': 'Кол коюу',
      'a.upload': 'Жүктөө',
      'a.all': 'Баары',
      'a.logout': 'Чыгуу',
      'a.confirm': 'Ырастоо',
      'a.filters': 'Чыпкалар',
      'a.reset': 'Тазалоо',

      'w.total': 'Жыйынтык',
      'w.amount': 'Сумма',
      'w.date': 'Күнү',
      'w.number': 'Номери',
      'w.status': 'Абалы',
      'w.author': 'Автору',
      'w.type': 'Түрү',
      'w.name': 'Аталышы',
      'w.comment': 'Комментарий',
      'w.period': 'Мезгил',
      'w.nothing': 'Маалымат жок',
      'w.nothingHint': 'Бул жерде азырынча бош. Биринчи жазууну түзүңүз.',
      'w.rows': 'жазуу',
      'w.loading': 'Жүктөлүүдө…',

      's.draft': 'Долбоор',
      's.review': 'Текшерүүдө',
      's.approved': 'Бекитилген',
      's.rejected': 'Четке кагылган',
      's.posted': 'Өткөрүлгөн',
      's.paid': 'Төлөнгөн',
      's.partial': 'Жарым-жартылай',
      's.unpaid': 'Төлөнгөн эмес',
      's.overdue': 'Мөөнөтү өткөн',
      's.active': 'Колдонууда',
      's.closed': 'Жабык',
      's.new': 'Жаңы',
      's.done': 'Аткарылды'
    },

    en: {
      'nav.main': 'Overview',
      'nav.dashboard': 'Dashboard',
      'nav.analytics': 'Financial analytics',
      'nav.budget': 'Budgeting',
      'nav.debts': 'Receivables & payables',
      'nav.search': 'Advanced search',

      'nav.reports': 'Reports',
      'nav.reportsHub': 'Report centre',
      'nav.turnover': 'Trial balance',
      'nav.balance': 'Balance sheet',
      'nav.pnl': 'Profit & loss',
      'nav.cashflow': 'Cash flow',

      'nav.docs': 'Document flow',
      'nav.documents': 'Documents',
      'nav.contracts': 'Contracts',
      'nav.approvals': 'Approvals',
      'nav.esign': 'E-signature',

      'nav.accounting': 'Accounting',
      'nav.chart': 'Chart of accounts',
      'nav.entries': 'Journal entries',
      'nav.journal': 'Operations log',
      'nav.periods': 'Period closing',
      'nav.assets': 'Fixed assets',
      'nav.depreciation': 'Depreciation',
      'nav.taxes': 'Tax accounting',
      'nav.validation': 'Error checks',

      'nav.money': 'Money',
      'nav.cash': 'Cash desk',
      'nav.bank': 'Bank',
      'nav.payments': 'Payments',

      'nav.stock': 'Inventory & purchasing',
      'nav.products': 'Products',
      'nav.stockBalance': 'Stock balance',
      'nav.moves': 'Movements',
      'nav.inventory': 'Stock count',
      'nav.purchases': 'Purchasing',

      'nav.sales': 'Sales & CRM',
      'nav.salesList': 'Sales',
      'nav.returns': 'Returns',
      'nav.counterparties': 'Counterparties',
      'nav.crm': 'CRM · deals',
      'nav.tasks': 'Tasks',

      'nav.hr': 'People',
      'nav.employees': 'Employees',
      'nav.payroll': 'Payroll',
      'nav.timesheet': 'Timesheet',

      'nav.process': 'Processes',
      'nav.requests': 'Internal requests',
      'nav.notifications': 'Notifications',
      'nav.ai': 'AI assistant',

      'nav.admin': 'Administration',
      'nav.users': 'Users',
      'nav.roles': 'Roles & permissions',
      'nav.audit': 'Audit log',
      'nav.security': 'Security & backup',
      'nav.integrations': 'Integrations',
      'nav.settings': 'Settings',

      'a.create': 'Create',
      'a.edit': 'Edit',
      'a.delete': 'Delete',
      'a.save': 'Save',
      'a.cancel': 'Cancel',
      'a.close': 'Close',
      'a.search': 'Search',
      'a.export': 'Export CSV',
      'a.print': 'Print',
      'a.open': 'Open',
      'a.approve': 'Approve',
      'a.reject': 'Reject',
      'a.post': 'Post',
      'a.sign': 'Sign',
      'a.upload': 'Upload',
      'a.all': 'All',
      'a.logout': 'Log out',
      'a.confirm': 'Confirm',
      'a.filters': 'Filters',
      'a.reset': 'Reset',

      'w.total': 'Total',
      'w.amount': 'Amount',
      'w.date': 'Date',
      'w.number': 'No.',
      'w.status': 'Status',
      'w.author': 'Author',
      'w.type': 'Type',
      'w.name': 'Name',
      'w.comment': 'Comment',
      'w.period': 'Period',
      'w.nothing': 'No data',
      'w.nothingHint': 'Nothing here yet. Create the first record.',
      'w.rows': 'records',
      'w.loading': 'Loading…',

      's.draft': 'Draft',
      's.review': 'In review',
      's.approved': 'Approved',
      's.rejected': 'Rejected',
      's.posted': 'Posted',
      's.paid': 'Paid',
      's.partial': 'Partial',
      's.unpaid': 'Unpaid',
      's.overdue': 'Overdue',
      's.active': 'Active',
      's.closed': 'Closed',
      's.new': 'New',
      's.done': 'Done'
    }
  };

  let lang = 'ru';
  const listeners = [];

  function T(key, vars) {
    const d = DICT[lang] || DICT.ru;
    let s = d[key];
    if (s === undefined) s = DICT.ru[key];
    if (s === undefined) s = key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  App.I18n = {
    T: T,
    get lang() { return lang; },
    set: function (code) {
      if (!DICT[code]) return;
      lang = code;
      document.documentElement.lang = code;
      listeners.forEach(function (fn) { fn(code); });
    },
    onChange: function (fn) { listeners.push(fn); },
    languages: [
      { code: 'ru', name: 'Русский' },
      { code: 'ky', name: 'Кыргызча' },
      { code: 'en', name: 'English' }
    ]
  };

  window.T = T;
})(window.App);

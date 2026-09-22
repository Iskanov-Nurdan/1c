/* =============================================================================
   ДЕМО-ДАННЫЕ
   Детерминированная генерация: при каждом сбросе получается один и тот же
   набор данных, чтобы демонстрация была воспроизводимой.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const VERSION = 7;

  /* --- Справочные строки ---------------------------------------------------- */
  const CLIENT_NAMES = [
    'ОсОО «Ак-Марал Трейд»', 'ОсОО «Береке Логистик»', 'ИП Абдыраимов А.А.', 'ОсОО «Тянь-Шань Строй»',
    'ОсОО «Нур Электро»', 'ЗАО «Кыргыз Пласт»', 'ОсОО «Ала-Тоо Фуд»', 'ИП Сатыбалдиева Н.К.',
    'ОсОО «Манас Мебель»', 'ОсОО «Иссык-Куль Ритейл»', 'ОсОО «Дордой Оптима»', 'ИП Жумабеков Т.М.',
    'ОсОО «Бишкек Техно»', 'ОсОО «Чуй Агро»', 'ОсОО «Ош Маркет»', 'ОсОО «Салам Строй»',
    'ОсОО «Кант Цемент Трейд»', 'ИП Токтогулова А.Б.', 'ОсОО «Жибек Жолу Транс»', 'ОсОО «Эко Пак»'
  ];
  const SUPPLIER_NAMES = [
    'ОсОО «Глобал Поставка»', 'ОсОО «Сити Оптторг»', 'ОсОО «Азия Компонент»', 'ОсОО «Про Инструмент»',
    'ОсОО «Каскад Импорт»', 'ОсОО «Стандарт Офис»', 'ОсОО «Техно Снаб»', 'ОсОО «Первая Упаковка»',
    'ОсОО «Мега Дистрибьюшн»', 'ОсОО «Восток Трейдинг»', 'ОсОО «Электро Мир»', 'ОсОО «Гранд Логистика»'
  ];
  const EMPLOYEE_NAMES = [
    'Абдыразаков Тимур Русланович', 'Сыдыкова Айгуль Мелисовна', 'Орозбеков Данияр Кубанычбекович',
    'Кадырова Нургуль Асановна', 'Исаков Бекболот Маратович', 'Турдубаева Жылдыз Сапарбековна',
    'Мамытов Азамат Эрланович', 'Осмонова Айпери Талантбековна', 'Джумабаев Улан Асылбекович',
    'Бекова Динара Нурлановна', 'Шамшиев Эрмек Токтосунович', 'Алымкулова Жамиля Бакытовна',
    'Раимбеков Санжар Нурбекович', 'Касымова Аида Маратовна', 'Токтоназаров Азиз Болотович'
  ];
  const POSITIONS = [
    'Главный бухгалтер', 'Бухгалтер', 'Кассир', 'Менеджер по продажам', 'Кладовщик',
    'Логист', 'Менеджер по закупкам', 'Директор', 'Юрист', 'HR-менеджер', 'IT-специалист'
  ];
  const DEPARTMENTS = ['Бухгалтерия', 'Продажи', 'Склад', 'Закупки', 'Администрация', 'IT'];
  const PRODUCT_NAMES = [
    ['Бумага офисная А4, 80 г/м²', 'Канцтовары', 'пач'], ['Ручка шариковая синяя', 'Канцтовары', 'шт'],
    ['Папка-регистратор 75 мм', 'Канцтовары', 'шт'], ['Степлер №24', 'Канцтовары', 'шт'],
    ['Картридж лазерный CF283A', 'Расходники', 'шт'], ['Тонер универсальный, 1 кг', 'Расходники', 'кг'],
    ['Кабель UTP cat.5e', 'Электрика', 'м'], ['Розетка настенная 16А', 'Электрика', 'шт'],
    ['Лампа LED 12 Вт E27', 'Электрика', 'шт'], ['Удлинитель 5 м, 5 гнёзд', 'Электрика', 'шт'],
    ['Ноутбук 15.6" i5/8/512', 'Техника', 'шт'], ['Монитор 24" IPS', 'Техника', 'шт'],
    ['Клавиатура USB', 'Техника', 'шт'], ['Мышь беспроводная', 'Техника', 'шт'],
    ['МФУ лазерное A4', 'Техника', 'шт'], ['ИБП 650 ВА', 'Техника', 'шт'],
    ['Стол офисный 120х70', 'Мебель', 'шт'], ['Кресло офисное', 'Мебель', 'шт'],
    ['Шкаф для документов', 'Мебель', 'шт'], ['Тумба выкатная', 'Мебель', 'шт'],
    ['Вода питьевая 19 л', 'Хозтовары', 'шт'], ['Средство чистящее 1 л', 'Хозтовары', 'шт'],
    ['Перчатки рабочие', 'Хозтовары', 'пар'], ['Мешки для мусора 120 л', 'Хозтовары', 'уп'],
    ['Коробка картонная 400х300', 'Упаковка', 'шт'], ['Скотч упаковочный 50 мм', 'Упаковка', 'шт'],
    ['Стрейч-плёнка 2 кг', 'Упаковка', 'рул'], ['Этикетки самоклеящиеся', 'Упаковка', 'уп'],
    ['Цемент М400, 50 кг', 'Стройматериалы', 'меш'], ['Профиль ПН 50х40', 'Стройматериалы', 'шт'],
    ['Гипсокартон 12.5 мм', 'Стройматериалы', 'лист'], ['Саморезы 3.5х25, 1000 шт', 'Стройматериалы', 'уп']
  ];
  const EXPENSE_ITEMS = ['Аренда офиса', 'Коммунальные услуги', 'Заработная плата', 'Налоги и сборы', 'Реклама и маркетинг', 'Транспорт и ГСМ', 'Связь и интернет', 'Канцтовары', 'Обслуживание техники', 'Прочие расходы'];
  const INCOME_ITEMS = ['Выручка от продаж', 'Услуги', 'Аренда', 'Прочие доходы'];
  const CITIES = ['г. Бишкек, ул. Чуй 128', 'г. Бишкек, ул. Ибраимова 45', 'г. Ош, ул. Ленина 210', 'г. Кант, ул. Гагарина 12', 'г. Токмок, ул. Джамбула 7', 'г. Каракол, ул. Абдрахманова 33'];
  const BANKS = ['ОАО «Оптима Банк»', 'ЗАО «Демир Банк»', 'ОАО «РСК Банк»', 'ОАО «Айыл Банк»', 'ЗАО «Кыргызкоммерцбанк»'];

  /* --- План счетов (сокращённый, в стиле КР/РФ) ------------------------------ */
  const ACCOUNTS = [
    ['01', 'Основные средства', 'A'], ['02', 'Амортизация основных средств', 'P'],
    ['04', 'Нематериальные активы', 'A'], ['10', 'Материалы', 'A'],
    ['20', 'Основное производство', 'A'], ['26', 'Общехозяйственные расходы', 'A'],
    ['41', 'Товары', 'A'], ['41.1', 'Товары на складе', 'A'], ['41.2', 'Товары в рознице', 'A'],
    ['43', 'Готовая продукция', 'A'], ['44', 'Расходы на продажу', 'A'],
    ['50', 'Касса', 'A'], ['50.1', 'Касса организации', 'A'],
    ['51', 'Расчётные счета', 'A'], ['52', 'Валютные счета', 'A'],
    ['60', 'Расчёты с поставщиками', 'AP'], ['60.1', 'Расчёты с поставщиками (сом)', 'AP'],
    ['62', 'Расчёты с покупателями', 'AP'], ['62.1', 'Расчёты с покупателями (сом)', 'AP'],
    ['66', 'Краткосрочные кредиты', 'P'], ['68', 'Расчёты по налогам и сборам', 'AP'],
    ['68.1', 'НДС', 'AP'], ['68.2', 'Налог на прибыль', 'AP'], ['68.4', 'Подоходный налог', 'AP'],
    ['69', 'Расчёты по соцстрахованию', 'P'], ['70', 'Расчёты с персоналом по оплате труда', 'P'],
    ['71', 'Расчёты с подотчётными лицами', 'AP'], ['76', 'Расчёты с прочими дебиторами и кредиторами', 'AP'],
    ['80', 'Уставный капитал', 'P'], ['84', 'Нераспределённая прибыль', 'P'],
    ['90', 'Продажи', 'AP'], ['90.1', 'Выручка', 'P'], ['90.2', 'Себестоимость продаж', 'A'],
    ['91', 'Прочие доходы и расходы', 'AP'], ['99', 'Прибыли и убытки', 'AP']
  ];

  /* --- Основные средства (ТЗ п. 5) --------------------------------------------
     Набор подобран так, чтобы в демо были представлены все четыре метода
     амортизации и разные счета затрат: 26 — управленческие расходы,
     20 — основное производство, 44 — расходы на продажу.
     Поля: наименование, группа, метод, стоимость, ликвидационная стоимость,
     СПИ в месяцах, счёт затрат, местонахождение, выработка, ед. выработки. */
  const FIXED_ASSETS = [
    ['Административное здание, ул. Чуй 128', 'building', 'straight', 18000000, 1800000, 480, '26', 'г. Бишкек, ул. Чуй 128', 0, ''],
    ['Складской комплекс, 1 200 м²', 'building', 'straight', 9400000, 940000, 360, '20', 'г. Бишкек, ул. Ибраимова 45', 0, ''],
    ['Грузовой автомобиль Hyundai HD-78', 'vehicle', 'declining', 2450000, 245000, 84, '20', 'Автопарк', 0, ''],
    ['Автомобиль Toyota Camry (директор)', 'vehicle', 'declining', 3100000, 465000, 84, '26', 'Администрация', 0, ''],
    ['Погрузчик вилочный 1,5 т', 'machine', 'units', 1280000, 128000, 120, '20', 'Склад №1', 12000, 'моточас'],
    ['Линия фасовки полуавтоматическая', 'machine', 'sumYears', 2760000, 276000, 96, '20', 'Цех', 0, ''],
    ['Серверная стойка с ИБП', 'computer', 'straight', 980000, 98000, 60, '26', 'Серверная', 0, ''],
    ['Комплект рабочих станций, 12 шт.', 'computer', 'straight', 720000, 72000, 48, '26', 'Офис', 0, ''],
    ['Мебель офисная (кабинеты 1–4)', 'furniture', 'straight', 540000, 54000, 84, '26', 'Офис', 0, ''],
    ['Стеллажи складские паллетные', 'furniture', 'straight', 860000, 86000, 120, '20', 'Склад №1', 0, ''],
    ['Кондиционеры торгового зала, 6 шт.', 'other', 'straight', 460000, 46000, 72, '44', 'Торговый зал', 0, ''],
    ['Витрины и торговое оборудование', 'other', 'straight', 680000, 68000, 84, '44', 'Торговый зал', 0, '']
  ];

  /* --- Входящее сальдо на начало учёта: актив = пассив = 126 550 000 -------- */
  const OPENING_BALANCES = {
    '01': 4500000, '02': 900000, '41.1': 120000000, '50.1': 150000, '51': 2800000,
    '80': 20000000, '84': 106550000
  };

  /* Доля себестоимости в цене реализации — используется при разноске продаж. */
  const COST_RATIO = 0.7;

  /* --- Роли и права ---------------------------------------------------------- */
  const MODULES = [
    'dashboard', 'analytics', 'budget', 'debts', 'reports',
    'documents', 'contracts', 'approvals', 'esign',
    'accounting', 'assets', 'taxes', 'validation',
    'cash', 'bank', 'payments',
    'warehouse', 'purchases',
    'sales', 'crm', 'counterparties',
    'hr', 'requests', 'notifications', 'ai', 'admin'
  ];

  const ROLES = [
    {
      id: 'role-admin', code: 'admin', name: 'Администратор системы',
      description: 'Полный доступ, управление пользователями и резервным копированием',
      permissions: MODULES.slice(), readonly: []
    },
    {
      id: 'role-chief', code: 'chief', name: 'Главный бухгалтер',
      description: 'Вся бухгалтерия, проверка операций, закрытие периодов, отчётность',
      permissions: MODULES.filter(function (m) { return m !== 'admin'; }).concat(['admin']),
      readonly: ['admin']
    },
    {
      id: 'role-accountant', code: 'accountant', name: 'Бухгалтер',
      description: 'Создание документов, проведение операций, работа с контрагентами',
      permissions: ['dashboard', 'documents', 'contracts', 'approvals', 'accounting', 'assets', 'taxes', 'validation', 'cash', 'bank', 'payments', 'counterparties', 'debts', 'reports', 'requests', 'notifications', 'ai', 'esign'],
      readonly: ['taxes']
    },
    {
      id: 'role-cashier', code: 'cashier', name: 'Кассир',
      description: 'Касса: приём и выдача денег, кассовые документы',
      permissions: ['dashboard', 'cash', 'payments', 'counterparties', 'documents', 'requests', 'notifications'],
      readonly: ['documents', 'counterparties']
    },
    {
      id: 'role-manager', code: 'manager', name: 'Менеджер',
      description: 'Клиенты, продажи, заявки, сделки CRM',
      permissions: ['dashboard', 'sales', 'crm', 'counterparties', 'warehouse', 'documents', 'requests', 'notifications', 'debts', 'ai'],
      readonly: ['warehouse', 'debts']
    },
    {
      id: 'role-director', code: 'director', name: 'Руководитель',
      description: 'Аналитика, утверждение документов, контроль финансов',
      permissions: MODULES.slice(),
      readonly: ['accounting', 'assets', 'warehouse', 'hr', 'admin', 'taxes']
    }
  ];

  const USERS = [
    ['admin', 'Администратор Системы', 'admin', 'admin@company.kg'],
    ['glavbuh', 'Кадырова Нургуль Асановна', 'chief', 'chief@company.kg'],
    ['buh', 'Турдубаева Жылдыз Сапарбековна', 'accountant', 'buh@company.kg'],
    ['kassa', 'Осмонова Айпери Талантбековна', 'cashier', 'cashier@company.kg'],
    ['manager', 'Мамытов Азамат Эрланович', 'manager', 'sales@company.kg'],
    ['director', 'Абдыразаков Тимур Русланович', 'director', 'ceo@company.kg']
  ];

  function defaultSettings() {
    return {
      id: 'settings',
      currency: 'сом',
      language: 'ru',
      theme: 'dark',
      density: 'comfortable',
      vatRate: 12,
      salesTaxRate: 2,
      incomeTaxRate: 10,
      socialFundRate: 27.25,
      notifyTelegram: true,
      notifyEmail: true,
      notifySms: false,
      telegramBot: '@erp_company_bot',
      smtpHost: 'smtp.company.kg',
      autoBackup: true,
      backupTime: '03:00',
      sessionTimeout: 30,
      require2fa: false,
      passwordPolicy: 'Минимум 8 символов, буквы и цифры',
      docNumberFormat: '{type}-{year}-{seq}',
      fiscalYearStart: '01-01'
    };
  }

  /* =========================================================================
     ГЕНЕРАТОР
     ====================================================================== */
  function build() {
    const rand = U.rng(20260728);
    const db = { _meta: { version: VERSION, createdAt: new Date().toISOString() } };
    const now = new Date();
    const daysAgo = function (n) { return U.iso(U.addDays(now, -n)); };
    const daysFwd = function (n) { return U.iso(U.addDays(now, n)); };

    /* --- Организации ------------------------------------------------------ */
    db.companies = [
      { id: 'co-1', name: 'ОсОО «Прогресс Групп»', inn: '01503201910123', address: 'г. Бишкек, ул. Чуй 128', phone: '+996 312 55-11-22', director: 'Абдыразаков Т. Р.', accountant: 'Кадырова Н. А.', taxMode: 'Общий режим (НДС)', bank: BANKS[0], account: '1180000012345678', bik: '118001' },
      { id: 'co-2', name: 'ОсОО «Прогресс Ритейл»', inn: '01503201910456', address: 'г. Ош, ул. Ленина 210', phone: '+996 3222 5-44-33', director: 'Исаков Б. М.', accountant: 'Турдубаева Ж. С.', taxMode: 'Упрощённая система', bank: BANKS[1], account: '1090000098765432', bik: '109002' }
    ];
    db._meta.currentCompany = 'co-1';

    /* --- Роли и пользователи ---------------------------------------------- */
    db.roles = ROLES.map(function (r) { return Object.assign({}, r); });
    db.users = USERS.map(function (u, i) {
      return {
        id: 'usr-' + (i + 1), login: u[0], password: '1234', fullName: u[1], role: u[2], email: u[3],
        phone: '+996 55' + U.randInt(rand, 1000000, 9999999),
        active: true, twoFactor: i === 0,
        companies: i < 4 ? ['co-1', 'co-2'] : ['co-1'],
        lastLogin: new Date(now - U.randInt(rand, 1, 72) * 3600000).toISOString(),
        createdAt: daysAgo(400 - i * 20)
      };
    });

    db.settings = [defaultSettings()];

    /* --- План счетов ------------------------------------------------------- */
    db.accounts = ACCOUNTS.map(function (a) {
      return {
        id: 'acc-' + a[0], code: a[0], name: a[1], kind: a[2],
        parent: a[0].indexOf('.') > -1 ? a[0].split('.')[0] : null,
        opening: OPENING_BALANCES[a[0]] || 0
      };
    });

    /* --- Основные средства -------------------------------------------------- */
    db.fixedAssets = FIXED_ASSETS.map(function (a, i) {
      return {
        id: 'fa-' + (i + 1),
        companyId: 'co-1',
        invNumber: 'ОС-' + String(i + 1).padStart(4, '0'),
        name: a[0], group: a[1], method: a[2],
        account: '01', depreciationAccount: '02', expenseAccount: a[6],
        // Срок эксплуатации к сегодняшнему дню — от четверти до половины СПИ,
        // чтобы в демо были и свежие объекты, и заметно изношенные
        commissionedAt: daysAgo(Math.round(a[5] * U.randInt(rand, 8, 22))),
        initialCost: a[3], salvageValue: a[4], lifeMonths: a[5],
        decliningRate: 2, totalUnits: a[8], usedUnits: 0, unitsName: a[9],
        accumulated: 0,
        location: a[7], responsible: '', status: 'operation',
        disposedAt: null, disposalReason: '', note: ''
      };
    });

    /* --- Контрагенты -------------------------------------------------------- */
    db.counterparties = [];
    CLIENT_NAMES.forEach(function (name, i) {
      db.counterparties.push(makeCounterparty(rand, name, 'client', i, daysAgo));
    });
    SUPPLIER_NAMES.forEach(function (name, i) {
      db.counterparties.push(makeCounterparty(rand, name, 'supplier', i + 100, daysAgo));
    });

    const clients = db.counterparties.filter(function (c) { return c.kind === 'client'; });
    const suppliers = db.counterparties.filter(function (c) { return c.kind === 'supplier'; });

    /* --- Сотрудники ---------------------------------------------------------- */
    db.employees = EMPLOYEE_NAMES.map(function (fio, i) {
      const salary = U.randInt(rand, 25, 90) * 1000;
      return {
        id: 'emp-' + (i + 1), companyId: i > 11 ? 'co-2' : 'co-1',
        fullName: fio, position: POSITIONS[i % POSITIONS.length], department: DEPARTMENTS[i % DEPARTMENTS.length],
        hireDate: daysAgo(U.randInt(rand, 90, 1800)),
        salary: salary, phone: '+996 70' + U.randInt(rand, 1000000, 9999999),
        email: 'emp' + (i + 1) + '@company.kg',
        inn: '2' + U.randInt(rand, 1000000000000, 9999999999999),
        status: i === 13 ? 'vacation' : (i === 14 ? 'sick' : 'work'),
        contractNo: 'ТД-' + (100 + i)
      };
    });

    /* --- Склады, категории, товары -------------------------------------------- */
    db.warehouses = [
      { id: 'wh-1', companyId: 'co-1', name: 'Основной склад', branch: 'Бишкек', address: 'ул. Чуй 128', manager: 'Исаков Б. М.' },
      { id: 'wh-2', companyId: 'co-1', name: 'Склад розницы', branch: 'Бишкек', address: 'ул. Ибраимова 45', manager: 'Бекова Д. Н.' },
      { id: 'wh-3', companyId: 'co-2', name: 'Склад Ош', branch: 'Ош', address: 'ул. Ленина 210', manager: 'Джумабаев У. А.' }
    ];
    db.units = [{ id: 'u1', name: 'шт' }, { id: 'u2', name: 'кг' }, { id: 'u3', name: 'м' }, { id: 'u4', name: 'уп' }, { id: 'u5', name: 'пач' }, { id: 'u6', name: 'рул' }, { id: 'u7', name: 'лист' }, { id: 'u8', name: 'меш' }, { id: 'u9', name: 'пар' }];
    db.categories = U.uniq(PRODUCT_NAMES.map(function (p) { return p[1]; })).map(function (n, i) {
      return { id: 'cat-' + (i + 1), name: n };
    });

    db.products = PRODUCT_NAMES.map(function (p, i) {
      const cost = U.randInt(rand, 40, 60000);
      const cat = db.categories.filter(function (c) { return c.name === p[1]; })[0];
      return {
        id: 'prd-' + (i + 1), companyId: 'co-1',
        sku: 'ART-' + U.pad(i + 1) + '' + U.randInt(rand, 10, 99),
        barcode: '48' + U.randInt(rand, 10000000000, 99999999999),
        name: p[0], categoryId: cat.id, unit: p[2],
        cost: cost, price: Math.round(cost * (1.2 + rand() * 0.5)),
        vat: 12, minStock: U.randInt(rand, 3, 25), active: true
      };
    });

    /* --- Остатки на складах --------------------------------------------------- */
    db.stock = [];
    db.products.forEach(function (p) {
      db.warehouses.filter(function (w) { return w.companyId === 'co-1'; }).forEach(function (w) {
        db.stock.push({
          id: 'stk-' + p.id + '-' + w.id, companyId: 'co-1',
          productId: p.id, warehouseId: w.id,
          qty: rand() > 0.12 ? U.randInt(rand, 0, 180) : 0
        });
      });
    });

    /* --- Договоры -------------------------------------------------------------- */
    const CONTRACT_TYPES = ['Поставка товара', 'Оказание услуг', 'Аренда', 'Подряд', 'Агентский'];
    db.contracts = [];
    for (let i = 0; i < 26; i++) {
      const isClient = i < 16;
      const cp = isClient ? U.pick(rand, clients) : U.pick(rand, suppliers);
      const start = U.randInt(rand, 30, 700);
      const durationDays = U.pick(rand, [180, 365, 365, 730]);
      const endIso = U.iso(U.addDays(U.addDays(now, -start), durationDays));
      const left = U.daysLeft(endIso);
      db.contracts.push({
        id: 'ctr-' + (i + 1), companyId: 'co-1',
        number: 'Д-' + (2025 + (i % 2)) + '/' + U.pad(i + 1),
        date: daysAgo(start),
        counterpartyId: cp.id,
        side: isClient ? 'client' : 'supplier',
        type: U.pick(rand, CONTRACT_TYPES),
        subject: isClient ? 'Поставка товаров покупателю' : 'Поставка товаров/услуг от поставщика',
        amount: U.randInt(rand, 50, 3500) * 1000,
        currency: 'KGS',
        startDate: daysAgo(start),
        endDate: endIso,
        autoRenew: rand() > 0.7,
        status: left < 0 ? 'expired' : 'active',
        responsible: U.pick(rand, db.employees).fullName,
        template: U.pick(rand, ['Стандартный договор поставки', 'Договор услуг', 'Рамочный договор']),
        signed: rand() > 0.25,
        notes: ''
      });
    }

    /* --- Документы (ЭДО) --------------------------------------------------------- */
    const DOC_TYPES = [
      ['invoice', 'Счёт на оплату'], ['waybill', 'Накладная'], ['act', 'Акт выполненных работ'],
      ['contract', 'Договор'], ['payment', 'Платёжное поручение'], ['cash_order', 'Кассовый ордер'],
      ['vat_invoice', 'Счёт-фактура'], ['poa', 'Доверенность'],
      ['statement', 'Банковская выписка'], ['hr', 'Кадровый документ']
    ];
    const DOC_STATUSES = ['draft', 'review', 'approved', 'posted', 'rejected'];
    db.documents = [];
    for (let i = 0; i < 96; i++) {
      const t = DOC_TYPES[i % DOC_TYPES.length];
      const cp = U.pick(rand, db.counterparties);
      const d = daysAgo(U.randInt(rand, 0, 220));
      const st = i < 6 ? 'review' : U.pick(rand, DOC_STATUSES);
      const amount = U.randInt(rand, 3, 900) * 1000;
      db.documents.push({
        id: 'doc-' + (i + 1), companyId: 'co-1',
        number: t[0].slice(0, 3).toUpperCase() + '-' + U.pad(i + 1) + '/' + new Date(d).getFullYear(),
        type: t[0], typeName: t[1], date: d,
        counterpartyId: cp.id,
        amount: t[0] === 'poa' || t[0] === 'hr' ? 0 : amount,
        status: st,
        fileName: t[0] + '_' + U.pad(i + 1) + (rand() > 0.5 ? '.pdf' : '.jpg'),
        fileSize: U.randInt(rand, 80, 4200),
        ocr: rand() > 0.35,
        ocrText: 'Документ ' + t[1] + ' № ' + U.pad(i + 1) + ' от ' + U.fmtDate(d) + '. Контрагент: ' + cp.name +
          '. ИНН ' + cp.inn + '. Сумма: ' + U.num(amount, 2) + ' сом, в т.ч. НДС 12%. Основание: договор поставки.',
        signed: st === 'posted' && rand() > 0.4,
        author: U.pick(rand, db.users).fullName,
        createdAt: new Date(d).toISOString(),
        tags: [t[1]],
        route: buildRoute(rand, st, d),
        history: [
          { ts: new Date(d).toISOString(), user: 'Бухгалтер', action: 'Документ создан' },
          { ts: new Date(new Date(d).getTime() + 3600000).toISOString(), user: 'Система', action: 'Файл загружен и распознан (OCR)' }
        ]
      });
    }

    /* --- Продажи ------------------------------------------------------------------ */
    db.sales = [];
    for (let i = 0; i < 140; i++) {
      const cp = U.pick(rand, clients);
      const d = daysAgo(U.randInt(rand, 0, 330));
      const items = [];
      const n = U.randInt(rand, 1, 5);
      for (let j = 0; j < n; j++) {
        const p = U.pick(rand, db.products);
        const qty = U.randInt(rand, 1, 20);
        items.push({ productId: p.id, name: p.name, unit: p.unit, qty: qty, price: p.price, sum: qty * p.price });
      }
      const total = U.sum(items, function (x) { return x.sum; });
      const discount = rand() > 0.75 ? Math.round(total * 0.05) : 0;
      const amount = total - discount;
      const paidRatio = U.pick(rand, [1, 1, 1, 0.5, 0]);
      db.sales.push({
        id: 'sal-' + (i + 1), companyId: 'co-1',
        number: 'РН-' + U.pad(i + 1), date: d, counterpartyId: cp.id,
        warehouseId: U.pick(rand, ['wh-1', 'wh-2']),
        items: items, total: total, discount: discount, amount: amount,
        vat: Math.round(amount * 12 / 112),
        paid: Math.round(amount * paidRatio),
        dueDate: U.iso(U.addDays(new Date(d), 14)),
        status: paidRatio === 1 ? 'paid' : (paidRatio === 0 ? 'unpaid' : 'partial'),
        manager: U.pick(rand, ['Мамытов Азамат', 'Бекова Динара', 'Раимбеков Санжар']),
        posted: rand() > 0.15
      });
    }

    db.returns = [];
    for (let i = 0; i < 9; i++) {
      const s = U.pick(rand, db.sales);
      db.returns.push({
        id: 'ret-' + (i + 1), companyId: 'co-1',
        number: 'ВЗ-' + U.pad(i + 1), date: daysAgo(U.randInt(rand, 1, 120)),
        saleId: s.id, saleNumber: s.number, counterpartyId: s.counterpartyId,
        amount: Math.round(s.amount * (0.2 + rand() * 0.5)),
        reason: U.pick(rand, ['Брак товара', 'Пересорт', 'Отказ покупателя', 'Ошибка в документах']),
        status: U.pick(rand, ['approved', 'review', 'posted'])
      });
    }

    /* --- Закупки -------------------------------------------------------------------- */
    db.purchaseRequests = [];
    for (let i = 0; i < 18; i++) {
      const p = U.pick(rand, db.products);
      const qty = U.randInt(rand, 5, 60);
      db.purchaseRequests.push({
        id: 'prq-' + (i + 1), companyId: 'co-1',
        number: 'ЗК-' + U.pad(i + 1), date: daysAgo(U.randInt(rand, 0, 90)),
        productId: p.id, productName: p.name, qty: qty, unit: p.unit,
        amount: qty * p.cost,
        need: daysFwd(U.randInt(rand, 3, 30)),
        author: U.pick(rand, db.employees).fullName,
        status: U.pick(rand, ['new', 'review', 'approved', 'done', 'rejected']),
        comment: 'Пополнение складского запаса'
      });
    }

    db.purchaseOrders = [];
    for (let i = 0; i < 24; i++) {
      const sup = U.pick(rand, suppliers);
      const d = daysAgo(U.randInt(rand, 0, 260));
      const items = [];
      const n = U.randInt(rand, 1, 4);
      for (let j = 0; j < n; j++) {
        const p = U.pick(rand, db.products);
        const qty = U.randInt(rand, 5, 80);
        const price = Math.round(p.cost * (0.9 + rand() * 0.3));
        items.push({ productId: p.id, name: p.name, unit: p.unit, qty: qty, price: price, sum: qty * price });
      }
      const amount = U.sum(items, function (x) { return x.sum; });
      db.purchaseOrders.push({
        id: 'pos-' + (i + 1), companyId: 'co-1',
        number: 'ЗП-' + U.pad(i + 1), date: d, supplierId: sup.id,
        items: items, amount: amount,
        deliveryDate: U.iso(U.addDays(new Date(d), U.randInt(rand, 3, 21))),
        status: U.pick(rand, ['new', 'sent', 'received', 'received', 'cancelled']),
        paid: rand() > 0.4 ? amount : 0,
        manager: U.pick(rand, ['Токтоназаров Азиз', 'Касымова Аида'])
      });
    }

    /* --- Движения товара и инвентаризация ---------------------------------------------- */
    db.stockMoves = [];
    for (let i = 0; i < 120; i++) {
      const p = U.pick(rand, db.products);
      const type = U.pick(rand, ['in', 'out', 'out', 'move', 'writeoff']);
      const qty = U.randInt(rand, 1, 40);
      db.stockMoves.push({
        id: 'mov-' + (i + 1), companyId: 'co-1',
        number: 'ДВ-' + U.pad(i + 1), date: daysAgo(U.randInt(rand, 0, 200)),
        type: type, productId: p.id, productName: p.name, unit: p.unit, qty: qty,
        fromWarehouseId: type === 'in' ? null : 'wh-1',
        toWarehouseId: type === 'in' ? 'wh-1' : (type === 'move' ? 'wh-2' : null),
        price: type === 'in' ? p.cost : p.price,
        amount: qty * (type === 'in' ? p.cost : p.price),
        reason: type === 'writeoff' ? U.pick(rand, ['Брак', 'Истёк срок', 'Порча при хранении']) : '',
        author: U.pick(rand, ['Исаков Бекболот', 'Бекова Динара'])
      });
    }

    db.inventories = [];
    for (let i = 0; i < 5; i++) {
      const lines = [];
      for (let j = 0; j < 6; j++) {
        const p = U.pick(rand, db.products);
        const acc = U.randInt(rand, 5, 90);
        const fact = acc + U.randInt(rand, -4, 3);
        lines.push({ productId: p.id, name: p.name, unit: p.unit, accounted: acc, fact: fact, diff: fact - acc, price: p.cost });
      }
      db.inventories.push({
        id: 'inv-' + (i + 1), companyId: 'co-1',
        number: 'ИНВ-' + U.pad(i + 1), date: daysAgo(U.randInt(rand, 5, 200)),
        warehouseId: U.pick(rand, ['wh-1', 'wh-2']),
        responsible: 'Исаков Бекболот Маратович',
        status: i === 0 ? 'draft' : 'done',
        lines: lines
      });
    }

    /* --- Касса: наличные расчёты по документам --------------------------------------- */
    const cpById = {};
    db.counterparties.forEach(function (c) { cpById[c.id] = c; });
    function cpNameById(id) { return cpById[id] ? cpById[id].name : '—'; }

    db.cashOrders = [];
    const cashPaidSales = {};
    let cashNo = 0;

    db.sales.forEach(function (sale) {
      if (sale.paid <= 0 || sale.amount > 400000 || rand() > 0.35) return;
      cashNo += 1;
      cashPaidSales[sale.id] = true;
      db.cashOrders.push({
        id: 'cor-' + cashNo, companyId: 'co-1', number: 'ПКО-' + U.pad(cashNo), kind: 'in',
        date: U.iso(U.addDays(new Date(sale.date), U.randInt(rand, 0, 5))),
        amount: sale.paid, counterpartyId: sale.counterpartyId,
        person: cpNameById(sale.counterpartyId),
        basis: 'Оплата по документу реализации ' + sale.number,
        cashier: 'Осмонова Айпери Талантбековна', status: 'posted'
      });
    });

    ['Выдача под отчёт', 'Хозяйственные расходы', 'Приобретение канцтоваров',
     'Оплата услуг связи', 'Транспортные расходы', 'Выдача под отчёт'].forEach(function (basis) {
      cashNo += 1;
      db.cashOrders.push({
        id: 'cor-' + cashNo, companyId: 'co-1', number: 'РКО-' + U.pad(cashNo), kind: 'out',
        date: daysAgo(U.randInt(rand, 0, 120)), amount: U.randInt(rand, 5, 60) * 1000,
        counterpartyId: null, person: U.pick(rand, db.employees).fullName, basis: basis,
        cashier: 'Осмонова Айпери Талантбековна', status: 'posted'
      });
    });

    /* --- Банк: безналичные расчёты по документам ------------------------------------- */
    db.payments = [];
    let payNo = 0;

    db.sales.forEach(function (sale) {
      if (sale.paid <= 0 || cashPaidSales[sale.id]) return;
      payNo += 1;
      db.payments.push({
        id: 'pay-' + payNo, companyId: 'co-1', number: 'ПП-' + U.pad(payNo), kind: 'in',
        date: U.iso(U.addDays(new Date(sale.date), U.randInt(rand, 0, 10))),
        counterpartyId: sale.counterpartyId, amount: sale.paid,
        purpose: 'Оплата по документу реализации ' + sale.number + ', в т.ч. НДС 12%',
        account: '1180000012345678', bank: U.pick(rand, BANKS),
        matched: rand() > 0.15, status: 'executed'
      });
    });

    db.purchaseOrders.forEach(function (order) {
      if (order.status === 'cancelled' || order.paid <= 0) return;
      payNo += 1;
      db.payments.push({
        id: 'pay-' + payNo, companyId: 'co-1', number: 'ПП-' + U.pad(payNo), kind: 'out',
        date: U.iso(U.addDays(new Date(order.date), U.randInt(rand, 1, 14))),
        counterpartyId: order.supplierId, amount: order.paid,
        purpose: 'Оплата поставщику по заказу ' + order.number + ', в т.ч. НДС 12%',
        account: '1180000012345678', bank: U.pick(rand, BANKS),
        matched: true, status: 'executed'
      });
    });

    for (let i = 0; i < 6; i++) {
      payNo += 1;
      db.payments.push({
        id: 'pay-' + payNo, companyId: 'co-1', number: 'ПП-' + U.pad(payNo), kind: 'out',
        date: daysAgo(U.randInt(rand, 0, 10)), counterpartyId: U.pick(rand, suppliers).id,
        amount: U.randInt(rand, 20, 400) * 1000,
        purpose: 'Предоплата поставщику по договору, в т.ч. НДС 12%',
        account: '1180000012345678', bank: U.pick(rand, BANKS),
        matched: false, status: 'new'
      });
    }

    db.bankStatements = [];
    for (let i = 0; i < 6; i++) {
      const d = daysAgo(i * 7 + 1);
      const rows = U.randInt(rand, 8, 26);
      db.bankStatements.push({
        id: 'bst-' + (i + 1), companyId: 'co-1',
        date: d, fileName: 'vypiska_' + d + '.txt', format: '1C-Bank Exchange',
        rowsCount: rows,
        incoming: U.randInt(rand, 200, 3000) * 1000,
        outgoing: U.randInt(rand, 150, 2500) * 1000,
        matched: U.randInt(rand, Math.floor(rows * 0.6), rows),
        status: i === 0 ? 'loaded' : 'processed'
      });
    }

    /* --- Периоды ------------------------------------------------------------------------ */
    db.periods = [];
    U.lastMonths(14).forEach(function (m, i, arr) {
      db.periods.push({
        id: 'per-' + m.key, companyId: 'co-1',
        year: m.year, month: m.month, key: m.key,
        name: U.MONTHS_NOM[m.month] + ' ' + m.year,
        closed: i < arr.length - 2,
        closedBy: i < arr.length - 2 ? 'Кадырова Н. А.' : null,
        closedAt: i < arr.length - 2 ? daysAgo((arr.length - i) * 30 - 5) : null,
        revenue: U.randInt(rand, 900, 4200) * 1000,
        expense: U.randInt(rand, 600, 3200) * 1000
      });
    });

    /* --- Налоги ---------------------------------------------------------------------------- */
    const TAXES = [
      ['НДС', 12, 'Ежемесячно'], ['Налог с продаж', 2, 'Ежемесячно'], ['Налог на прибыль', 10, 'Ежеквартально'],
      ['Подоходный налог', 10, 'Ежемесячно'], ['Соцфонд', 27.25, 'Ежемесячно']
    ];
    /* --- Внутренние заявки ---------------------------------------------------------------- */
    const REQ_TYPES = [
      ['purchase', 'Покупка'], ['payment', 'Оплата'], ['cash', 'Выдача денег'],
      ['document', 'Создание документа'], ['repair', 'Ремонт'], ['supply', 'Закупка']
    ];
    db.requests = [];
    for (let i = 0; i < 30; i++) {
      const t = REQ_TYPES[i % REQ_TYPES.length];
      const d = daysAgo(U.randInt(rand, 0, 70));
      const st = i < 5 ? 'review' : U.pick(rand, ['new', 'review', 'approved', 'done', 'rejected']);
      db.requests.push({
        id: 'req-' + (i + 1), companyId: 'co-1',
        number: 'ЗВ-' + U.pad(i + 1), date: d,
        type: t[0], typeName: t[1],
        subject: U.pick(rand, ['Закупка канцтоваров для офиса', 'Оплата счёта поставщику', 'Выдача денег под отчёт',
          'Ремонт принтера в бухгалтерии', 'Подготовка договора с клиентом', 'Закупка воды и хозтоваров']),
        amount: t[0] === 'document' ? 0 : U.randInt(rand, 2, 150) * 1000,
        author: U.pick(rand, db.employees).fullName,
        department: U.pick(rand, DEPARTMENTS),
        status: st,
        priority: U.pick(rand, ['low', 'normal', 'normal', 'high']),
        route: buildRoute(rand, st, d),
        comment: ''
      });
    }

    /* --- CRM ------------------------------------------------------------------------------- */
    const STAGES = ['new', 'contact', 'offer', 'negotiation', 'won', 'lost'];
    db.deals = [];
    for (let i = 0; i < 26; i++) {
      const cp = U.pick(rand, clients);
      const stage = i < 4 ? 'new' : U.pick(rand, STAGES);
      const d = daysAgo(U.randInt(rand, 0, 120));
      db.deals.push({
        id: 'del-' + (i + 1), companyId: 'co-1',
        title: U.pick(rand, ['Поставка оргтехники', 'Оснащение офиса мебелью', 'Годовой контракт на канцтовары',
          'Поставка стройматериалов', 'Обслуживание техники', 'Разовая крупная закупка']) + ' — ' + cp.name.replace(/ОсОО |ИП |ЗАО /, ''),
        counterpartyId: cp.id, stage: stage,
        amount: U.randInt(rand, 30, 1800) * 1000,
        probability: { new: 10, contact: 25, offer: 50, negotiation: 75, won: 100, lost: 0 }[stage],
        manager: U.pick(rand, ['Мамытов Азамат', 'Бекова Динара', 'Раимбеков Санжар']),
        createdAt: new Date(d).toISOString(), date: d,
        nextStep: U.pick(rand, ['Позвонить клиенту', 'Отправить КП', 'Согласовать договор', 'Выставить счёт', 'Встреча в офисе']),
        nextDate: daysFwd(U.randInt(rand, -3, 20)),
        activities: [
          { ts: new Date(d).toISOString(), type: 'call', text: 'Первичный звонок, выявлена потребность' },
          { ts: new Date(new Date(d).getTime() + 86400000).toISOString(), type: 'email', text: 'Отправлено коммерческое предложение' }
        ]
      });
    }

    db.tasks = [];
    for (let i = 0; i < 22; i++) {
      const due = daysFwd(U.randInt(rand, -6, 18));
      db.tasks.push({
        id: 'tsk-' + (i + 1), companyId: 'co-1',
        title: U.pick(rand, ['Позвонить клиенту по счёту', 'Подготовить акт сверки', 'Проверить оплату',
          'Отправить документы на подпись', 'Согласовать цену с поставщиком', 'Провести инвентаризацию секции']),
        dealId: rand() > 0.5 ? 'del-' + U.randInt(rand, 1, 26) : null,
        assignee: U.pick(rand, db.users).fullName,
        dueDate: due,
        priority: U.pick(rand, ['low', 'normal', 'high']),
        status: U.daysLeft(due) < 0 && rand() > 0.5 ? 'done' : U.pick(rand, ['new', 'progress', 'done'])
      });
    }

    /* --- Зарплата и табель ------------------------------------------------------------------- */
    db.payrolls = [];
    U.lastMonths(3).forEach(function (m, mi) {
      db.employees.forEach(function (e, ei) {
        const bonus = rand() > 0.6 ? U.randInt(rand, 2, 15) * 1000 : 0;
        const base = e.salary;
        const gross = base + bonus;
        const incomeTax = Math.round(gross * 0.1);
        const social = Math.round(gross * 0.1);
        db.payrolls.push({
          id: 'prl-' + m.key + '-' + e.id, companyId: e.companyId,
          periodKey: m.key, period: U.MONTHS_NOM[m.month] + ' ' + m.year,
          employeeId: e.id, employeeName: e.fullName, position: e.position,
          base: base, bonus: bonus, gross: gross,
          incomeTax: incomeTax, social: social,
          net: gross - incomeTax - social,
          status: mi < 2 ? 'paid' : 'calculated',
          paidAt: mi < 2 ? U.iso(new Date(m.year, m.month + 1, 5)) : null
        });
      });
    });

    /* --- Налоги: база берётся из продаж и фонда оплаты труда --------------------------- */
    db.taxes = [];
    const revenueBy = {}, vatBy = {};
    db.sales.forEach(function (sale) {
      const key = U.ym(sale.date);
      revenueBy[key] = (revenueBy[key] || 0) + sale.amount;
      vatBy[key] = (vatBy[key] || 0) + sale.vat;
    });

    U.lastMonths(6).forEach(function (m) {
      const revenue = revenueBy[m.key] || 0;
      const fot = U.sum(db.payrolls.filter(function (r) { return r.periodKey === m.key; }),
        function (r) { return r.gross; });
      const incomeTax = U.sum(db.payrolls.filter(function (r) { return r.periodKey === m.key; }),
        function (r) { return r.incomeTax; });
      const social = U.sum(db.payrolls.filter(function (r) { return r.periodKey === m.key; }),
        function (r) { return r.social; });
      const profitBase = (m.month + 1) % 3 === 0 ? revenue * (1 - COST_RATIO) : 0;
      const due = U.iso(new Date(m.year, m.month + 1, 20));
      const isPast = U.daysLeft(due) < 0;

      [
        ['НДС', 12, 'Ежемесячно', revenue, vatBy[m.key] || 0],
        ['Налог с продаж', 2, 'Ежемесячно', revenue, Math.round(revenue * 0.02)],
        ['Налог на прибыль', 10, 'Ежеквартально', profitBase, Math.round(profitBase * 0.1)],
        ['Подоходный налог', 10, 'Ежемесячно', fot, incomeTax],
        ['Соцфонд', 10, 'Ежемесячно', fot, social]
      ].forEach(function (t, ti) {
        if (t[4] <= 0) return;
        db.taxes.push({
          id: 'tax-' + m.key + '-' + ti, companyId: 'co-1',
          name: t[0], rate: t[1], periodKey: m.key,
          period: U.MONTHS_NOM[m.month] + ' ' + m.year,
          frequency: t[2], base: Math.round(t[3]), amount: Math.round(t[4]),
          dueDate: due,
          status: isPast ? (rand() > 0.12 ? 'paid' : 'overdue') : 'planned',
          declaration: isPast ? 'Сдана' : 'Не сдана'
        });
      });
    });

    /* --- Банк: зарплата на карты и уплата налогов ------------------------------------- */
    const paidPeriods = {};
    db.payrolls.filter(function (r) { return r.status === 'paid'; }).forEach(function (r) {
      const key = r.period + '|' + r.paidAt;
      paidPeriods[key] = (paidPeriods[key] || 0) + r.net;
    });
    Object.keys(paidPeriods).forEach(function (key) {
      payNo += 1;
      const parts = key.split('|');
      db.payments.push({
        id: 'pay-' + payNo, companyId: 'co-1', number: 'ПП-' + U.pad(payNo), kind: 'out',
        date: parts[1], counterpartyId: null, amount: Math.round(paidPeriods[key]),
        purpose: 'Выплата заработной платы за ' + parts[0],
        account: '1180000012345678', bank: BANKS[0], matched: true, status: 'executed'
      });
    });

    db.taxes.filter(function (t) { return t.status === 'paid'; }).forEach(function (tax) {
      payNo += 1;
      db.payments.push({
        id: 'pay-' + payNo, companyId: 'co-1', number: 'ПП-' + U.pad(payNo), kind: 'out',
        date: tax.dueDate, counterpartyId: null, amount: tax.amount,
        purpose: 'Уплата: ' + tax.name + ' за ' + tax.period,
        account: '1180000012345678', bank: BANKS[0], matched: true, status: 'executed'
      });
    });

    /* --- Проводки: формируются автоматически из документов (ТЗ п. 3.3) ------------------
       Каждая операция разносится по двойной записи, поэтому оборотно-сальдовая
       ведомость, баланс и отчёт о прибылях и убытках строятся на тех же данных,
       что видит пользователь в журналах документов. */
    db.entries = [];

    const TAX_ACCOUNTS = [
      ['ндс', '68.1'], ['с продаж', '68'], ['прибыл', '68.2'],
      ['подоходн', '68.4'], ['соцфонд', '69']
    ];
    const TAX_ACCRUAL = { 'ндс': ['90.1', '68.1'], 'с продаж': ['90.1', '68'], 'прибыл': ['99', '68.2'] };

    function addEntry(date, debit, credit, amount, content) {
      amount = Math.round(Number(amount) || 0);
      if (amount <= 0) return;
      const n = db.entries.length + 1;
      db.entries.push({
        id: 'ent-' + n, companyId: 'co-1', number: U.pad(n), date: date,
        debit: debit, credit: credit, amount: amount, content: content,
        docId: null, author: 'Система (авто)', auto: true, posted: true
      });
    }

    function periodEnd(key) {
      const year = Number(key.slice(0, 4)), month = Number(key.slice(5, 7));
      return U.iso(new Date(year, month, 0));
    }

    // Реализация: выручка и списание себестоимости
    U.sortBy(db.sales, function (x) { return x.date; }, 'asc').forEach(function (sale) {
      addEntry(sale.date, '62.1', '90.1', sale.amount, 'Реализация по документу ' + sale.number);
      addEntry(sale.date, '90.2', '41.1', sale.amount * COST_RATIO,
        'Списана себестоимость по документу ' + sale.number);
    });

    // Начисление налогов в последний день периода
    db.taxes.forEach(function (tax) {
      const name = U.norm(tax.name);
      const marker = Object.keys(TAX_ACCRUAL).filter(function (k) { return name.indexOf(k) > -1; })[0];
      if (!marker) return;
      const rule = TAX_ACCRUAL[marker];
      addEntry(periodEnd(tax.periodKey), rule[0], rule[1], tax.amount,
        'Начислен налог: ' + tax.name + ' за ' + tax.period);
    });

    // Поступление товара от поставщика
    U.sortBy(db.purchaseOrders, function (x) { return x.date; }, 'asc').forEach(function (order) {
      if (order.status === 'cancelled') return;
      addEntry(order.date, '41.1', '60.1', order.amount,
        'Оприходование товара по заказу ' + order.number);
    });

    // Касса
    U.sortBy(db.cashOrders, function (x) { return x.date; }, 'asc').forEach(function (order) {
      if (order.kind === 'in') {
        addEntry(order.date, '50.1', '62.1', order.amount, 'Приход в кассу по ордеру ' + order.number);
        return;
      }
      const basis = U.norm(order.basis);
      const debit = basis.indexOf('подотчет') > -1 ? '71'
        : (basis.indexOf('зарплат') > -1 ? '70' : '26');
      addEntry(order.date, debit, '50.1', order.amount, 'Расход из кассы по ордеру ' + order.number);
    });

    // Банк
    U.sortBy(db.payments, function (x) { return x.date; }, 'asc').forEach(function (payment) {
      if (payment.status !== 'executed') return;
      const purpose = U.norm(payment.purpose);
      if (payment.kind === 'in') {
        addEntry(payment.date, '51', '62.1', payment.amount,
          'Поступление на расчётный счёт по платежу ' + payment.number);
      } else if (purpose.indexOf('заработной платы') > -1) {
        addEntry(payment.date, '70', '51', payment.amount,
          'Перечислена зарплата, платёж ' + payment.number);
      } else if (purpose.indexOf('уплата:') === 0) {
        const rule = TAX_ACCOUNTS.filter(function (r) { return purpose.indexOf(r[0]) > -1; })[0];
        addEntry(payment.date, rule ? rule[1] : '68', '51', payment.amount,
          'Уплата в бюджет, платёж ' + payment.number);
      } else {
        addEntry(payment.date, '60.1', '51', payment.amount,
          'Оплата поставщику по платежу ' + payment.number);
      }
    });

    // Зарплата: начисление и удержания
    db.payrolls.forEach(function (payroll) {
      const day = payroll.paidAt || periodEnd(payroll.periodKey);
      addEntry(day, '26', '70', payroll.gross, 'Начислена зарплата: ' + payroll.employeeName);
      addEntry(day, '70', '68.4', payroll.incomeTax, 'Удержан подоходный налог: ' + payroll.employeeName);
      addEntry(day, '26', '69', payroll.social, 'Отчисления в соцфонд: ' + payroll.employeeName);
    });

    /* --- Амортизация основных средств --------------------------------------
       Начисляется теми же формулами, что и в интерфейсе (App.Depreciation),
       поэтому демо-данные и живой расчёт не расходятся.

       Система «внедрена» год назад: начисления за последние 12 месяцев лежат
       в журнале с проводками, а всё, что накоплено раньше, переносится во
       входящее сальдо счёта 02 — так делают при переходе с прежней учётной
       системы, и журнал не раздувается сотнями исторических строк. */
    const D = App.Depreciation;
    const JOURNAL_FROM = U.ym(U.addMonths(new Date(), -11));

    db.depreciations = [];
    let openingWear = 0;

    db.fixedAssets.forEach(function (asset) {
      // Материально ответственный назначается здесь: сотрудники создаются
      // позже плана счетов, а объекты — сразу после него
      asset.responsible = U.pick(rand, db.employees).fullName;

      const start = new Date(asset.commissionedAt);
      const today = new Date();
      let step = 1;

      while (true) {
        const day = new Date(start.getFullYear(), start.getMonth() + step + 1, 0);
        if (day > today) break;
        const iso = U.iso(day);
        if (!D.isAccruable(asset, iso)) break;

        const units = D.plannedUnits(asset);
        const amount = D.monthlyAmount(asset, iso, { units: units });
        if (amount <= 0) break;

        asset.accumulated = D.money(asset.accumulated + amount);
        if (units) asset.usedUnits = D.money(asset.usedUnits + units);

        const key = U.ym(iso);
        if (key < JOURNAL_FROM) {
          openingWear += amount;                 // перенесённый остаток
        } else {
          addEntry(iso, asset.expenseAccount, asset.depreciationAccount, amount,
            'Начислена амортизация: ' + asset.name + ' (' + D.periodLabel(key) + ')');
          db.depreciations.push({
            id: 'dep-' + (db.depreciations.length + 1),
            companyId: 'co-1',
            assetId: asset.id, assetName: asset.name,
            periodKey: key, period: D.periodLabel(key), date: iso,
            method: asset.method, amount: amount, units: units || 0,
            accumulatedAfter: asset.accumulated,
            residualAfter: D.money(asset.initialCost - asset.accumulated),
            entryId: null, posted: true, author: 'Система (авто)'
          });
        }
        step++;
      }
    });

    /* Входящее сальдо по основным средствам: объекты стоят на балансе с
       начала учёта, поэтому счета 01 и 02 берут суммы из реестра, а разница
       уходит в нераспределённую прибыль — иначе актив не сойдётся с пассивом. */
    (function balanceFixedAssets() {
      const cost = U.sum(db.fixedAssets, function (a) { return a.initialCost; });
      const wear = U.round(openingWear, 2);
      const account = function (code) {
        return db.accounts.filter(function (a) { return a.code === code; })[0];
      };
      const assets01 = account('01'), wear02 = account('02'), profit84 = account('84');
      if (!assets01 || !wear02 || !profit84) return;

      profit84.opening += (cost - assets01.opening) - (wear - wear02.opening);
      assets01.opening = cost;
      wear02.opening = wear;
    })();

    db.timesheets = [];
    db.employees.forEach(function (e) {
      for (let d = 0; d < 22; d++) {
        const day = U.addDays(now, -d);
        if (day.getDay() === 0 || day.getDay() === 6) continue;
        const type = e.status === 'vacation' && d < 8 ? 'vacation' : (e.status === 'sick' && d < 4 ? 'sick' : 'work');
        db.timesheets.push({
          id: 'tim-' + e.id + '-' + d, companyId: e.companyId,
          employeeId: e.id, employeeName: e.fullName,
          date: U.iso(day), type: type,
          hours: type === 'work' ? (rand() > 0.85 ? 9 : 8) : 0
        });
      }
    });

    /* --- Бюджет -------------------------------------------------------------------------------- */
    db.budgets = [];
    U.lastMonths(6).forEach(function (m) {
      INCOME_ITEMS.forEach(function (item, i) {
        const plan = U.randInt(rand, 200, 2200) * 1000;
        db.budgets.push({
          id: 'bdg-i-' + m.key + '-' + i, companyId: 'co-1',
          periodKey: m.key, period: U.MONTHS_NOM[m.month] + ' ' + m.year,
          kind: 'income', item: item,
          plan: plan, fact: Math.round(plan * (0.7 + rand() * 0.6))
        });
      });
      EXPENSE_ITEMS.forEach(function (item, i) {
        const plan = U.randInt(rand, 40, 700) * 1000;
        db.budgets.push({
          id: 'bdg-e-' + m.key + '-' + i, companyId: 'co-1',
          periodKey: m.key, period: U.MONTHS_NOM[m.month] + ' ' + m.year,
          kind: 'expense', item: item,
          plan: plan, fact: Math.round(plan * (0.75 + rand() * 0.55))
        });
      });
    });

    /* --- ЭЦП ------------------------------------------------------------------------------------ */
    db.signatures = [];
    db.documents.filter(function (d) { return d.signed; }).forEach(function (d, i) {
      db.signatures.push({
        id: 'sig-' + (i + 1), companyId: 'co-1',
        docId: d.id, docNumber: d.number, docType: d.typeName,
        signer: U.pick(rand, ['Абдыразаков Т. Р.', 'Кадырова Н. А.']),
        cert: 'KG-CERT-' + U.randInt(rand, 100000, 999999),
        issuer: 'ГП «Инфоком» — Центр сертификации КР',
        validUntil: daysFwd(U.randInt(rand, 30, 500)),
        ts: new Date(new Date(d.date).getTime() + 7200000).toISOString(),
        algorithm: 'ГОСТ Р 34.10-2012',
        valid: rand() > 0.06
      });
    });

    /* --- Интеграции ----------------------------------------------------------------------------- */
    db.integrations = [
      { id: 'int-1', name: 'Банк-клиент (Оптима Банк)', kind: 'bank', status: 'connected', lastSync: new Date(now - 3600000).toISOString(), description: 'Импорт выписок 1C-Bank Exchange, отправка платёжных поручений' },
      { id: 'int-2', name: 'ЭЦП — Инфоком', kind: 'esign', status: 'connected', lastSync: new Date(now - 86400000).toISOString(), description: 'Подписание и проверка подписи документов' },
      { id: 'int-3', name: 'Excel / CSV', kind: 'file', status: 'connected', lastSync: new Date(now - 7200000).toISOString(), description: 'Импорт и экспорт справочников и отчётов' },
      { id: 'int-4', name: 'Telegram-бот уведомлений', kind: 'notify', status: 'connected', lastSync: new Date(now - 1800000).toISOString(), description: 'Оповещения о платежах, заявках, согласованиях' },
      { id: 'int-5', name: 'Email (SMTP)', kind: 'notify', status: 'connected', lastSync: new Date(now - 5400000).toISOString(), description: 'Рассылка документов и напоминаний' },
      { id: 'int-6', name: 'SMS-шлюз', kind: 'notify', status: 'disabled', lastSync: null, description: 'Критичные оповещения по SMS' },
      { id: 'int-7', name: 'Кассовое оборудование (ККМ)', kind: 'device', status: 'connected', lastSync: new Date(now - 600000).toISOString(), description: 'Фискальный регистратор, печать чеков' },
      { id: 'int-8', name: 'Сканеры штрихкодов', kind: 'device', status: 'connected', lastSync: new Date(now - 900000).toISOString(), description: 'Приём/отгрузка и инвентаризация по штрихкоду' },
      { id: 'int-9', name: 'Внешний API (REST)', kind: 'api', status: 'connected', lastSync: new Date(now - 300000).toISOString(), description: 'JWT-токены, обмен данными с внешними системами' },
      { id: 'int-10', name: 'Налоговая отчётность (ГНС)', kind: 'gov', status: 'pending', lastSync: null, description: 'Отправка деклараций в электронном виде' },
      { id: 'int-11', name: 'Электронные счета-фактуры (ЭСФ)', kind: 'gov', status: 'connected', lastSync: new Date(now - 3600000).toISOString(), description: 'Выписка и приём счетов-фактур в электронном виде' },
      { id: 'int-12', name: 'CRM (внешняя система продаж)', kind: 'api', status: 'connected', lastSync: new Date(now - 7200000).toISOString(), description: 'Синхронизация клиентов, сделок и заявок' }
    ];

    /* --- Уведомления --------------------------------------------------------------------------- */
    db.notifications = [
      { id: 'ntf-1', kind: 'danger', icon: 'alert', title: 'Просроченный платёж', text: 'ОсОО «Дордой Оптима» — 340 000 сом, просрочка 12 дней', ts: new Date(now - 1200000).toISOString(), read: false, link: '#/debts' },
      { id: 'ntf-2', kind: 'info', icon: 'clipboard', title: 'Документы на согласование', text: '6 документов ожидают вашего решения', ts: new Date(now - 5400000).toISOString(), read: false, link: '#/approvals' },
      { id: 'ntf-3', kind: 'warn', icon: 'contract', title: 'Заканчивается договор', text: 'Д-2025/07 с ОсОО «Ала-Тоо Фуд» истекает через 9 дней', ts: new Date(now - 9000000).toISOString(), read: false, link: '#/contracts' },
      { id: 'ntf-4', kind: 'info', icon: 'bank', title: 'Загружена выписка банка', text: 'Обработано 18 операций, сопоставлено 15', ts: new Date(now - 18000000).toISOString(), read: true, link: '#/bank' },
      { id: 'ntf-5', kind: 'warn', icon: 'box', title: 'Низкий остаток товара', text: '5 позиций ниже минимального запаса', ts: new Date(now - 36000000).toISOString(), read: true, link: '#/stock-balance' },
      { id: 'ntf-6', kind: 'info', icon: 'percent', title: 'Срок уплаты налога', text: 'НДС за прошлый месяц — до 20 числа', ts: new Date(now - 72000000).toISOString(), read: true, link: '#/taxes' }
    ];

    db.auditLog = [];
    for (let i = 0; i < 60; i++) {
      const u = U.pick(rand, db.users);
      const acts = [['create', 'создал', 'documents', 'Документ'], ['update', 'изменил', 'sales', 'Продажа'],
      ['delete', 'удалил', 'entries', 'Проводка'], ['custom', 'провёл документ', 'documents', 'Документ'],
      ['custom', 'закрыл период', 'periods', 'Период'], ['custom', 'вошёл в систему', '', '']];
      const a = U.pick(rand, acts);
      db.auditLog.push({
        id: 'aud-seed-' + i, ts: new Date(now - U.randInt(rand, 60, 400000) * 1000).toISOString(),
        user: u.fullName, userId: u.id, role: u.role,
        action: a[0], actionText: a[1], entity: a[2], entityTitle: a[3],
        entityId: null, label: a[2] ? '№ ' + U.randInt(rand, 1, 90) : '', details: '',
        companyId: 'co-1', ip: '192.168.1.' + U.randInt(rand, 10, 60)
      });
    }
    db.auditLog = U.sortBy(db.auditLog, function (x) { return x.ts; }, 'desc');

    return db;
  }

  /* --- Вспомогательные ------------------------------------------------------------------------ */
  function makeCounterparty(rand, name, kind, i, daysAgo) {
    return {
      id: 'cp-' + (i + 1), companyId: 'co-1',
      name: name, kind: kind,
      inn: (kind === 'client' ? '015' : '023') + U.randInt(rand, 10000000000, 99999999999),
      address: U.pick(rand, CITIES),
      phone: '+996 3' + U.randInt(rand, 12, 99) + ' ' + U.randInt(rand, 100000, 999999),
      email: 'info@' + ['aktrade', 'bereke', 'nurel', 'tienshan', 'alatoo', 'manas', 'dordoi', 'ecopak'][i % 8] + '.kg',
      contact: U.pick(rand, ['Асанов А.', 'Иванова М.', 'Токтогулов Б.', 'Сыдыкова Г.', 'Петров С.']),
      bank: U.pick(rand, BANKS),
      account: '11' + U.randInt(rand, 80000000000000, 99999999999999),
      bik: '11' + U.randInt(rand, 1000, 9999),
      rating: U.randInt(rand, 2, 5),
      debt: rand() > 0.45 ? U.randInt(rand, 10, 900) * 1000 * (kind === 'client' ? 1 : -1) : 0,
      creditLimit: U.randInt(rand, 100, 1500) * 1000,
      dueDays: U.pick(rand, [7, 14, 14, 30]),
      createdAt: daysAgo(U.randInt(rand, 30, 900)),
      active: true,
      notes: ''
    };
  }

  /** Маршрут согласования: Сотрудник → Бухгалтер → Руководитель */
  function buildRoute(rand, status, date) {
    const base = new Date(date).getTime();
    const steps = [
      { role: 'Сотрудник', name: 'Автор документа', action: 'Создание' },
      { role: 'Бухгалтер', name: 'Турдубаева Ж. С.', action: 'Проверка' },
      { role: 'Руководитель', name: 'Абдыразаков Т. Р.', action: 'Утверждение' }
    ];
    const doneCount = { draft: 1, review: 1, approved: 3, posted: 3, rejected: 2, new: 1, done: 3 }[status] || 1;
    return steps.map(function (s, i) {
      const isRejected = status === 'rejected' && i === doneCount - 1;
      return {
        role: s.role, name: s.name, action: s.action,
        state: isRejected ? 'rejected' : (i < doneCount ? 'done' : (i === doneCount ? 'current' : 'waiting')),
        ts: i < doneCount ? new Date(base + i * 7200000).toISOString() : null,
        comment: isRejected ? 'Неверные реквизиты контрагента, требуется исправление' : ''
      };
    });
  }

  App.Seed = {
    VERSION: VERSION,
    build: build,
    defaultSettings: defaultSettings,
    MODULES: MODULES,
    ROLES: ROLES,
    EXPENSE_ITEMS: EXPENSE_ITEMS,
    INCOME_ITEMS: INCOME_ITEMS,
    POSITIONS: POSITIONS,
    DEPARTMENTS: DEPARTMENTS,
    BANKS: BANKS
  };
})(window.App);

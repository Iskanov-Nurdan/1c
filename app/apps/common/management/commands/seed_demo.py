"""Наполнение базы демонстрационными данными.

    python manage.py seed_demo            # заполнить, если база пуста
    python manage.py seed_demo --reset    # очистить и заполнить заново

Генерация детерминированная (фиксированный seed), поэтому демо-данные
воспроизводимы и о них можно писать в документации.
"""
import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounting.models import Account, Depreciation, Entry, FixedAsset, Period, Tax
from apps.accounting import services as depreciation_service
from apps.accounts.models import MODULES, Role, User
from apps.directories.models import (
    AppSettings, Category, Company, Counterparty, Employee, Integration, Product, Unit, Warehouse,
)
from apps.documents.models import Contract, Document, Signature
from apps.finance.models import BankStatement, Budget, CashOrder, Payment
from apps.hr.models import Payroll, Timesheet
from apps.inventory.models import Inventory, PurchaseOrder, PurchaseRequest, Stock, StockMove
from apps.sales.models import Deal, Return, Sale, Task
from apps.workflow.models import AuditLog, Notification, Request

MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

CLIENT_NAMES = [
    'ОсОО «Ак-Марал Трейд»', 'ОсОО «Береке Логистик»', 'ИП Абдыраимов А.А.', 'ОсОО «Тянь-Шань Строй»',
    'ОсОО «Нур Электро»', 'ЗАО «Кыргыз Пласт»', 'ОсОО «Ала-Тоо Фуд»', 'ИП Сатыбалдиева Н.К.',
    'ОсОО «Манас Мебель»', 'ОсОО «Иссык-Куль Ритейл»', 'ОсОО «Дордой Оптима»', 'ИП Жумабеков Т.М.',
    'ОсОО «Бишкек Техно»', 'ОсОО «Чуй Агро»', 'ОсОО «Ош Маркет»', 'ОсОО «Салам Строй»',
    'ОсОО «Кант Цемент Трейд»', 'ИП Токтогулова А.Б.', 'ОсОО «Жибек Жолу Транс»', 'ОсОО «Эко Пак»',
]
SUPPLIER_NAMES = [
    'ОсОО «Глобал Поставка»', 'ОсОО «Сити Оптторг»', 'ОсОО «Азия Компонент»', 'ОсОО «Про Инструмент»',
    'ОсОО «Каскад Импорт»', 'ОсОО «Стандарт Офис»', 'ОсОО «Техно Снаб»', 'ОсОО «Первая Упаковка»',
    'ОсОО «Мега Дистрибьюшн»', 'ОсОО «Восток Трейдинг»', 'ОсОО «Электро Мир»', 'ОсОО «Гранд Логистика»',
]
EMPLOYEE_NAMES = [
    'Абдыразаков Тимур Русланович', 'Сыдыкова Айгуль Мелисовна', 'Орозбеков Данияр Кубанычбекович',
    'Кадырова Нургуль Асановна', 'Исаков Бекболот Маратович', 'Турдубаева Жылдыз Сапарбековна',
    'Мамытов Азамат Эрланович', 'Осмонова Айпери Талантбековна', 'Джумабаев Улан Асылбекович',
    'Бекова Динара Нурлановна', 'Шамшиев Эрмек Токтосунович', 'Алымкулова Жамиля Бакытовна',
    'Раимбеков Санжар Нурбекович', 'Касымова Аида Маратовна', 'Токтоназаров Азиз Болотович',
]
POSITIONS = [
    'Главный бухгалтер', 'Бухгалтер', 'Кассир', 'Менеджер по продажам', 'Кладовщик',
    'Логист', 'Менеджер по закупкам', 'Директор', 'Юрист', 'HR-менеджер', 'IT-специалист',
]
DEPARTMENTS = ['Бухгалтерия', 'Продажи', 'Склад', 'Закупки', 'Администрация', 'IT']
CITIES = [
    'г. Бишкек, ул. Чуй 128', 'г. Бишкек, ул. Ибраимова 45', 'г. Ош, ул. Ленина 210',
    'г. Кант, ул. Гагарина 12', 'г. Токмок, ул. Джамбула 7', 'г. Каракол, ул. Абдрахманова 33',
]
BANKS = [
    'ОАО «Оптима Банк»', 'ЗАО «Демир Банк»', 'ОАО «РСК Банк»',
    'ОАО «Айыл Банк»', 'ЗАО «Кыргызкоммерцбанк»',
]
PRODUCTS = [
    ('Бумага офисная А4, 80 г/м²', 'Канцтовары', 'пач'), ('Ручка шариковая синяя', 'Канцтовары', 'шт'),
    ('Папка-регистратор 75 мм', 'Канцтовары', 'шт'), ('Степлер №24', 'Канцтовары', 'шт'),
    ('Картридж лазерный CF283A', 'Расходники', 'шт'), ('Тонер универсальный, 1 кг', 'Расходники', 'кг'),
    ('Кабель UTP cat.5e', 'Электрика', 'м'), ('Розетка настенная 16А', 'Электрика', 'шт'),
    ('Лампа LED 12 Вт E27', 'Электрика', 'шт'), ('Удлинитель 5 м, 5 гнёзд', 'Электрика', 'шт'),
    ('Ноутбук 15.6" i5/8/512', 'Техника', 'шт'), ('Монитор 24" IPS', 'Техника', 'шт'),
    ('Клавиатура USB', 'Техника', 'шт'), ('Мышь беспроводная', 'Техника', 'шт'),
    ('МФУ лазерное A4', 'Техника', 'шт'), ('ИБП 650 ВА', 'Техника', 'шт'),
    ('Стол офисный 120х70', 'Мебель', 'шт'), ('Кресло офисное', 'Мебель', 'шт'),
    ('Шкаф для документов', 'Мебель', 'шт'), ('Тумба выкатная', 'Мебель', 'шт'),
    ('Вода питьевая 19 л', 'Хозтовары', 'шт'), ('Средство чистящее 1 л', 'Хозтовары', 'шт'),
    ('Перчатки рабочие', 'Хозтовары', 'пар'), ('Мешки для мусора 120 л', 'Хозтовары', 'уп'),
    ('Коробка картонная 400х300', 'Упаковка', 'шт'), ('Скотч упаковочный 50 мм', 'Упаковка', 'шт'),
    ('Стрейч-плёнка 2 кг', 'Упаковка', 'рул'), ('Этикетки самоклеящиеся', 'Упаковка', 'уп'),
    ('Цемент М400, 50 кг', 'Стройматериалы', 'меш'), ('Профиль ПН 50х40', 'Стройматериалы', 'шт'),
    ('Гипсокартон 12.5 мм', 'Стройматериалы', 'лист'), ('Саморезы 3.5х25, 1000 шт', 'Стройматериалы', 'уп'),
]
ACCOUNTS = [
    ('01', 'Основные средства', 'A'), ('02', 'Амортизация основных средств', 'P'),
    ('04', 'Нематериальные активы', 'A'), ('10', 'Материалы', 'A'),
    ('20', 'Основное производство', 'A'), ('26', 'Общехозяйственные расходы', 'A'),
    ('41', 'Товары', 'A'), ('41.1', 'Товары на складе', 'A'), ('41.2', 'Товары в рознице', 'A'),
    ('43', 'Готовая продукция', 'A'), ('44', 'Расходы на продажу', 'A'),
    ('50', 'Касса', 'A'), ('50.1', 'Касса организации', 'A'),
    ('51', 'Расчётные счета', 'A'), ('52', 'Валютные счета', 'A'),
    ('60', 'Расчёты с поставщиками', 'AP'), ('60.1', 'Расчёты с поставщиками (сом)', 'AP'),
    ('62', 'Расчёты с покупателями', 'AP'), ('62.1', 'Расчёты с покупателями (сом)', 'AP'),
    ('66', 'Краткосрочные кредиты', 'P'), ('68', 'Расчёты по налогам и сборам', 'AP'),
    ('68.1', 'НДС', 'AP'), ('68.2', 'Налог на прибыль', 'AP'), ('68.4', 'Подоходный налог', 'AP'),
    ('69', 'Расчёты по соцстрахованию', 'P'), ('70', 'Расчёты с персоналом по оплате труда', 'P'),
    ('71', 'Расчёты с подотчётными лицами', 'AP'), ('76', 'Расчёты с прочими дебиторами', 'AP'),
    ('80', 'Уставный капитал', 'P'), ('84', 'Нераспределённая прибыль', 'P'),
    ('90', 'Продажи', 'AP'), ('90.1', 'Выручка', 'P'), ('90.2', 'Себестоимость продаж', 'A'),
    ('91', 'Прочие доходы и расходы', 'AP'), ('99', 'Прибыли и убытки', 'AP'),
]
#: Входящее сальдо на начало учёта: актив (9 750 000) = пассив (9 750 000).
OPENING_BALANCES = {
    '01': 4_500_000, '02': 900_000, '41.1': 80_000_000, '50.1': 150_000, '51': 2_800_000,
    '80': 20_000_000, '84': 66_550_000,
}

#: Счёт расчётов по каждому налогу — определяется по назначению платежа.
TAX_ACCOUNTS = {
    'ндс': '68.1', 'с продаж': '68', 'прибыл': '68.2',
    'подоходн': '68.4', 'соцфонд': '69',
}

#: Налоги, начисляемые отдельной проводкой. Подоходный и соцфонд начисляются
#: при расчёте зарплаты, поэтому здесь их нет — иначе обязательство удвоится.
TAX_ACCRUAL = {
    'ндс': ('90.1', '68.1'), 'с продаж': ('90.1', '68'), 'прибыл': ('99', '68.2'),
}

#: Доля себестоимости в цене реализации — используется при разноске продаж.
COST_RATIO = 0.7

ENTRY_TEMPLATES = [
    ('62.1', '90.1', 'Реализация товаров покупателю'),
    ('90.2', '41.1', 'Списана себестоимость проданных товаров'),
    ('51', '62.1', 'Поступление оплаты от покупателя'),
    ('41.1', '60.1', 'Оприходование товара от поставщика'),
    ('60.1', '51', 'Оплата поставщику с расчётного счёта'),
    ('50.1', '62.1', 'Оплата от покупателя в кассу'),
    ('26', '60.1', 'Услуги сторонних организаций'),
    ('70', '50.1', 'Выплата заработной платы'),
    ('26', '70', 'Начислена заработная плата'),
    ('68.1', '51', 'Уплата НДС в бюджет'),
    ('90.1', '68.1', 'Начислен НДС с реализации'),
    ('71', '50.1', 'Выдано под отчёт'),
]
DOC_TYPES = [
    ('invoice', 'Счёт на оплату'), ('waybill', 'Накладная'), ('act', 'Акт выполненных работ'),
    ('contract', 'Договор'), ('payment', 'Платёжный документ'), ('cash_order', 'Кассовый ордер'),
    ('vat_invoice', 'Счёт-фактура'), ('poa', 'Доверенность'),
    ('statement', 'Банковская выписка'), ('hr', 'Кадровый документ'),
]
EXPENSE_ITEMS = [
    'Аренда офиса', 'Коммунальные услуги', 'Заработная плата', 'Налоги и сборы',
    'Реклама и маркетинг', 'Транспорт и ГСМ', 'Связь и интернет', 'Канцтовары',
    'Обслуживание техники', 'Прочие расходы',
]
INCOME_ITEMS = ['Выручка от продаж', 'Услуги', 'Аренда', 'Прочие доходы']

# Основные средства: наименование, группа, метод, стоимость, ликвидационная,
# СПИ в месяцах, счёт затрат, местонахождение, плановая выработка, ед. выработки
FIXED_ASSETS = [
    ('Административное здание, ул. Чуй 128', 'building', 'straight',
     18_000_000, 1_800_000, 480, '26', 'г. Бишкек, ул. Чуй 128', 0, ''),
    ('Складской комплекс, 1 200 м²', 'building', 'straight',
     9_400_000, 940_000, 360, '20', 'г. Бишкек, ул. Ибраимова 45', 0, ''),
    ('Грузовой автомобиль Hyundai HD-78', 'vehicle', 'declining',
     2_450_000, 245_000, 84, '20', 'Автопарк', 0, ''),
    ('Автомобиль Toyota Camry (директор)', 'vehicle', 'declining',
     3_100_000, 465_000, 84, '26', 'Администрация', 0, ''),
    ('Погрузчик вилочный 1,5 т', 'machine', 'units',
     1_280_000, 128_000, 120, '20', 'Склад №1', 12_000, 'моточас'),
    ('Линия фасовки полуавтоматическая', 'machine', 'sumYears',
     2_760_000, 276_000, 96, '20', 'Цех', 0, ''),
    ('Серверная стойка с ИБП', 'computer', 'straight',
     980_000, 98_000, 60, '26', 'Серверная', 0, ''),
    ('Комплект рабочих станций, 12 шт.', 'computer', 'straight',
     720_000, 72_000, 48, '26', 'Офис', 0, ''),
    ('Мебель офисная (кабинеты 1–4)', 'furniture', 'straight',
     540_000, 54_000, 84, '26', 'Офис', 0, ''),
    ('Стеллажи складские паллетные', 'furniture', 'straight',
     860_000, 86_000, 120, '20', 'Склад №1', 0, ''),
    ('Кондиционеры торгового зала, 6 шт.', 'other', 'straight',
     460_000, 46_000, 72, '44', 'Торговый зал', 0, ''),
    ('Витрины и торговое оборудование', 'other', 'straight',
     680_000, 68_000, 84, '44', 'Торговый зал', 0, ''),
]

ROLES = [
    ('admin', 'Администратор системы', 'Полный доступ, управление пользователями и резервным копированием',
     MODULES, []),
    ('chief', 'Главный бухгалтер', 'Вся бухгалтерия, проверка операций, закрытие периодов, отчётность',
     MODULES, ['admin']),
    ('accountant', 'Бухгалтер', 'Создание документов, проведение операций, работа с контрагентами',
     ['dashboard', 'documents', 'contracts', 'approvals', 'accounting', 'assets', 'taxes',
      'validation', 'cash', 'bank', 'payments', 'counterparties', 'debts', 'reports',
      'requests', 'notifications', 'ai', 'esign'],
     ['taxes']),
    ('cashier', 'Кассир', 'Касса: приём и выдача денег, кассовые документы',
     ['dashboard', 'cash', 'payments', 'counterparties', 'documents', 'requests', 'notifications'],
     ['documents', 'counterparties']),
    ('manager', 'Менеджер', 'Клиенты, продажи, заявки, сделки CRM',
     ['dashboard', 'sales', 'crm', 'counterparties', 'warehouse', 'documents',
      'requests', 'notifications', 'debts', 'ai'],
     ['warehouse', 'debts']),
    ('director', 'Руководитель', 'Аналитика, утверждение документов, контроль финансов',
     MODULES, ['accounting', 'assets', 'warehouse', 'hr', 'admin', 'taxes']),
]

USERS = [
    ('admin', 'Администратор Системы', 'admin', 'admin@company.kg', True),
    ('glavbuh', 'Кадырова Нургуль Асановна', 'chief', 'chief@company.kg', False),
    ('buh', 'Турдубаева Жылдыз Сапарбековна', 'accountant', 'buh@company.kg', False),
    ('kassa', 'Осмонова Айпери Талантбековна', 'cashier', 'cashier@company.kg', False),
    ('manager', 'Мамытов Азамат Эрланович', 'manager', 'sales@company.kg', False),
    ('director', 'Абдыразаков Тимур Русланович', 'director', 'ceo@company.kg', False),
]

MODELS_TO_CLEAR = [
    Depreciation, FixedAsset,
    AuditLog, Notification, Request, Timesheet, Payroll, Task, Deal, Return, Sale,
    PurchaseOrder, PurchaseRequest, Inventory, StockMove, Stock, Signature, Contract, Document,
    Tax, Period, Entry, Account, Budget, BankStatement, Payment, CashOrder,
    Product, Category, Unit, Warehouse, Employee, Counterparty, Integration, AppSettings,
]


def money(value):
    return Decimal(str(round(float(value), 2)))


class Command(BaseCommand):
    help = 'Заполняет базу демонстрационными данными ERP-системы'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='очистить данные перед заполнением')

    @transaction.atomic
    def handle(self, *args, **options):
        self.rnd = random.Random(20260728)
        self.today = date.today()

        if options['reset']:
            self.stdout.write('Очистка данных…')
            for model in MODELS_TO_CLEAR:
                model.objects.all().delete()
            # Демо-логины пересоздаются целиком, включая администратора
            User.objects.filter(login__in=[login for login, *_ in USERS]).delete()
            User.objects.filter(is_superuser=False).delete()
            Role.objects.all().delete()
            Company.objects.all().delete()

        if Company.objects.exists() and not options['reset']:
            self.stdout.write(self.style.WARNING(
                'Данные уже есть. Запустите с --reset, чтобы пересоздать.'
            ))
            return

        self.companies = self._companies()
        self.company = self.companies[0]
        self._settings()
        self.roles = self._roles()
        self._users()
        self.clients, self.suppliers = self._counterparties()
        self.employees = self._employees()
        self.warehouses = self._warehouses()
        self.products = self._products()
        self._stock()
        self._accounts()
        self._fixed_assets()
        self.documents = self._documents()
        self._contracts()
        self._signatures()
        self._periods()
        self._budgets()
        self._stock_moves()
        self._inventories()
        self._purchases()
        self._sales()
        self._payroll()
        self._taxes()
        self._cash_orders()
        self._payments()
        self._bank_statements()
        self._crm()
        self._entries()
        self._depreciation()
        self._requests()
        self._notifications()
        self._integrations()
        self._audit()

        self.stdout.write(self.style.SUCCESS(
            f'Готово. Организаций: {Company.objects.count()}, '
            f'контрагентов: {Counterparty.objects.count()}, '
            f'товаров: {Product.objects.count()}, '
            f'продаж: {Sale.objects.count()}, '
            f'документов: {Document.objects.count()}, '
            f'проводок: {Entry.objects.count()}, '
            f'основных средств: {FixedAsset.objects.count()}.'
        ))
        self.stdout.write('Пользователи: admin / glavbuh / buh / kassa / manager / director, пароль 1234')

    # --- Вспомогательные -------------------------------------------------
    def days_ago(self, n):
        return self.today - timedelta(days=n)

    def days_fwd(self, n):
        return self.today + timedelta(days=n)

    def pick(self, seq):
        return self.rnd.choice(seq)

    def rint(self, a, b):
        return self.rnd.randint(a, b)

    def last_months(self, count):
        out = []
        year, month = self.today.year, self.today.month
        for i in range(count - 1, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            out.append((f'{y}-{m:02d}', y, m))
        return out

    def period_end(self, period_key):
        """Последний день учётного периода: «2026-07» → 31.07.2026."""
        year, month = int(period_key[:4]), int(period_key[5:7])
        first_next = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
        return first_next - timedelta(days=1)

    def aware(self, d, hour=9):
        return timezone.make_aware(datetime.combine(d, time(hour, 0)))

    # --- Наполнение ------------------------------------------------------
    def _companies(self):
        return [
            Company.objects.create(
                name='ОсОО «Прогресс Групп»', inn='01503201910123', address='г. Бишкек, ул. Чуй 128',
                phone='+996 312 55-11-22', director='Абдыразаков Т. Р.', accountant='Кадырова Н. А.',
                tax_mode='Общий режим (НДС)', bank=BANKS[0], account='1180000012345678', bik='118001',
            ),
            Company.objects.create(
                name='ОсОО «Прогресс Ритейл»', inn='01503201910456', address='г. Ош, ул. Ленина 210',
                phone='+996 3222 5-44-33', director='Исаков Б. М.', accountant='Турдубаева Ж. С.',
                tax_mode='Упрощённая система', bank=BANKS[1], account='1090000098765432', bik='109002',
            ),
        ]

    def _settings(self):
        AppSettings.objects.create(
            telegram_bot='@erp_company_bot', smtp_host='smtp.company.kg',
            password_policy='Минимум 8 символов, буквы и цифры',
            doc_number_format='{type}-{year}-{seq}',
        )

    def _roles(self):
        roles = {}
        for code, name, description, permissions, readonly in ROLES:
            roles[code] = Role.objects.create(
                code=code, name=name, description=description,
                permissions=list(permissions), readonly=list(readonly),
            )
        return roles

    def _users(self):
        for index, (login, full_name, role_code, email, is_admin) in enumerate(USERS):
            user = User(
                login=login, full_name=full_name, email=email,
                phone=f'+996 55{self.rint(1000000, 9999999)}',
                role=self.roles[role_code], two_factor=is_admin,
                is_staff=is_admin, is_superuser=is_admin,
                last_login=timezone.now() - timedelta(hours=self.rint(1, 72)),
            )
            user.set_password('1234')
            user.save()
            user.companies.set(self.companies if index < 4 else [self.company])

    def _counterparties(self):
        clients, suppliers = [], []
        for index, name in enumerate(CLIENT_NAMES):
            clients.append(self._counterparty(name, 'client', index))
        for index, name in enumerate(SUPPLIER_NAMES):
            suppliers.append(self._counterparty(name, 'supplier', index + 100))
        return clients, suppliers

    def _counterparty(self, name, kind, index):
        domains = ['aktrade', 'bereke', 'nurel', 'tienshan', 'alatoo', 'manas', 'dordoi', 'ecopak']
        return Counterparty.objects.create(
            company=self.company, name=name, kind=kind,
            inn=('015' if kind == 'client' else '023') + str(self.rint(10000000000, 99999999999)),
            address=self.pick(CITIES),
            phone=f'+996 3{self.rint(12, 99)} {self.rint(100000, 999999)}',
            email=f'info@{domains[index % len(domains)]}.kg',
            contact=self.pick(['Асанов А.', 'Иванова М.', 'Токтогулов Б.', 'Сыдыкова Г.', 'Петров С.']),
            bank=self.pick(BANKS),
            account='11' + str(self.rint(80000000000000, 99999999999999)),
            bik='11' + str(self.rint(1000, 9999)),
            rating=self.rint(2, 5),
            credit_limit=money(self.rint(100, 1500) * 1000),
            due_days=self.pick([7, 14, 14, 30]),
        )

    def _employees(self):
        employees = []
        for index, full_name in enumerate(EMPLOYEE_NAMES):
            employees.append(Employee.objects.create(
                company=self.companies[1] if index > 11 else self.company,
                full_name=full_name,
                position=POSITIONS[index % len(POSITIONS)],
                department=DEPARTMENTS[index % len(DEPARTMENTS)],
                hire_date=self.days_ago(self.rint(90, 1800)),
                salary=money(self.rint(25, 90) * 1000),
                phone=f'+996 70{self.rint(1000000, 9999999)}',
                email=f'emp{index + 1}@company.kg',
                inn='2' + str(self.rint(1000000000000, 9999999999999)),
                contract_no=f'ТД-{100 + index}',
                status='vacation' if index == 13 else ('sick' if index == 14 else 'work'),
            ))
        return employees

    def _warehouses(self):
        return [
            Warehouse.objects.create(company=self.company, name='Основной склад', branch='Бишкек',
                                     address='ул. Чуй 128', manager='Исаков Б. М.'),
            Warehouse.objects.create(company=self.company, name='Склад розницы', branch='Бишкек',
                                     address='ул. Ибраимова 45', manager='Бекова Д. Н.'),
            Warehouse.objects.create(company=self.companies[1], name='Склад Ош', branch='Ош',
                                     address='ул. Ленина 210', manager='Джумабаев У. А.'),
        ]

    def _products(self):
        for unit in ['шт', 'кг', 'м', 'уп', 'пач', 'рул', 'лист', 'меш', 'пар']:
            Unit.objects.create(name=unit)

        categories = {}
        for _, category_name, _ in PRODUCTS:
            if category_name not in categories:
                categories[category_name] = Category.objects.create(name=category_name)

        products = []
        for index, (name, category_name, unit) in enumerate(PRODUCTS):
            cost = self.rint(40, 60000)
            products.append(Product.objects.create(
                company=self.company,
                sku=f'ART-{index + 1:02d}{self.rint(10, 99)}',
                barcode='48' + str(self.rint(10000000000, 99999999999)),
                name=name, category=categories[category_name], unit=unit,
                cost=money(cost), price=money(round(cost * (1.2 + self.rnd.random() * 0.5))),
                min_stock=self.rint(3, 25),
            ))
        return products

    def _stock(self):
        rows = []
        for product in self.products:
            for warehouse in self.warehouses[:2]:
                rows.append(Stock(
                    id=f'stk-{product.id}-{warehouse.id}'[:48],
                    company=self.company, product=product, warehouse=warehouse,
                    qty=self.rint(0, 180) if self.rnd.random() > 0.12 else 0,
                ))
        Stock.objects.bulk_create(rows)

    def _accounts(self):
        Account.objects.bulk_create([
            Account(id=f'acc-{code}', code=code, name=name, kind=kind,
                    parent=code.split('.')[0] if '.' in code else '',
                    opening=money(OPENING_BALANCES.get(code, 0)))
            for code, name, kind in ACCOUNTS
        ])

    def _fixed_assets(self):
        """Объекты ОС: здание, транспорт, оборудование, мебель, техника.

        Набор подобран так, чтобы в демо были представлены все четыре метода
        амортизации и разные счета затрат (26 — управленческие, 20 — основное
        производство, 44 — расходы на продажу).
        """
        assets = []
        for index, item in enumerate(FIXED_ASSETS, start=1):
            (name, group, method, cost, salvage, life, expense,
             location, total_units, units_name) = item
            commissioned = self.days_ago(self.rint(life * 8, life * 22))
            assets.append(FixedAsset(
                # bulk_create не вызывает save(), поэтому идентификатор задаётся
                # явно — как и для плана счетов
                id=f'fa-{index:04d}',
                company=self.company,
                inv_number=f'ОС-{index:04d}',
                name=name,
                group=group,
                method=method,
                account='01',
                depreciation_account='02',
                expense_account=expense,
                commissioned_at=commissioned,
                initial_cost=money(cost),
                salvage_value=money(salvage),
                life_months=life,
                declining_rate=Decimal('2'),
                total_units=money(total_units),
                units_name=units_name,
                accumulated=money(0),
                location=location,
                responsible=self.pick(self.employees).full_name,
                status='operation',
            ))
        FixedAsset.objects.bulk_create(assets)
        self.assets = list(FixedAsset.objects.filter(company=self.company))

    def _depreciation(self):
        """Амортизация основных средств тем же сервисом, что и интерфейс.

        Система «внедрена» год назад: начисления за последние 12 месяцев
        попадают в журнал с проводками, всё накопленное раньше переносится
        во входящее сальдо счёта 02 — как при переходе с прежней учётной
        системы. Иначе журнал раздувается сотнями исторических строк, а
        баланс не сходится: объекты стоят на учёте с начала, а проводок
        об их поступлении в демо нет.
        """
        if not getattr(self, 'assets', None):
            return

        journal_from = date(self.today.year - 1, self.today.month, 1)
        opening_wear = Decimal('0')

        # 1. Историческая часть: только накопленная сумма, без проводок
        for asset in self.assets:
            cursor = date(asset.commissioned_at.year, asset.commissioned_at.month, 1)
            while True:
                cursor = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)
                if cursor >= journal_from:
                    break
                day = depreciation_service.month_end(cursor)
                if not depreciation_service.is_accruable(asset, day):
                    break
                units = self._planned_units(asset)
                amount = depreciation_service.monthly_amount(asset, day, units=units)
                if amount <= 0:
                    break
                asset.accumulated = depreciation_service.money(asset.accumulated) + amount
                if units:
                    asset.used_units = Decimal(asset.used_units or 0) + units
                opening_wear += amount
            asset.save(update_fields=['accumulated', 'used_units', 'updated_at'])

        # 2. Последние 12 месяцев — полноценные начисления с проводками.
        # Текущий месяц не начисляется: амортизацию считают при закрытии
        # периода, и в демо остаётся месяц, который можно закрыть вручную.
        cursor = journal_from
        end = date(self.today.year, self.today.month, 1)
        while cursor < end:
            units = {
                asset.id: self._planned_units(asset)
                for asset in self.assets if asset.method == 'units'
            }
            depreciation_service.accrue(
                self.company, cursor,
                assets=FixedAsset.objects.filter(company=self.company, status='operation'),
                units_by_asset=units,
                author='Система',
            )
            cursor = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)

        self._balance_fixed_assets(opening_wear)

    @staticmethod
    def _planned_units(asset):
        """Среднемесячная плановая выработка для производственного метода."""
        if asset.method != 'units':
            return None
        return depreciation_service.money(
            Decimal(asset.total_units or 0) / max(asset.life_months, 1)
        )

    def _balance_fixed_assets(self, opening_wear):
        """Входящее сальдо счетов 01 и 02 по реестру основных средств.

        Разница уходит в нераспределённую прибыль (счёт 84), иначе актив
        не сойдётся с пассивом.
        """
        cost = sum((asset.initial_cost for asset in self.assets), Decimal('0'))
        accounts = {a.code: a for a in Account.objects.filter(code__in=('01', '02', '84'))}
        assets01, wear02, profit84 = accounts.get('01'), accounts.get('02'), accounts.get('84')
        if not (assets01 and wear02 and profit84):
            return

        profit84.opening += (cost - assets01.opening) - (opening_wear - wear02.opening)
        assets01.opening = cost
        wear02.opening = opening_wear
        Account.objects.bulk_update([assets01, wear02, profit84], ['opening'])

    def _documents(self):
        counterparties = self.clients + self.suppliers
        statuses = ['draft', 'review', 'approved', 'posted', 'rejected']
        documents = []
        for index in range(96):
            code, title = DOC_TYPES[index % len(DOC_TYPES)]
            counterparty = self.pick(counterparties)
            doc_date = self.days_ago(self.rint(0, 220))
            status = 'review' if index < 6 else self.pick(statuses)
            amount = 0 if code in ('poa', 'hr') else self.rint(3, 900) * 1000
            documents.append(Document.objects.create(
                company=self.company,
                number=f'{code[:3].upper()}-{index + 1:02d}/{doc_date.year}',
                type=code, type_name=title, date=doc_date,
                counterparty=counterparty, amount=money(amount), status=status,
                file_name=f'{code}_{index + 1:02d}' + ('.pdf' if self.rnd.random() > 0.5 else '.jpg'),
                file_size=self.rint(80, 4200),
                ocr=self.rnd.random() > 0.35,
                ocr_text=(
                    f'Документ {title} № {index + 1:02d} от {doc_date.strftime("%d.%m.%Y")}. '
                    f'Контрагент: {counterparty.name}. ИНН {counterparty.inn}. '
                    f'Сумма: {amount:.2f} сом, в т.ч. НДС 12%. Основание: договор поставки.'
                ),
                signed=status == 'posted' and self.rnd.random() > 0.4,
                author=self.pick([u[1] for u in USERS]),
                tags=[title],
                route=self._route(status, doc_date),
                history=[
                    {'ts': self.aware(doc_date).isoformat(), 'user': 'Бухгалтер', 'action': 'Документ создан'},
                    {'ts': self.aware(doc_date, 10).isoformat(), 'user': 'Система',
                     'action': 'Файл загружен и распознан (OCR)'},
                ],
            ))
        return documents

    def _route(self, status, base_date):
        steps = [
            ('Сотрудник', 'Автор документа', 'Создание'),
            ('Бухгалтер', 'Турдубаева Ж. С.', 'Проверка'),
            ('Руководитель', 'Абдыразаков Т. Р.', 'Утверждение'),
        ]
        done = {'draft': 1, 'review': 1, 'approved': 3, 'posted': 3,
                'rejected': 2, 'new': 1, 'done': 3}.get(status, 1)
        route = []
        for index, (role, name, action) in enumerate(steps):
            rejected = status == 'rejected' and index == done - 1
            route.append({
                'role': role, 'name': name, 'action': action,
                'state': 'rejected' if rejected else (
                    'done' if index < done else ('current' if index == done else 'waiting')
                ),
                'ts': self.aware(base_date, 9 + index).isoformat() if index < done else None,
                'comment': 'Неверные реквизиты контрагента, требуется исправление' if rejected else '',
            })
        return route

    def _contracts(self):
        types = ['Поставка товара', 'Оказание услуг', 'Аренда', 'Подряд', 'Агентский']
        for index in range(26):
            is_client = index < 16
            counterparty = self.pick(self.clients if is_client else self.suppliers)
            start = self.rint(30, 700)
            start_date = self.days_ago(start)
            end_date = start_date + timedelta(days=self.pick([180, 365, 365, 730]))
            Contract.objects.create(
                company=self.company,
                number=f'Д-{2025 + index % 2}/{index + 1:02d}',
                date=start_date, counterparty=counterparty,
                side='client' if is_client else 'supplier',
                type=self.pick(types),
                subject='Поставка товаров покупателю' if is_client else 'Поставка товаров/услуг от поставщика',
                amount=money(self.rint(50, 3500) * 1000),
                start_date=start_date, end_date=end_date,
                auto_renew=self.rnd.random() > 0.7,
                status='expired' if end_date < self.today else 'active',
                responsible=self.pick(EMPLOYEE_NAMES),
                template=self.pick(['Стандартный договор поставки', 'Договор услуг', 'Рамочный договор']),
                signed=self.rnd.random() > 0.25,
            )

    def _signatures(self):
        for document in [d for d in self.documents if d.signed]:
            Signature.objects.create(
                company=self.company, doc=document,
                doc_number=document.number, doc_type=document.type_name,
                signer=self.pick(['Абдыразаков Т. Р.', 'Кадырова Н. А.']),
                cert=f'KG-CERT-{self.rint(100000, 999999)}',
                issuer='ГП «Инфоком» — Центр сертификации КР',
                valid_until=self.days_fwd(self.rint(30, 500)),
                ts=self.aware(document.date, 11),
                valid=self.rnd.random() > 0.06,
            )

    def _entries(self):
        """Проводки формируются автоматически из документов (ТЗ п. 3.3).

        Каждая хозяйственная операция разносится по двойной записи, поэтому
        оборотно-сальдовая ведомость, баланс и отчёт о прибылях и убытках
        строятся на тех же данных, что видит пользователь в документах.
        """
        rows = []

        def add(day, debit, credit, amount, content):
            amount = float(amount or 0)
            if amount <= 0:
                return
            index = len(rows) + 1
            rows.append(Entry(
                id=f'ent-{index:05d}', company=self.company, number=f'{index:05d}',
                date=day, debit=debit, credit=credit, amount=money(amount),
                content=content, auto=True, posted=True, author='Система (авто)',
            ))

        # Реализация: выручка, себестоимость, НДС
        for sale in Sale.objects.all().order_by('date'):
            add(sale.date, '62.1', '90.1', sale.amount, f'Реализация по документу {sale.number}')
            add(sale.date, '90.2', '41.1', float(sale.amount) * COST_RATIO,
                f'Списана себестоимость по документу {sale.number}')

        # Начисление налогов: обязательство возникает в последний день периода,
        # уплата проходит отдельной проводкой в срок платежа
        for tax in Tax.objects.all().order_by('due_date'):
            rule = next((pair for marker, pair in TAX_ACCRUAL.items()
                         if marker in tax.name.lower()), None)
            if rule:
                add(self.period_end(tax.period_key), rule[0], rule[1], tax.amount,
                    f'Начислен налог: {tax.name} за {tax.period}')

        # Поступление товара от поставщика
        for order in PurchaseOrder.objects.exclude(status='cancelled').order_by('date'):
            add(order.date, '41.1', '60.1', order.amount,
                f'Оприходование товара по заказу {order.number}')

        # Касса
        for order in CashOrder.objects.all().order_by('date'):
            if order.kind == 'in':
                add(order.date, '50.1', '62.1', order.amount,
                    f'Приход в кассу по ордеру {order.number}')
            else:
                basis = (order.basis or '').lower()
                debit = '71' if 'подотчёт' in basis or 'подотчет' in basis else (
                    '70' if 'зарплат' in basis or 'оплата труда' in basis else '26')
                add(order.date, debit, '50.1', order.amount,
                    f'Расход из кассы по ордеру {order.number}')

        # Банк
        for payment in Payment.objects.filter(status='executed').order_by('date'):
            purpose = (payment.purpose or '').lower()
            if payment.kind == 'in':
                add(payment.date, '51', '62.1', payment.amount,
                    f'Поступление на расчётный счёт по платежу {payment.number}')
            elif 'заработной платы' in purpose:
                add(payment.date, '70', '51', payment.amount,
                    f'Перечислена зарплата, платёж {payment.number}')
            elif purpose.startswith('уплата:'):
                # Назначение вида «Уплата: НДС за Июль 2026» — счёт берём по названию налога
                account = next((code for marker, code in TAX_ACCOUNTS.items() if marker in purpose), '68')
                add(payment.date, account, '51', payment.amount,
                    f'Уплата в бюджет, платёж {payment.number}')
            else:
                add(payment.date, '60.1', '51', payment.amount,
                    f'Оплата поставщику по платежу {payment.number}')

        # Зарплата: начисление, удержания, выплата
        for payroll in Payroll.objects.all().order_by('period_key'):
            day = payroll.paid_at or date(int(payroll.period_key[:4]), int(payroll.period_key[5:7]), 28)
            add(day, '26', '70', payroll.gross, f'Начислена зарплата: {payroll.employee_name}')
            add(day, '70', '68.4', payroll.income_tax, f'Удержан подоходный налог: {payroll.employee_name}')
            add(day, '26', '69', payroll.social, f'Отчисления в соцфонд: {payroll.employee_name}')

        Entry.objects.bulk_create(rows)

    def _periods(self):
        months = self.last_months(14)
        for index, (key, year, month) in enumerate(months):
            closed = index < len(months) - 2
            Period.objects.create(
                company=self.company, key=key, year=year, month=month - 1,
                name=f'{MONTHS_NOM[month - 1]} {year}',
                revenue=money(self.rint(900, 4200) * 1000),
                expense=money(self.rint(600, 3200) * 1000),
                closed=closed,
                closed_by='Кадырова Н. А.' if closed else '',
                closed_at=self.aware(self.days_ago((len(months) - index) * 30 - 5)) if closed else None,
            )

    def _taxes(self):
        """Налоговые обязательства рассчитываются от фактической базы (ТЗ п. 3.8)."""
        revenue, vat, payroll_gross, income_tax, social = {}, {}, {}, {}, {}

        for sale in self.sales:
            key = f'{sale.date.year}-{sale.date.month:02d}'
            revenue[key] = revenue.get(key, 0) + float(sale.amount)
            vat[key] = vat.get(key, 0) + float(sale.vat)

        for payroll in Payroll.objects.all():
            key = payroll.period_key
            payroll_gross[key] = payroll_gross.get(key, 0) + float(payroll.gross)
            income_tax[key] = income_tax.get(key, 0) + float(payroll.income_tax)
            social[key] = social.get(key, 0) + float(payroll.social)

        for key, year, month in self.last_months(6):
            month_revenue = revenue.get(key, 0)
            fot = payroll_gross.get(key, 0)
            profit_base = month_revenue * (1 - COST_RATIO) if month % 3 == 0 else 0
            due = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 20)
            is_past = due < self.today

            plan = [
                ('НДС', 12, 'Ежемесячно', month_revenue, vat.get(key, 0)),
                ('Налог с продаж', 2, 'Ежемесячно', month_revenue, month_revenue * 0.02),
                ('Налог на прибыль', 10, 'Ежеквартально', profit_base, profit_base * 0.10),
                ('Подоходный налог', 10, 'Ежемесячно', fot, income_tax.get(key, 0)),
                ('Соцфонд', 10, 'Ежемесячно', fot, social.get(key, 0)),
            ]

            for name, rate, frequency, base, amount in plan:
                if amount <= 0:
                    continue
                Tax.objects.create(
                    company=self.company, name=name, rate=Decimal(str(rate)),
                    period_key=key, period=f'{MONTHS_NOM[month - 1]} {year}',
                    frequency=frequency, base=money(base), amount=money(amount),
                    due_date=due,
                    status='paid' if is_past and self.rnd.random() > 0.12
                    else ('overdue' if is_past else 'planned'),
                    declaration='Сдана' if is_past else 'Не сдана',
                )

    def _cash_orders(self):
        """Кассовые ордера — расшифровка наличных расчётов по документам (ТЗ п. 3.4)."""
        cashier = 'Осмонова Айпери Талантбековна'
        index = 0

        # ПКО: часть оплат покупателей поступает наличными
        self.cash_paid_sales = []
        for sale in self.sales:
            if float(sale.paid) <= 0 or float(sale.amount) > 400_000 or self.rnd.random() > 0.35:
                continue
            index += 1
            self.cash_paid_sales.append(sale.id)
            CashOrder.objects.create(
                company=self.company, number=f'ПКО-{index:03d}', kind='in',
                date=sale.date + timedelta(days=self.rint(0, 5)), amount=sale.paid,
                counterparty=sale.counterparty, person=sale.counterparty.name,
                basis=f'Оплата по документу реализации {sale.number}', cashier=cashier,
            )

        # РКО: подотчёт и хозяйственные расходы
        for reason in ['Выдача под отчёт', 'Хозяйственные расходы', 'Приобретение канцтоваров',
                       'Оплата услуг связи', 'Транспортные расходы', 'Выдача под отчёт']:
            index += 1
            CashOrder.objects.create(
                company=self.company, number=f'РКО-{index:03d}', kind='out',
                date=self.days_ago(self.rint(0, 120)), amount=money(self.rint(5, 60) * 1000),
                person=self.pick(EMPLOYEE_NAMES), basis=reason, cashier=cashier,
            )

    def _payments(self):
        """Платёжные поручения — безналичные расчёты по документам (ТЗ п. 3.5)."""
        cash_sales = set(getattr(self, 'cash_paid_sales', []))
        index = 0

        # Поступления от покупателей — всё, что не прошло через кассу
        for sale in self.sales:
            if float(sale.paid) <= 0 or sale.id in cash_sales:
                continue
            index += 1
            Payment.objects.create(
                company=self.company, number=f'ПП-{index:03d}', kind='in',
                date=sale.date + timedelta(days=self.rint(0, 10)),
                counterparty=sale.counterparty, amount=sale.paid,
                purpose=f'Оплата по документу реализации {sale.number}, в т.ч. НДС 12%',
                account='1180000012345678', bank=self.pick(BANKS),
                matched=self.rnd.random() > 0.15, status='executed',
            )

        # Оплата поставщикам по заказам
        for order in PurchaseOrder.objects.exclude(status='cancelled'):
            if float(order.paid) <= 0:
                continue
            index += 1
            Payment.objects.create(
                company=self.company, number=f'ПП-{index:03d}', kind='out',
                date=order.date + timedelta(days=self.rint(1, 14)),
                counterparty=order.supplier, amount=order.paid,
                purpose=f'Оплата поставщику по заказу {order.number}, в т.ч. НДС 12%',
                account='1180000012345678', bank=self.pick(BANKS),
                matched=True, status='executed',
            )

        # Перечисление заработной платы на карты сотрудников
        by_period = {}
        for payroll in Payroll.objects.filter(status='paid'):
            key = (payroll.period, payroll.paid_at)
            by_period[key] = by_period.get(key, 0) + float(payroll.net)
        for (period, paid_at), total in sorted(by_period.items(), key=lambda item: str(item[0])):
            index += 1
            Payment.objects.create(
                company=self.company, number=f'ПП-{index:03d}', kind='out',
                date=paid_at or self.today, counterparty=None, amount=money(total),
                purpose=f'Выплата заработной платы за {period}',
                account='1180000012345678', bank=BANKS[0], matched=True, status='executed',
            )

        # Уплата налогов в бюджет
        for tax in Tax.objects.filter(status='paid'):
            index += 1
            Payment.objects.create(
                company=self.company, number=f'ПП-{index:03d}', kind='out',
                date=tax.due_date, counterparty=None, amount=tax.amount,
                purpose=f'Уплата: {tax.name} за {tax.period}',
                account='1180000012345678', bank=BANKS[0], matched=True, status='executed',
            )

        # Подготовленные, но ещё не исполненные поручения — в учёт не попадают
        for _ in range(6):
            index += 1
            supplier = self.pick(self.suppliers)
            Payment.objects.create(
                company=self.company, number=f'ПП-{index:03d}', kind='out',
                date=self.days_ago(self.rint(0, 10)), counterparty=supplier,
                amount=money(self.rint(20, 400) * 1000),
                purpose='Предоплата поставщику по договору, в т.ч. НДС 12%',
                account='1180000012345678', bank=self.pick(BANKS), matched=False, status='new',
            )

    def _bank_statements(self):
        for index in range(6):
            statement_date = self.days_ago(index * 7 + 1)
            rows = self.rint(8, 26)
            BankStatement.objects.create(
                company=self.company, date=statement_date,
                file_name=f'vypiska_{statement_date.isoformat()}.txt',
                rows_count=rows,
                incoming=money(self.rint(200, 3000) * 1000),
                outgoing=money(self.rint(150, 2500) * 1000),
                matched=self.rint(int(rows * 0.6), rows),
                status='loaded' if index == 0 else 'processed',
            )

    def _budgets(self):
        for key, year, month in self.last_months(6):
            period = f'{MONTHS_NOM[month - 1]} {year}'
            for item in INCOME_ITEMS:
                plan = self.rint(200, 2200) * 1000
                Budget.objects.create(company=self.company, period_key=key, period=period,
                                      kind='income', item=item, plan=money(plan),
                                      fact=money(plan * (0.7 + self.rnd.random() * 0.6)))
            for item in EXPENSE_ITEMS:
                plan = self.rint(40, 700) * 1000
                Budget.objects.create(company=self.company, period_key=key, period=period,
                                      kind='expense', item=item, plan=money(plan),
                                      fact=money(plan * (0.75 + self.rnd.random() * 0.55)))

    def _stock_moves(self):
        for index in range(120):
            product = self.pick(self.products)
            move_type = self.pick(['in', 'out', 'out', 'move', 'writeoff'])
            qty = self.rint(1, 40)
            price = product.cost if move_type == 'in' else product.price
            StockMove.objects.create(
                company=self.company, number=f'ДВ-{index + 1:02d}',
                date=self.days_ago(self.rint(0, 200)), type=move_type,
                product=product, product_name=product.name, unit=product.unit, qty=qty,
                from_warehouse=None if move_type == 'in' else self.warehouses[0],
                to_warehouse=self.warehouses[0] if move_type == 'in' else (
                    self.warehouses[1] if move_type == 'move' else None
                ),
                price=price, amount=money(qty * float(price)),
                reason=self.pick(['Брак', 'Истёк срок', 'Порча при хранении']) if move_type == 'writeoff' else '',
                author=self.pick(['Исаков Бекболот', 'Бекова Динара']),
            )

    def _inventories(self):
        for index in range(5):
            lines = []
            for _ in range(6):
                product = self.pick(self.products)
                accounted = self.rint(5, 90)
                fact = accounted + self.rint(-4, 3)
                lines.append({
                    'productId': product.id, 'name': product.name, 'unit': product.unit,
                    'accounted': accounted, 'fact': fact, 'diff': fact - accounted,
                    'price': float(product.cost),
                })
            Inventory.objects.create(
                company=self.company, number=f'ИНВ-{index + 1:02d}',
                date=self.days_ago(self.rint(5, 200)),
                warehouse=self.pick(self.warehouses[:2]),
                responsible='Исаков Бекболот Маратович',
                status='draft' if index == 0 else 'done', lines=lines,
            )

    def _purchases(self):
        for index in range(18):
            product = self.pick(self.products)
            qty = self.rint(5, 60)
            PurchaseRequest.objects.create(
                company=self.company, number=f'ЗК-{index + 1:02d}',
                date=self.days_ago(self.rint(0, 90)),
                product=product, product_name=product.name, qty=qty, unit=product.unit,
                amount=money(qty * float(product.cost)),
                need=self.days_fwd(self.rint(3, 30)),
                author=self.pick(EMPLOYEE_NAMES),
                status=self.pick(['new', 'review', 'approved', 'done', 'rejected']),
                comment='Пополнение складского запаса',
            )

        for index in range(24):
            supplier = self.pick(self.suppliers)
            order_date = self.days_ago(self.rint(0, 260))
            items = []
            for _ in range(self.rint(1, 4)):
                product = self.pick(self.products)
                qty = self.rint(5, 80)
                price = round(float(product.cost) * (0.9 + self.rnd.random() * 0.3))
                items.append({'productId': product.id, 'name': product.name, 'unit': product.unit,
                              'qty': qty, 'price': price, 'sum': qty * price})
            amount = sum(item['sum'] for item in items)
            PurchaseOrder.objects.create(
                company=self.company, number=f'ЗП-{index + 1:02d}', date=order_date,
                supplier=supplier, items=items, amount=money(amount),
                paid=money(amount) if self.rnd.random() > 0.4 else money(0),
                delivery_date=order_date + timedelta(days=self.rint(3, 21)),
                status=self.pick(['new', 'sent', 'received', 'received', 'cancelled']),
                manager=self.pick(['Токтоназаров Азиз', 'Касымова Аида']),
            )

    def _sales(self):
        self.sales = []
        for index in range(140):
            client = self.pick(self.clients)
            sale_date = self.days_ago(self.rint(0, 330))
            items = []
            for _ in range(self.rint(1, 5)):
                product = self.pick(self.products)
                qty = self.rint(1, 20)
                price = float(product.price)
                items.append({'productId': product.id, 'name': product.name, 'unit': product.unit,
                              'qty': qty, 'price': price, 'sum': qty * price})
            total = sum(item['sum'] for item in items)
            discount = round(total * 0.05) if self.rnd.random() > 0.75 else 0
            amount = total - discount
            paid_ratio = self.pick([1, 1, 1, 0.5, 0])
            self.sales.append(Sale.objects.create(
                company=self.company, number=f'РН-{index + 1:02d}', date=sale_date,
                counterparty=client, warehouse=self.pick(self.warehouses[:2]),
                items=items, total=money(total), discount=money(discount), amount=money(amount),
                vat=money(amount * 12 / 112), paid=money(amount * paid_ratio),
                due_date=sale_date + timedelta(days=14),
                status='paid' if paid_ratio == 1 else ('unpaid' if paid_ratio == 0 else 'partial'),
                manager=self.pick(['Мамытов Азамат', 'Бекова Динара', 'Раимбеков Санжар']),
                posted=self.rnd.random() > 0.15,
            ))

        for index in range(9):
            sale = self.pick(self.sales)
            Return.objects.create(
                company=self.company, number=f'ВЗ-{index + 1:02d}',
                date=self.days_ago(self.rint(1, 120)),
                sale=sale, sale_number=sale.number, counterparty=sale.counterparty,
                amount=money(float(sale.amount) * (0.2 + self.rnd.random() * 0.5)),
                reason=self.pick(['Брак товара', 'Пересорт', 'Отказ покупателя', 'Ошибка в документах']),
                status=self.pick(['approved', 'review', 'posted']),
            )

    def _crm(self):
        stages = ['new', 'contact', 'offer', 'negotiation', 'won', 'lost']
        probability = {'new': 10, 'contact': 25, 'offer': 50, 'negotiation': 75, 'won': 100, 'lost': 0}
        titles = ['Поставка оргтехники', 'Оснащение офиса мебелью', 'Годовой контракт на канцтовары',
                  'Поставка стройматериалов', 'Обслуживание техники', 'Разовая крупная закупка']
        for index in range(26):
            client = self.pick(self.clients)
            stage = 'new' if index < 4 else self.pick(stages)
            created = self.days_ago(self.rint(0, 120))
            short_name = client.name.replace('ОсОО ', '').replace('ИП ', '').replace('ЗАО ', '')
            Deal.objects.create(
                company=self.company, title=f'{self.pick(titles)} — {short_name}',
                counterparty=client, stage=stage, amount=money(self.rint(30, 1800) * 1000),
                probability=probability[stage],
                manager=self.pick(['Мамытов Азамат', 'Бекова Динара', 'Раимбеков Санжар']),
                date=created,
                next_step=self.pick(['Позвонить клиенту', 'Отправить КП', 'Согласовать договор',
                                     'Выставить счёт', 'Встреча в офисе']),
                next_date=self.days_fwd(self.rint(-3, 20)),
                activities=[
                    {'ts': self.aware(created).isoformat(), 'type': 'call',
                     'text': 'Первичный звонок, выявлена потребность'},
                    {'ts': self.aware(created, 14).isoformat(), 'type': 'email',
                     'text': 'Отправлено коммерческое предложение'},
                ],
            )

        tasks = ['Позвонить клиенту по счёту', 'Подготовить акт сверки', 'Проверить оплату',
                 'Отправить документы на подпись', 'Согласовать цену с поставщиком',
                 'Провести инвентаризацию секции']
        for _ in range(22):
            due = self.days_fwd(self.rint(-6, 18))
            Task.objects.create(
                company=self.company, title=self.pick(tasks),
                assignee=self.pick([u[1] for u in USERS]), due_date=due,
                priority=self.pick(['low', 'normal', 'high']),
                status='done' if due < self.today and self.rnd.random() > 0.5
                else self.pick(['new', 'progress', 'done']),
            )

    def _payroll(self):
        for index, (key, year, month) in enumerate(self.last_months(3)):
            period = f'{MONTHS_NOM[month - 1]} {year}'
            for employee in self.employees:
                bonus = self.rint(2, 15) * 1000 if self.rnd.random() > 0.6 else 0
                gross = float(employee.salary) + bonus
                income_tax = round(gross * 0.1)
                social = round(gross * 0.1)
                Payroll.objects.create(
                    company=employee.company, period_key=key, period=period,
                    employee=employee, employee_name=employee.full_name, position=employee.position,
                    base=employee.salary, bonus=money(bonus), gross=money(gross),
                    income_tax=money(income_tax), social=money(social),
                    net=money(gross - income_tax - social),
                    status='paid' if index < 2 else 'calculated',
                    paid_at=date(year, month, 5) if index < 2 else None,
                )

        rows = []
        for employee in self.employees:
            for offset in range(22):
                day = self.days_ago(offset)
                if day.weekday() >= 5:
                    continue
                day_type = 'work'
                if employee.status == 'vacation' and offset < 8:
                    day_type = 'vacation'
                elif employee.status == 'sick' and offset < 4:
                    day_type = 'sick'
                rows.append(Timesheet(
                    company=employee.company, employee=employee, employee_name=employee.full_name,
                    date=day, type=day_type,
                    hours=(9 if self.rnd.random() > 0.85 else 8) if day_type == 'work' else 0,
                ))
        for row in rows:
            row.id = f'tim-{row.employee_id}-{row.date.isoformat()}'[:48]
        Timesheet.objects.bulk_create(rows)

    def _requests(self):
        types = [('purchase', 'Покупка'), ('payment', 'Оплата'), ('cash', 'Выдача денег'),
                 ('document', 'Создание документа'), ('repair', 'Ремонт'), ('supply', 'Закупка')]
        subjects = ['Закупка канцтоваров для офиса', 'Оплата счёта поставщику', 'Выдача денег под отчёт',
                    'Ремонт принтера в бухгалтерии', 'Подготовка договора с клиентом',
                    'Закупка воды и хозтоваров']
        for index in range(30):
            code, title = types[index % len(types)]
            request_date = self.days_ago(self.rint(0, 70))
            status = 'review' if index < 5 else self.pick(['new', 'review', 'approved', 'done', 'rejected'])
            Request.objects.create(
                company=self.company, number=f'ЗВ-{index + 1:02d}', date=request_date,
                type=code, type_name=title, subject=self.pick(subjects),
                amount=money(0 if code == 'document' else self.rint(2, 150) * 1000),
                author=self.pick(EMPLOYEE_NAMES), department=self.pick(DEPARTMENTS),
                status=status, priority=self.pick(['low', 'normal', 'normal', 'high']),
                route=self._route(status, request_date),
            )

    def _notifications(self):
        items = [
            ('danger', 'alert', 'Просроченный платёж',
             'ОсОО «Дордой Оптима» — 340 000 сом, просрочка 12 дней', '#/debts', False),
            ('info', 'clipboard', 'Документы на согласование',
             '6 документов ожидают вашего решения', '#/approvals', False),
            ('warn', 'contract', 'Заканчивается договор',
             'Д-2025/07 с ОсОО «Ала-Тоо Фуд» истекает через 9 дней', '#/contracts', False),
            ('info', 'bank', 'Загружена выписка банка',
             'Обработано 18 операций, сопоставлено 15', '#/bank', True),
            ('warn', 'box', 'Низкий остаток товара',
             '5 позиций ниже минимального запаса', '#/stock-balance', True),
            ('info', 'percent', 'Срок уплаты налога',
             'НДС за прошлый месяц — до 20 числа', '#/taxes', True),
        ]
        for kind, icon, title, text, link, read in items:
            Notification.objects.create(company=self.company, kind=kind, icon=icon,
                                        title=title, text=text, link=link, read=read)

    def _integrations(self):
        items = [
            ('Банк-клиент (Оптима Банк)', 'bank', 'connected',
             'Импорт выписок 1C-Bank Exchange, отправка платёжных поручений'),
            ('ЭЦП — Инфоком', 'esign', 'connected', 'Подписание и проверка подписи документов'),
            ('Excel / CSV', 'file', 'connected', 'Импорт и экспорт справочников и отчётов'),
            ('Telegram-бот уведомлений', 'notify', 'connected',
             'Оповещения о платежах, заявках, согласованиях'),
            ('Email (SMTP)', 'notify', 'connected', 'Рассылка документов и напоминаний'),
            ('SMS-шлюз', 'notify', 'disabled', 'Критичные оповещения по SMS'),
            ('Кассовое оборудование (ККМ)', 'device', 'connected', 'Фискальный регистратор, печать чеков'),
            ('Сканеры штрихкодов', 'device', 'connected', 'Приём/отгрузка и инвентаризация по штрихкоду'),
            ('Внешний API (REST)', 'api', 'connected', 'JWT-токены, обмен данными с внешними системами'),
            ('Электронные счета-фактуры (ЭСФ)', 'gov', 'connected',
             'Выписка и приём счетов-фактур в электронном виде'),
            ('CRM (внешняя система продаж)', 'api', 'connected',
             'Синхронизация клиентов, сделок и заявок'),
            ('Налоговая отчётность (ГНС)', 'gov', 'pending', 'Отправка деклараций в электронном виде'),
        ]
        for name, kind, status, description in items:
            Integration.objects.create(
                name=name, kind=kind, status=status, description=description,
                last_sync=timezone.now() - timedelta(minutes=self.rint(5, 1440))
                if status == 'connected' else None,
            )

    def _audit(self):
        actions = [
            ('create', 'создал', 'documents', 'Документ'),
            ('update', 'изменил', 'sales', 'Продажа'),
            ('delete', 'удалил', 'entries', 'Проводка'),
            ('custom', 'провёл документ', 'documents', 'Документ'),
            ('custom', 'закрыл период', 'periods', 'Период'),
            ('custom', 'вошёл в систему', '', ''),
        ]
        users = list(User.objects.all())
        for _ in range(60):
            user = self.pick(users)
            action, action_text, entity, entity_title = self.pick(actions)
            AuditLog.objects.create(
                company=self.company, user=user.full_name, user_ref=user,
                role=user.role.code if user.role else '',
                action=action, action_text=action_text,
                entity=entity, entity_title=entity_title,
                label=f'№ {self.rint(1, 90)}' if entity else '',
                ip=f'192.168.1.{self.rint(10, 60)}',
            )

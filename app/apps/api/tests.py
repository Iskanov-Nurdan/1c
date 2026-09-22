"""Тесты API: аутентификация, права ролей, CRUD и начальная загрузка."""
from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounting.models import Account, Depreciation, Entry, FixedAsset
from apps.accounting.services import accrue, monthly_amount, schedule
from apps.accounts.models import MODULES, Role, User
from apps.directories.models import Company, Counterparty
from apps.documents.models import Document
from apps.workflow.models import AuditLog


class ApiTestCase(APITestCase):
    """Общая подготовка: организация, роли и пользователи."""

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='ОсОО «Тест»', inn='01503201910123')

        cls.admin_role = Role.objects.create(
            code='admin', name='Администратор системы', permissions=MODULES, readonly=[],
        )
        cls.cashier_role = Role.objects.create(
            code='cashier', name='Кассир',
            permissions=['dashboard', 'cash', 'payments', 'counterparties', 'documents'],
            readonly=['documents', 'counterparties'],
        )

        cls.admin = User.objects.create_user(
            login='admin', password='1234', full_name='Администратор Системы',
            role=cls.admin_role, is_staff=True, is_superuser=False,
        )
        cls.admin.companies.set([cls.company])

        cls.cashier = User.objects.create_user(
            login='kassa', password='1234', full_name='Кассир Тестовый', role=cls.cashier_role,
        )
        cls.cashier.companies.set([cls.company])

        cls.counterparty = Counterparty.objects.create(
            company=cls.company, name='ОсОО «Клиент»', kind='client', inn='01503201911111',
        )
        cls.document = Document.objects.create(
            company=cls.company, number='INV-01/2026', type='invoice',
            date=date.today(), counterparty=cls.counterparty, amount=1000, status='review',
        )

    def login(self, login='admin', password='1234'):
        response = self.client.post(reverse('api:token'), {'login': login, 'password': password}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return token


class HealthTests(APITestCase):
    def test_health_open_without_auth(self):
        response = self.client.get(reverse('api:health'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'ok')


class AuthTests(ApiTestCase):
    def test_token_and_me(self):
        self.login()
        response = self.client.get(reverse('api:me'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['login'], 'admin')
        self.assertEqual(response.data['role'], 'admin')
        self.assertIn('permissions', response.data)

    def test_wrong_password_rejected(self):
        response = self.client.post(
            reverse('api:token'), {'login': 'admin', 'password': 'wrong'}, format='json',
        )
        self.assertEqual(response.status_code, 401)

    def test_anonymous_has_no_access(self):
        response = self.client.get('/api/counterparties/')
        self.assertEqual(response.status_code, 401)


class BootstrapTests(ApiTestCase):
    def test_admin_receives_all_collections(self):
        self.login()
        response = self.client.get(reverse('api:bootstrap'))
        self.assertEqual(response.status_code, 200)
        collections = response.data['collections']
        self.assertIn('counterparties', collections)
        self.assertIn('documents', collections)
        self.assertEqual(len(collections['counterparties']), 1)
        self.assertEqual(response.data['user']['role'], 'admin')

    def test_cashier_gets_empty_blocked_collections(self):
        self.login('kassa')
        response = self.client.get(reverse('api:bootstrap'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('sales', response.data['blocked'])
        self.assertEqual(response.data['collections']['sales'], [])
        # Касса и контрагенты кассиру доступны
        self.assertNotIn('counterparties', response.data['blocked'])


class CrudTests(ApiTestCase):
    def test_create_update_delete_counterparty_in_camel_case(self):
        self.login()

        created = self.client.post('/api/counterparties/', {
            'name': 'ОсОО «Новый»', 'kind': 'supplier', 'inn': '02312345678901',
            'companyId': self.company.id, 'creditLimit': 250000, 'dueDays': 30,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['companyId'], self.company.id)
        self.assertEqual(created.data['creditLimit'], 250000)
        self.assertTrue(created.data['id'].startswith('cp-'))

        record_id = created.data['id']
        updated = self.client.patch(f'/api/counterparties/{record_id}/', {'rating': 5}, format='json')
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data['rating'], 5)

        deleted = self.client.delete(f'/api/counterparties/{record_id}/')
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Counterparty.objects.filter(id=record_id).exists())

    def test_write_is_logged_to_audit(self):
        self.login()
        before = AuditLog.objects.count()
        self.client.post('/api/counterparties/', {
            'name': 'ОсОО «Аудит»', 'kind': 'client', 'inn': '01512345678901',
            'companyId': self.company.id,
        }, format='json')
        self.assertEqual(AuditLog.objects.count(), before + 1)
        record = AuditLog.objects.order_by('-ts').first()
        self.assertEqual(record.action, 'create')
        self.assertEqual(record.entity, 'counterparties')

    def test_json_fields_survive_round_trip(self):
        self.login()
        response = self.client.post('/api/sales/', {
            'number': 'РН-999', 'date': date.today().isoformat(), 'companyId': self.company.id,
            'counterpartyId': self.counterparty.id, 'amount': 5000, 'paid': 0, 'status': 'unpaid',
            'items': [{'productId': 'prd-1', 'name': 'Товар', 'qty': 2, 'price': 2500, 'sum': 5000}],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['sum'], 5000)


class PermissionTests(ApiTestCase):
    def test_readonly_module_blocks_write(self):
        self.login('kassa')
        response = self.client.post('/api/documents/', {
            'number': 'INV-02/2026', 'type': 'invoice', 'date': date.today().isoformat(),
            'companyId': self.company.id, 'amount': 100,
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_readonly_module_allows_read(self):
        self.login('kassa')
        response = self.client.get('/api/documents/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_module_without_access_is_forbidden(self):
        self.login('kassa')
        self.assertEqual(self.client.get('/api/sales/').status_code, 403)

    def test_admin_only_collection(self):
        self.login('kassa')
        self.assertEqual(self.client.get('/api/auditLog/').status_code, 403)
        self.login('admin')
        self.assertEqual(self.client.get('/api/auditLog/').status_code, 200)


class SummaryTests(ApiTestCase):
    def test_summary_returns_kpi(self):
        self.login()
        response = self.client.get(reverse('api:summary'))
        self.assertEqual(response.status_code, 200)
        for key in ('revenue', 'expense', 'profit', 'receivable', 'payable', 'cashBalance'):
            self.assertIn(key, response.data)


class SpaTests(ApiTestCase):
    def test_index_renders_template_with_config(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'index.html')
        body = response.content.decode('utf-8')
        self.assertIn('id="app-config"', body)
        self.assertIn('"mode": "api"', body)

    def test_index_links_static_assets(self):
        body = self.client.get('/').content.decode('utf-8')
        for asset in ('/static/css/tokens.css', '/static/js/app.js', '/static/img/favicon.svg'):
            self.assertIn(asset, body)


class ReportTests(ApiTestCase):
    """Отчётность (ТЗ п. 4): корректность расчёта и разграничение доступа."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from apps.accounting.models import Account, Entry

        Account.objects.create(id='acc-41.1', code='41.1', name='Товары на складе', kind='A', opening=100000)
        Account.objects.create(id='acc-62.1', code='62.1', name='Расчёты с покупателями', kind='AP')
        Account.objects.create(id='acc-80', code='80', name='Уставный капитал', kind='P', opening=100000)
        Account.objects.create(id='acc-90.1', code='90.1', name='Выручка', kind='P')
        Account.objects.create(id='acc-90.2', code='90.2', name='Себестоимость продаж', kind='A')

        Entry.objects.create(
            company=cls.company, number='1', date=date.today(), debit='62.1', credit='90.1',
            amount=50000, content='Реализация', posted=True,
        )
        Entry.objects.create(
            company=cls.company, number='2', date=date.today(), debit='90.2', credit='41.1',
            amount=35000, content='Себестоимость', posted=True,
        )
        # Непроведённая проводка в отчёты попадать не должна
        Entry.objects.create(
            company=cls.company, number='3', date=date.today(), debit='62.1', credit='90.1',
            amount=999999, content='Черновик', posted=False,
        )

    def url(self, name):
        return reverse('api:report', args=[name])

    def test_report_index_lists_reports(self):
        self.login()
        response = self.client.get(reverse('api:report-index'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('balance', response.data['reports'])

    def test_turnover_ignores_unposted_and_balances(self):
        self.login()
        response = self.client.get(self.url('turnover'), {'from': '2000-01-01', 'to': date.today().isoformat()})
        self.assertEqual(response.status_code, 200)
        totals = response.data['totals']
        self.assertEqual(totals['turnoverDebit'], 85000)
        self.assertEqual(totals['turnoverCredit'], 85000)
        self.assertTrue(response.data['balanced'])

    def test_balance_sheet_assets_equal_liabilities(self):
        self.login()
        response = self.client.get(self.url('balance'), {'to': date.today().isoformat()})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['balanced'])
        self.assertEqual(response.data['assetTotal'], response.data['liabilityTotal'])

    def test_pnl_calculates_gross_profit(self):
        self.login()
        response = self.client.get(self.url('pnl'), {'from': '2000-01-01', 'to': date.today().isoformat()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['revenue'], 50000)
        lines = {line['code']: line['amount'] for line in response.data['lines']}
        self.assertEqual(lines['2100'], 15000)     # валовая прибыль = 50 000 − 35 000

    def test_cashflow_and_debts_available(self):
        self.login()
        for name in ('cashflow', 'debts'):
            response = self.client.get(self.url(name))
            self.assertEqual(response.status_code, 200, name)

    def test_unknown_report_returns_404(self):
        self.login()
        response = self.client.get(self.url('unknown'))
        self.assertEqual(response.status_code, 404)

    def test_role_without_reports_module_is_denied(self):
        self.login('kassa')
        response = self.client.get(self.url('balance'))
        self.assertEqual(response.status_code, 403)


class DepreciationTests(ApiTestCase):
    """Расчёт амортизации основных средств (МСФО (IAS) 16)."""

    def asset(self, **kwargs):
        defaults = dict(
            company=self.company,
            inv_number='ОС-0001',
            name='Автомобиль',
            group='vehicle',
            method='straight',
            commissioned_at=date(2020, 1, 15),
            initial_cost=Decimal('1200000'),
            salvage_value=Decimal('200000'),
            life_months=100,
            expense_account='26',
        )
        defaults.update(kwargs)
        return FixedAsset.objects.create(**defaults)

    def test_straight_line_spreads_base_evenly(self):
        asset = self.asset()
        # База 1 000 000 за 100 месяцев — ровно 10 000 в месяц
        self.assertEqual(monthly_amount(asset, date(2020, 2, 29)), Decimal('10000.00'))

    def test_accrual_starts_month_after_commissioning(self):
        asset = self.asset(commissioned_at=date(2026, 3, 10))
        # Месяц ввода в эксплуатацию не амортизируется
        self.assertEqual(monthly_amount(asset, date(2026, 3, 31)), Decimal('0'))
        self.assertGreater(monthly_amount(asset, date(2026, 4, 30)), Decimal('0'))

    def test_declining_balance_decreases_over_time(self):
        asset = self.asset(method='declining', declining_rate=Decimal('2'))
        first = monthly_amount(asset, date(2020, 2, 29))
        asset.accumulated = first
        second = monthly_amount(asset, date(2020, 3, 31))
        self.assertLess(second, first)

    def test_sum_of_years_first_year_is_largest(self):
        asset = self.asset(method='sumYears', life_months=36)
        first = monthly_amount(asset, date(2020, 2, 29))
        third_year = monthly_amount(asset, date(2022, 6, 30))
        self.assertGreater(first, third_year)

    def test_units_method_needs_output(self):
        asset = self.asset(method='units', total_units=Decimal('10000'))
        self.assertEqual(monthly_amount(asset, date(2020, 2, 29)), Decimal('0'))
        # 500 моточасов из 10 000 — пять процентов базы
        self.assertEqual(monthly_amount(asset, date(2020, 2, 29), units=Decimal('500')), Decimal('50000.00'))

    def test_never_depreciates_below_salvage_value(self):
        asset = self.asset()
        total = sum(row['amount'] for row in schedule(asset))
        self.assertAlmostEqual(total, 1_000_000.0, places=2)

    def test_schedule_ends_at_salvage_value(self):
        rows = schedule(self.asset())
        self.assertEqual(len(rows), 100)
        self.assertAlmostEqual(rows[-1]['residual'], 200_000.0, places=2)

    def test_disposed_asset_is_not_accrued(self):
        asset = self.asset(status='written_off')
        created = accrue(self.company, date(2026, 5, 1), assets=FixedAsset.objects.all())
        self.assertEqual(created, [])
        asset.refresh_from_db()
        self.assertEqual(asset.accumulated, Decimal('0'))

    def test_accrual_creates_entry_and_updates_asset(self):
        asset = self.asset()
        created = accrue(self.company, date(2026, 5, 1), assets=FixedAsset.objects.all())

        self.assertEqual(len(created), 1)
        asset.refresh_from_db()
        self.assertEqual(asset.accumulated, Decimal('10000.00'))

        entry = Entry.objects.get()
        self.assertEqual(entry.debit, '26')
        self.assertEqual(entry.credit, '02')
        self.assertEqual(entry.amount, Decimal('10000.00'))
        self.assertEqual(entry.date, date(2026, 5, 31))

    def test_second_accrual_for_same_period_is_skipped(self):
        self.asset()
        accrue(self.company, date(2026, 5, 1), assets=FixedAsset.objects.all())
        again = accrue(self.company, date(2026, 5, 1), assets=FixedAsset.objects.all())
        self.assertEqual(again, [])
        self.assertEqual(Depreciation.objects.count(), 1)

    def test_api_endpoint_accrues_period(self):
        self.asset()
        self.login()
        response = self.client.post(
            reverse('api:depreciate'), {'period': '2026-05'}, format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['total'], 10000.0)

    def test_api_endpoint_rejects_bad_period(self):
        self.login()
        response = self.client.post(reverse('api:depreciate'), {'period': 'май'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_schedule_endpoint_returns_rows(self):
        asset = self.asset()
        self.login()
        response = self.client.get(reverse('api:asset-schedule', args=[asset.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['rows']), 100)

    def test_role_without_assets_module_is_denied(self):
        self.login('kassa')
        response = self.client.post(reverse('api:depreciate'), {'period': '2026-05'}, format='json')
        self.assertEqual(response.status_code, 403)

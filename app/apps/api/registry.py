"""Реестр коллекций API.

Одна таблица описывает весь REST-слой: имя коллекции (совпадает с именем
коллекции во фронтенде), модель, модуль для проверки прав и поля поиска.
Роутеры, сериализаторы и представления собираются из неё автоматически —
добавление нового справочника сводится к одной строке.
"""
from dataclasses import dataclass, field
from typing import Optional, Sequence

from apps.accounting.models import Account, Depreciation, Entry, FixedAsset, Period, Tax
from apps.accounts.models import Role, User
from apps.directories.models import (
    AppSettings, Category, Company, Counterparty, Employee, Integration, Product, Unit, Warehouse,
)
from apps.documents.models import Contract, Document, Signature
from apps.finance.models import BankStatement, Budget, CashOrder, Payment
from apps.hr.models import Payroll, Timesheet
from apps.inventory.models import Inventory, PurchaseOrder, PurchaseRequest, Stock, StockMove
from apps.sales.models import Deal, Return, Sale, Task
from apps.workflow.models import AuditLog, Notification, Request


@dataclass(frozen=True)
class Collection:
    name: str                      # имя коллекции в API и во фронтенде
    model: type
    module: Optional[str] = None   # модуль для чтения (None — доступно всем)
    write_module: Optional[str] = None   # модуль для изменения
    search: Sequence[str] = field(default_factory=tuple)
    ordering: Sequence[str] = field(default_factory=tuple)


COLLECTIONS = [
    # --- Общие справочники: читают все авторизованные, меняет администратор ---
    Collection('companies', Company, None, 'admin', ('name', 'inn')),
    Collection('users', User, None, 'admin', ('full_name', 'login', 'email')),
    Collection('roles', Role, None, 'admin', ('name', 'code')),
    Collection('settings', AppSettings, None, 'admin'),
    Collection('units', Unit, None, 'warehouse', ('name',)),
    Collection('categories', Category, None, 'warehouse', ('name',)),

    # --- Контрагенты ---------------------------------------------------------
    Collection('counterparties', Counterparty, 'counterparties', None,
               ('name', 'inn', 'phone', 'email', 'contact')),

    # --- Документооборот -----------------------------------------------------
    Collection('documents', Document, 'documents', None, ('number', 'ocr_text', 'counterparty__name')),
    Collection('contracts', Contract, 'contracts', None, ('number', 'subject', 'counterparty__name')),
    Collection('signatures', Signature, 'esign', None, ('doc_number', 'signer', 'cert')),

    # --- Бухгалтерия ---------------------------------------------------------
    Collection('accounts', Account, 'accounting', None, ('code', 'name')),
    Collection('entries', Entry, 'accounting', None, ('number', 'content', 'debit', 'credit')),
    Collection('periods', Period, 'accounting', None, ('name',)),
    Collection('taxes', Tax, 'taxes', None, ('name', 'period')),

    # --- Основные средства ---------------------------------------------------
    Collection('fixedAssets', FixedAsset, 'assets', None,
               ('inv_number', 'name', 'responsible', 'location')),
    Collection('depreciations', Depreciation, 'assets', None, ('asset_name', 'period')),

    # --- Деньги --------------------------------------------------------------
    Collection('cashOrders', CashOrder, 'cash', None, ('number', 'person', 'basis')),
    Collection('payments', Payment, 'payments', None, ('number', 'purpose', 'counterparty__name')),
    Collection('bankStatements', BankStatement, 'bank', None, ('file_name',)),
    Collection('budgets', Budget, 'budget', None, ('item', 'period')),

    # --- Склад и закупки -----------------------------------------------------
    Collection('warehouses', Warehouse, 'warehouse', None, ('name', 'branch')),
    Collection('products', Product, 'warehouse', None, ('name', 'sku', 'barcode')),
    Collection('stock', Stock, 'warehouse', None, ('product__name',)),
    Collection('stockMoves', StockMove, 'warehouse', None, ('number', 'product_name', 'reason')),
    Collection('inventories', Inventory, 'warehouse', None, ('number', 'responsible')),
    Collection('purchaseRequests', PurchaseRequest, 'purchases', None, ('number', 'product_name')),
    Collection('purchaseOrders', PurchaseOrder, 'purchases', None, ('number', 'supplier__name')),

    # --- Продажи и CRM -------------------------------------------------------
    Collection('sales', Sale, 'sales', None, ('number', 'manager', 'counterparty__name')),
    Collection('returns', Return, 'sales', None, ('number', 'reason', 'sale_number')),
    Collection('deals', Deal, 'crm', None, ('title', 'manager', 'counterparty__name')),
    Collection('tasks', Task, 'crm', None, ('title', 'assignee')),

    # --- Кадры ---------------------------------------------------------------
    Collection('employees', Employee, 'hr', None, ('full_name', 'position', 'department')),
    Collection('payrolls', Payroll, 'hr', None, ('employee_name', 'period')),
    Collection('timesheets', Timesheet, 'hr', None, ('employee_name',)),

    # --- Процессы ------------------------------------------------------------
    Collection('requests', Request, 'requests', None, ('number', 'subject', 'author')),
    Collection('notifications', Notification, 'notifications', None, ('title', 'text')),
    Collection('auditLog', AuditLog, 'admin', 'admin', ('user', 'action_text', 'label')),
]

BY_NAME = {c.name: c for c in COLLECTIONS}

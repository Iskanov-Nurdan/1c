"""Пользователи и роли (ТЗ п. 2, 26)."""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.common.models import BaseModel, make_id

# Модули системы, на которые выдаются права
MODULES = [
    'dashboard', 'analytics', 'budget', 'debts', 'reports',
    'documents', 'contracts', 'approvals', 'esign',
    'accounting', 'assets', 'taxes', 'validation',
    'cash', 'bank', 'payments',
    'warehouse', 'purchases',
    'sales', 'crm', 'counterparties',
    'hr', 'requests', 'notifications', 'ai', 'admin',
]


class Role(BaseModel):
    """Роль: набор доступных модулей и модулей «только для чтения»."""

    ID_PREFIX = 'role'

    code = models.CharField('код', max_length=32, unique=True)
    name = models.CharField('название', max_length=120)
    description = models.CharField('описание', max_length=255, blank=True, default='')
    permissions = models.JSONField('доступные модули', default=list, blank=True)
    readonly = models.JSONField('только чтение', default=list, blank=True)

    class Meta:
        verbose_name = 'роль'
        verbose_name_plural = 'роли'
        ordering = ('name',)

    def __str__(self):
        return self.name

    def can(self, module: str) -> bool:
        return module in (self.permissions or [])

    def can_edit(self, module: str) -> bool:
        return self.can(module) and module not in (self.readonly or [])


class UserManager(BaseUserManager):
    def create_user(self, login, password=None, **extra):
        if not login:
            raise ValueError('Логин обязателен')
        user = self.model(login=login, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, login, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('full_name', login)
        if extra.get('is_staff') is not True:
            raise ValueError('Суперпользователь должен иметь is_staff=True')
        role = Role.objects.filter(code='admin').first()
        if role and not extra.get('role'):
            extra['role'] = role
        return self.create_user(login, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Учётная запись сотрудника системы."""

    id = models.CharField('идентификатор', primary_key=True, max_length=48, editable=False)
    login = models.CharField('логин', max_length=64, unique=True)
    full_name = models.CharField('ФИО', max_length=180)
    email = models.EmailField('email', blank=True, default='')
    phone = models.CharField('телефон', max_length=40, blank=True, default='')

    role = models.ForeignKey(
        Role, verbose_name='роль', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='users',
    )
    companies = models.ManyToManyField(
        'directories.Company', verbose_name='организации',
        blank=True, related_name='users',
    )

    two_factor = models.BooleanField('двухфакторная аутентификация', default=False)
    is_active = models.BooleanField('активен', default=True)
    is_staff = models.BooleanField('доступ в админку', default=False)
    created_at = models.DateTimeField('создан', auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'login'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'пользователь'
        verbose_name_plural = 'пользователи'
        ordering = ('full_name',)

    def __str__(self):
        return f'{self.full_name} ({self.login})'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = make_id('usr')
        super().save(*args, **kwargs)

    # --- Права -----------------------------------------------------------
    def can(self, module: str) -> bool:
        if self.is_superuser:
            return True
        return bool(self.role and self.role.can(module))

    def can_edit(self, module: str) -> bool:
        if self.is_superuser:
            return True
        return bool(self.role and self.role.can_edit(module))

    @property
    def role_code(self) -> str:
        return self.role.code if self.role else ''

    @property
    def available_companies(self):
        """Организации пользователя; пустой список = доступны все."""
        return self.companies.all()

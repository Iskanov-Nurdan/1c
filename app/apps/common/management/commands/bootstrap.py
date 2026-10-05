"""Идемпотентная начальная настройка боевой базы (запускается после каждого деплоя).

Создаёт только то, чего ещё нет: роли, организацию, настройки и администратора.
Ничего не перезаписывает и не удаляет — существующие пароли и права остаются как есть.

Переменные окружения:
  ADMIN_LOGIN     логин администратора (по умолчанию admin)
  ADMIN_PASSWORD  пароль; обязателен, только если в базе ещё нет ни одного пользователя
  COMPANY_NAME    название организации по умолчанию
"""
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Role, User
from apps.common.management.commands.seed_demo import ROLES
from apps.directories.models import AppSettings, Company


class Command(BaseCommand):
    help = 'Создаёт роли, организацию, настройки и администратора, если их ещё нет'

    @transaction.atomic
    def handle(self, *args, **options):
        for code, name, description, permissions, readonly in ROLES:
            _, created = Role.objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'description': description,
                    'permissions': list(permissions), 'readonly': list(readonly),
                },
            )
            if created:
                self.stdout.write(f'Роль создана: {code}')

        company = Company.objects.first()
        if company is None:
            company = Company.objects.create(name=os.getenv('COMPANY_NAME', 'Моя организация'))
            self.stdout.write(f'Организация создана: {company.name}')

        if not AppSettings.objects.exists():
            AppSettings.objects.create()
            self.stdout.write('Настройки приложения созданы')

        if User.objects.exists():
            self.stdout.write('Пользователи уже есть — администратор не создаётся')
            return

        password = os.getenv('ADMIN_PASSWORD', '')
        if len(password) < 8:
            raise CommandError('Пользователей нет: задайте ADMIN_PASSWORD (минимум 8 символов)')

        login = os.getenv('ADMIN_LOGIN', 'admin')
        user = User.objects.create_superuser(login=login, password=password, full_name='Администратор системы')
        user.companies.set(Company.objects.all())
        self.stdout.write(f'Администратор создан: {login}')

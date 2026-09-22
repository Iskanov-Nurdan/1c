"""Сериализаторы API.

Для большинства коллекций сериализатор собирается автоматически из модели.
Отдельно описаны только пользователи (роль отдаётся кодом, пароль — write-only).
"""
from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.common.serializers import CamelCaseModelSerializer, build_serializer

from .registry import COLLECTIONS


class UserSerializer(CamelCaseModelSerializer):
    """Пользователь: роль — код (`accountant`), пароль наружу не отдаётся."""

    role = serializers.SlugRelatedField(
        slug_field='code', queryset=Role.objects.all(), allow_null=True, required=False,
    )
    active = serializers.BooleanField(source='is_active', required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            'id', 'login', 'full_name', 'email', 'phone', 'role', 'companies',
            'two_factor', 'active', 'password', 'last_login', 'created_at',
        )
        read_only_fields = ('id', 'last_login', 'created_at')

    def create(self, validated_data):
        password = validated_data.pop('password', '') or '1234'
        companies = validated_data.pop('companies', [])
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if companies:
            user.companies.set(companies)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', '')
        companies = validated_data.pop('companies', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if companies is not None:
            instance.companies.set(companies)
        return instance


SERIALIZERS = {}

for _collection in COLLECTIONS:
    if _collection.name == 'users':
        SERIALIZERS[_collection.name] = UserSerializer
    else:
        SERIALIZERS[_collection.name] = build_serializer(_collection.model)


class MeSerializer(serializers.Serializer):
    """Профиль текущего пользователя для инициализации интерфейса."""

    id = serializers.CharField()
    login = serializers.CharField()
    fullName = serializers.CharField(source='full_name')
    email = serializers.CharField()
    phone = serializers.CharField()
    role = serializers.SerializerMethodField()
    companies = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    readonly = serializers.SerializerMethodField()
    isSuperuser = serializers.BooleanField(source='is_superuser')

    def get_role(self, obj):
        return obj.role.code if obj.role else ''

    def get_companies(self, obj):
        return list(obj.companies.values_list('id', flat=True))

    def get_permissions(self, obj):
        return list(obj.role.permissions) if obj.role else []

    def get_readonly(self, obj):
        return list(obj.role.readonly) if obj.role else []

"""Базовый сериализатор с camelCase-ключами.

Модели описаны по-питоновски (``counterparty``, ``created_at``), а фронтенд
работает с ``counterpartyId`` и ``createdAt``. Преобразование ключей вынесено
сюда, чтобы ни модели, ни клиент не подстраивались друг под друга.
"""
from rest_framework import serializers


def to_camel(name: str) -> str:
    head, *tail = name.split('_')
    return head + ''.join(part[:1].upper() + part[1:] for part in tail)


class CamelCaseModelSerializer(serializers.ModelSerializer):
    """ModelSerializer, отдающий и принимающий camelCase.

    Ключи внешних ключей получают суффикс ``Id`` (``company`` → ``companyId``).
    Неизвестные ключи из запроса игнорируются: клиент может присылать
    вычисляемые поля, которых нет в модели.
    """

    def _key_map(self):
        cached = getattr(self, '_cached_key_map', None)
        if cached is not None:
            return cached
        mapping = {}
        for name, field in self.fields.items():
            json_name = to_camel(name)
            if isinstance(field, serializers.PrimaryKeyRelatedField):
                json_name += 'Id'
            mapping[name] = json_name
        self._cached_key_map = mapping
        return mapping

    def to_representation(self, instance):
        data = super().to_representation(instance)
        mapping = self._key_map()
        return {mapping.get(key, to_camel(key)): value for key, value in data.items()}

    def to_internal_value(self, data):
        reverse = {json_name: name for name, json_name in self._key_map().items()}
        cleaned = {}
        for key, value in (data or {}).items():
            name = reverse.get(key)
            if name is not None:
                cleaned[name] = value
        return super().to_internal_value(cleaned)


def build_serializer(model, read_only=('id', 'created_at', 'updated_at')):
    """Собирает сериализатор для модели: API одинаков для всех коллекций."""
    meta = type('Meta', (), {
        'model': model,
        'fields': '__all__',
        'read_only_fields': tuple(
            f for f in read_only if any(mf.name == f for mf in model._meta.get_fields())
        ),
    })
    return type(f'{model.__name__}Serializer', (CamelCaseModelSerializer,), {'Meta': meta})

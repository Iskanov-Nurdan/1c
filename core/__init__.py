"""Прослойка для Vercel: настоящий пакет лежит в app/core.

Vercel запускает Django из корня репозитория, где нет пакета `core`;
подменяем путь поиска подмодулей на app/core.
"""
import os

__path__ = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'core')]

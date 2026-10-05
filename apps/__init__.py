"""Прослойка для Vercel: настоящий пакет лежит в app/apps (см. core/__init__.py)."""
import os

__path__ = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'apps')]
